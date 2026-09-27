// Synthetic records only. Run before release: pnpm --filter @workspace/hms test:prescription-browser-print
// Requires Chromium and Poppler (pdfinfo, pdftotext, pdffonts, pdftoppm).
// Run separately from the frontend build: the deployment builder includes Poppler but not Chromium.
// Exercises the real desktop window.print() path, not createPrescriptionPdf().
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { test } from "node:test";
import { createServer } from "vite";

const exec = promisify(execFile);
const samples = [
  { language: "hi", font: "Devanagari", word: "दवाई", instruction: "भोजन के बाद लें", advice: "पानी पिएं" },
  { language: "mr", font: "Devanagari", word: "औषध", instruction: "जेवणानंतर घ्या", advice: "पाणी प्या" },
  { language: "gu", font: "Gujarati", word: "દવા", instruction: "જમ્યા પછી લો", advice: "પાણી પીવો" },
  { language: "ta", font: "Tamil", word: "மருந்து", instruction: "உணவுக்குப் பிறகு", advice: "தண்ணீர் குடிக்கவும்" },
  { language: "te", font: "Telugu", word: "మందు", instruction: "భోజనం తర్వాత", advice: "నీరు తాగండి" },
  { language: "kn", font: "Kannada", word: "ಔಷಧಿ", instruction: "ಊಟದ ನಂತರ", advice: "ನೀರು ಕುಡಿಯಿರಿ" },
  { language: "bn", font: "Bengali", word: "ওষুধ", instruction: "খাবারের পরে", advice: "পানি পান করুন" },
  { language: "pa", font: "Gurmukhi", word: "ਦਵਾਈ", instruction: "ਖਾਣੇ ਤੋਂ ਬਾਅਦ ਲਵੋ", advice: "ਪਾਣੀ ਪੀਓ" },
];

function fixture(sample) {
  const item = {
    drugName: "Sample medicine", dosage: "1 tablet", frequency: "Twice daily",
    duration: "3 days", instructions: "After food",
  };
  const translatedItem = {
    ...item, instructions: `After food / ${sample.instruction}`,
  };
  return {
    prescription: {
      id: "synthetic-rx", patientId: "synthetic-patient", patientName: "Sample Person",
      doctorId: "synthetic-doctor", doctorName: `Dr Example ${sample.word}`,
      visitDate: "2026-01-01", createdAt: "2026-01-01",
      advice: "Hydrate and rest",
      // Multiple rows exercise browser scaling, not just a short letterhead.
      items: Array.from({ length: 7 }, (_, i) => ({ ...item, drugName: `Sample medicine ${i + 1}` })),
      translations: {
        language: sample.language, languageName: sample.language,
        advice: `Drink water / ${sample.advice}`,
        items: Array.from({ length: 7 }, (_, i) => ({ ...translatedItem, drugName: `Sample medicine ${i + 1}` })),
      },
    },
    patient: { id: "synthetic-patient", patientId: "TEST-001", gender: "female", age: 30 },
    settings: { id: "synthetic-clinic", clinicName: `Example Clinic / ${sample.word}`, address: "Test Street" },
  };
}

