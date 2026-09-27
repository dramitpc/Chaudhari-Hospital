// Synthetic fixtures only. Requires Poppler's pdftotext, pdffonts and pdftoppm.
// Run before release: pnpm --filter @workspace/hms test:prescription-pdf
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { after, before, test } from "node:test";
import { createServer } from "vite";
import { PDFDocument } from "pdf-lib";

const exec = promisify(execFile);
const samples = [
  { language: "hi", font: "Devanagari", word: "दवाई", instruction: "भोजन के बाद लें", advice: "पानी पिएं" },
  { language: "gu", font: "Gujarati", word: "દવા", instruction: "જમ્યા પછી લો", advice: "પાણી પીવો" },
  { language: "ta", font: "Tamil", word: "மருந்து", instruction: "உணவுக்குப் பிறகு", advice: "தண்ணீர் குடிக்கவும்" },
  { language: "te", font: "Telugu", word: "మందు", instruction: "భోజనం తర్వాత", advice: "నీరు తాగండి" },
  { language: "kn", font: "Kannada", word: "ಔಷಧಿ", instruction: "ಊಟದ ನಂತರ", advice: "ನೀರು ಕುಡಿಯಿರಿ" },
  { language: "bn", font: "Bengali", word: "ওষুধ", instruction: "খাবারের পরে", advice: "পানি পান করুন" },
  { language: "pa", font: "Gurmukhi", word: "ਦਵਾਈ", instruction: "ਦਵਾਈ ਲਵੋ", advice: "ਦਵਾਈ ਲਵੋ" },
];

let server;
let createPrescriptionPdf;
let originalFetch;
let directory;

before(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "synthetic-rx-pdf-"));
  // Vite's SSR loader evaluates the actual production module, including ?url
  // font imports. Serve those font URLs from the installed @fontsource packages.
  originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    const pathname = new URL(String(url), "http://local.test").pathname;
    const font = pathname.match(/\/node_modules\/(@fontsource\/[^/]+\/files\/[^/]+\.woff)$/);
    assert.ok(font, `unexpected font URL: ${pathname}`);
    const bytes = await readFile(path.join(process.cwd(), "node_modules", font[1]));
    return new Response(bytes);
  };
  server = await createServer({
    configFile: path.resolve("vite.config.ts"),
    server: { middlewareMode: true },
    appType: "custom",
  });
  ({ createPrescriptionPdf } = await server.ssrLoadModule("/src/lib/multilingualPdfDocuments.ts"));
});

after(async () => {
  globalThis.fetch = originalFetch;
  await server?.close();
  if (directory) await rm(directory, { recursive: true, force: true });
});

function fixture(sample, mode) {
  const original = mode === "original";
  return {
    prescription: {
      id: "synthetic-rx",
      patientId: "synthetic-patient",
      patientName: "Sample Person",
      doctorId: "synthetic-doctor",
      doctorName: `Dr Example ${sample.word}`,
      visitDate: "2026-01-01",
      createdAt: "2026-01-01",
      advice: original ? `Hydrate / ${sample.advice}` : "Hydrate and rest",
      items: [{
        drugName: `Sample ${sample.word}`,
        dosage: "1 tablet",
        frequency: "Twice daily",
        duration: "3 days",
        instructions: original ? `After food / ${sample.instruction}` : "After food",
      }],
    },
    settings: {
      id: "synthetic-clinic",
      clinicName: `Example Clinic / ${sample.word}`,
      address: `Test Street / ${sample.word}`,
      createdAt: "2026-01-01",
    },
    format: {
      showDiagnosis: false, showSoap: false, showInvestigations: false,
      showAdvice: true, showFollowUp: false, showReferenceTo: false,
      showGenericName: true, showInstructions: true,
      drugStyle: "table", headerAlign: "center", paperSize: "a4",
      fontSize: "sm", displayMode: original ? "english" : "bilingual",
    },
    translation: original ? null : {
      language: sample.language,
      advice: `Drink water / ${sample.advice}`,
      items: [{
        drugName: `Sample ${sample.word}`,
        dosage: "1 tablet",
        frequency: "Twice daily",
        duration: "3 days",
        instructions: `After food / ${sample.instruction}`,
      }],
    },
  };
}

// A PGM is a plain grayscale raster; its pixels give an independent check
// that Poppler actually paints ink in the text regions (not just a ToUnicode map).
function pgmHasInk(pgm, box, width, height) {
  const header = /^P5\s+(\d+)\s+(\d+)\s+255\s/.exec(pgm.toString("latin1", 0, 80));
  assert.ok(header, "pdftoppm must produce a PGM raster");
  const imageWidth = Number(header[1]);
  const imageHeight = Number(header[2]);
  const pixels = pgm.subarray(header[0].length);
  const left = Math.max(0, Math.floor(box.xMin * imageWidth / width));
  const right = Math.min(imageWidth, Math.ceil(box.xMax * imageWidth / width));
  const top = Math.max(0, Math.floor(box.yMin * imageHeight / height));
  const bottom = Math.min(imageHeight, Math.ceil(box.yMax * imageHeight / height));
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      if (pixels[y * imageWidth + x] < 170) return true;
    }
  }
  return false;
}