async function waitFor(check, label, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const result = await check();
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function connectPage(port) {
  const target = await waitFor(async () => {
    try {
      const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      return pages.find(page => page.type === "page");
    } catch { return null; }
  }, "Chromium debug page");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
    else entry.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  return { send, close: () => socket.close() };
}

function searchable(text) {
  // Poppler may reorder Indic marks or split shaped clusters with spaces.
  return text.normalize("NFD").replace(/\p{Mark}|\s/gu, "");
}

function assertFieldMarks(text, anchor, phrase) {
  const line = text.split("\n").find(part => part.includes(anchor));
  assert.ok(line, `missing printed field ${anchor}`);
  const actual = line.slice(line.indexOf(anchor) + anchor.length);
  const marks = value => [...value.normalize("NFD").matchAll(/\p{Mark}/gu)]
    .map(match => match[0]).sort();
  const expected = marks(phrase);
  const found = marks(actual);
  for (const mark of expected) {
    const index = found.indexOf(mark);
    assert.ok(index >= 0, `missing ${JSON.stringify(mark)} in printed ${anchor}: ${actual}`);
    found.splice(index, 1);
  }
}

function xmlWords(xml) {
  return [...xml.matchAll(/<word xMin="([^"]+)" yMin="([^"]+)" xMax="([^"]+)" yMax="([^"]+)">([^<]*)<\/word>/g)]
    .map(match => ({
      xMin: Number(match[1]), yMin: Number(match[2]),
      xMax: Number(match[3]), yMax: Number(match[4]), text: match[5],
    }));
}

function hasInk(pgm, box, width, height) {
  const header = /^P5\s+(\d+)\s+(\d+)\s+255\s/.exec(pgm.toString("latin1", 0, 80));
  assert.ok(header, "pdftoppm must provide a grayscale image");
  const imageWidth = Number(header[1]);
  const imageHeight = Number(header[2]);
  const pixels = pgm.subarray(header[0].length);
  for (let y = Math.floor(box.yMin * imageHeight / height); y < Math.ceil(box.yMax * imageHeight / height); y++) {
    for (let x = Math.floor(box.xMin * imageWidth / width); x < Math.ceil(box.xMax * imageWidth / width); x++) {
      if (pixels[y * imageWidth + x] < 170) return true;
    }
  }
  return false;
}

test("desktop browser print keeps synthetic Indic text visible on one A4 page", { timeout: 180000 }, async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "synthetic-rx-browser-print-"));
  let current;
  const server = await createServer({
    configFile: path.resolve("vite.config.ts"),
    server: { port: 0, host: "127.0.0.1", strictPort: false },
    plugins: [{
      name: "synthetic-print-fixtures",
      configureServer(vite) {
        vite.middlewares.use("/api", (req, res) => {
          const routes = {
            "/auth/me": { id: "synthetic-doctor", name: "Example Doctor", role: "doctor" },
            "/prescriptions/synthetic-rx": current?.prescription,
            "/patients/synthetic-patient": current?.patient,
            "/settings/clinic": current?.settings,
          };
          res.setHeader("Content-Type", "application/json");
          if (req.method !== "GET" || !(req.url in routes) || !routes[req.url]) {
            res.statusCode = 404;
            res.end(JSON.stringify({ message: `Unexpected synthetic API request: ${req.url}` }));
            return;
          }
          res.end(JSON.stringify(routes[req.url]));
        });
      },
      transformIndexHtml(html) {
        return html.replace("<head>", `<head><script>
          localStorage.setItem("accessToken", "synthetic-test-token");
          localStorage.removeItem("clinicos_rx_format_v2");
          window.print = () => { window.__syntheticPrintCalled = true; };
        </script>`);
      },
    }],
  });
  let browser;
  let cdp;
  try {
    await server.listen();
    const appPort = server.httpServer.address().port;
    // Bind only to loopback; never connect to live APIs or patient records.
    browser = spawn(process.env.CHROMIUM_PATH || "chromium", [
      "--headless", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
      "--disable-background-networking", "--no-first-run", "--remote-allow-origins=*",
      "--remote-debugging-port=0", `--user-data-dir=${directory}/chrome`, "about:blank",
    ], { stdio: "ignore" });
    const debugPort = await waitFor(async () => {
      if (browser.exitCode !== null) throw new Error(`Chromium exited with ${browser.exitCode}`);
      try {
        return Number((await readFile(path.join(directory, "chrome/DevToolsActivePort"), "utf8")).split("\n")[0]);
      } catch { return null; }
    }, "Chromium debug port");
    cdp = await connectPage(debugPort);
    await cdp.send("Page.enable");
    for (const sample of samples) {
      current = fixture(sample);
      for (const mode of ["bilingual", "translated"]) {
        await t.test(`${sample.font} (${sample.language}) ${mode}`, async () => {
          const url = `http://127.0.0.1:${appPort}/prescriptions/synthetic-rx?lang=${sample.language}&mode=${mode}`;
          await cdp.send("Page.navigate", { url });
          const evaluate = async expression => {
            const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true });
            if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
            return result.result.value;
          };
          await waitFor(() => evaluate(`document.querySelector('[data-testid="btn-print-prescription"]') && document.querySelector('.prescription-print-content')?.textContent.includes(${JSON.stringify(sample.advice)})`), "translated prescription");
          await evaluate(`document.querySelector('[data-testid="btn-print-prescription"]').click()`);
          await waitFor(() => evaluate("window.__syntheticPrintCalled === true"), "desktop window.print()");
          await waitFor(() => evaluate("document.fonts.status === 'loaded'"), "print fonts");
          const { data } = await cdp.send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true });
          const file = path.join(directory, `${sample.language}-${mode}.pdf`);
          await writeFile(file, Buffer.from(data, "base64"));

          const { stdout: info } = await exec("pdfinfo", [file]);
          assert.match(info, /Pages:\s+1\b/, "desktop print must not spill onto another sheet");
          const pageSize = /Page size:\s+([\d.]+) x ([\d.]+) pts \(A4\)/.exec(info);
          assert.ok(pageSize && Math.abs(Number(pageSize[1]) - 595.28) < 1 &&
            Math.abs(Number(pageSize[2]) - 841.89) < 1, "print paper must be A4");
          const { stdout: fonts } = await exec("pdffonts", [file]);
          // Chromium may label a shaped font subset by its internal PostScript
          // name (e.g. NotoSans-Regular for Devanagari), not its CSS family.
          assert.match(fonts, /\byes\s+yes\s+yes\b/, "print needs embedded fonts with Unicode mapping");
          const { stdout: text } = await exec("pdftotext", ["-layout", file, "-"]);
          assert.ok(!/[\uFFFD\u25A1\u25AF\u2610]/u.test(text), "replacement/tofu characters in print");
          for (const phrase of [sample.word, sample.instruction, sample.advice, "Example Clinic", "Sample medicine 7", "Signature & Stamp"]) {
            assert.ok(searchable(text).includes(searchable(phrase)), `missing ${phrase} in desktop print:\n${text}`);
          }
          assertFieldMarks(text, "Example Clinic / ", sample.word);
          assertFieldMarks(text, "After food / ", sample.instruction);
          assertFieldMarks(text, "Drink water / ", sample.advice);
          const { stdout: xml } = await exec("pdftotext", ["-bbox", file, "-"]);
          const boxes = xmlWords(xml);
          const { stdout: pgm } = await exec("pdftoppm", ["-f", "1", "-l", "1", "-scale-to", "1200", "-gray", "-singlefile", file], { encoding: "buffer", maxBuffer: 4 * 1024 * 1024 });
          assert.ok(boxes.length > 20, "print text must have visible text coordinates");
          assert.ok(boxes.every(box => box.xMin >= 25 && box.yMin >= 25 && box.xMax <= 570 && box.yMax <= 817),
            "printed text extends outside A4 printable area");
          for (const word of [sample.word, sample.instruction.split(" ")[0], sample.advice.split(" ")[0], "7", "Stamp"]) {
            const matches = boxes.filter(box => searchable(box.text).includes(searchable(word).slice(0, 2)));
            assert.ok(matches.length, `no print coordinates for ${word}`);
            assert.ok(matches.some(box =>
              box.xMin >= 25 && box.yMin >= 25 && box.xMax <= 570 && box.yMax <= 817 &&
              hasInk(pgm, box, 595.28, 841.89)), `clipped or invisible print glyphs for ${word}`);
          }
        });
      }
    }
  } finally {
    cdp?.close();
    if (browser && browser.exitCode === null && browser.signalCode === null) {
      browser.kill();
      await new Promise(resolve => browser.once("exit", resolve));
    }
    await server.close();
    await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});