function searchable(text) {
  // Poppler sometimes returns Indic combining marks in visual rather than
  // logical order, and inserts spaces within a shaped Bengali cluster.
  // Compare base letters in order; assert the combining marks separately.
  return text.normalize("NFD").replace(/\p{Mark}|\s/gu, "");
}

function assertFieldGlyphs(text, anchor, expected) {
  const line = text.split("\n").find(part => part.includes(anchor));
  assert.ok(line, `missing field ${anchor} in extracted PDF`);
  // The letterhead shares a physical line with the doctor's column.
  const actual = line.slice(line.indexOf(anchor) + anchor.length).trim().split(/\s{2,}/)[0];
  assert.ok(searchable(actual).includes(searchable(expected)),
    `missing base letters of ${JSON.stringify(expected)} after ${anchor}: ${actual}`);
  const marks = value => [...value.normalize("NFD").matchAll(/\p{Mark}/gu)]
    .map(match => match[0]).sort();
  assert.deepEqual(marks(actual), marks(expected),
    `missing or changed Indic vowel/combining signs after ${anchor}: ${actual}`);
}

function wordBoxes(xml, word) {
  const boxes = [];
  const prefix = searchable(word).slice(0, 2);
  for (const match of xml.matchAll(/<word xMin="([^"]+)" yMin="([^"]+)" xMax="([^"]+)" yMax="([^"]+)">([^<]*)<\/word>/g)) {
    if (searchable(match[5]).includes(prefix)) boxes.push({
      xMin: Number(match[1]), yMin: Number(match[2]),
      xMax: Number(match[3]), yMax: Number(match[4]),
    });
  }
  return boxes;
}

for (const sample of samples) {
  for (const mode of ["translated", "original"]) {
    test(`${sample.font} ${mode}: A4, embedded font and visible Indic glyphs`, async () => {
      const pdf = await createPrescriptionPdf(fixture(sample, mode));
      const file = path.join(directory, `${sample.language}-${mode}.pdf`);
      await writeFile(file, Buffer.from(await pdf.arrayBuffer()));

      const document = await PDFDocument.load(await readFile(file));
      assert.equal(document.getPageCount(), 1, "print/share/download PDF must be one physical page");
      const { width, height } = document.getPage(0).getSize();
      assert.ok(Math.abs(width - 595.28) < 1 && Math.abs(height - 841.89) < 1, "page must be A4");

      const { stdout: fonts } = await exec("pdffonts", [file]);
      const fontRows = fonts.split("\n").filter(row => row.includes(sample.font));
      assert.ok(fontRows.length > 0, `${sample.font} missing from PDF fonts:\n${fonts}`);
      assert.ok(fontRows.every(row => /\byes\s+yes\s+yes\b/.test(row)),
        `${sample.font} must be embedded with a Unicode map:\n${fontRows.join("\n")}`);

      const { stdout: text } = await exec("pdftotext", ["-layout", file, "-"], { encoding: "utf8" });
      assert.ok(!/[\uFFFD\u25A1\u25AF\u2610]/u.test(text), "PDF contains replacement/tofu characters");
      for (const phrase of [sample.word, sample.instruction, sample.advice, "Example Clinic", "After food"]) {
        assert.ok(searchable(text).includes(searchable(phrase)),
          `missing base letters of ${JSON.stringify(phrase)} in extracted PDF:\n${text}`);
      }
      assertFieldGlyphs(text, "Example Clinic / ", sample.word);
      assertFieldGlyphs(text, "After food / ", sample.instruction);
      assertFieldGlyphs(text, mode === "original" ? "Hydrate / " : "Drink water / ", sample.advice);

      const { stdout: xml } = await exec("pdftotext", ["-bbox", file, "-"], { encoding: "utf8" });
      const { stdout: pgm } = await exec("pdftoppm", ["-f", "1", "-l", "1", "-scale-to", "1200", "-gray", "-singlefile", file], { encoding: "buffer", maxBuffer: 4 * 1024 * 1024 });
      for (const word of [sample.word, sample.instruction.split(" ")[0], sample.advice.split(" ")[0]]) {
        const boxes = wordBoxes(xml, word);
        assert.ok(boxes.length > 0, `no rendered text coordinates for ${word}`);
        assert.ok(boxes.some(box => pgmHasInk(pgm, box, width, height)), `no rasterized glyphs at ${word}`);
      }
    });
  }
}