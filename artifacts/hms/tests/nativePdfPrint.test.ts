import assert from "node:assert/strict";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { usesNativePdfPrinting, handoffPdfForPrinting } from "../src/lib/nativePdfPrint";
import { imposeOnSingleA4, pdfPageCount, A4_WIDTH, A4_HEIGHT } from "../src/lib/singlePagePdf";

test("Android normal and desktop-site modes use generated PDFs; normal desktop printing stays unchanged", () => {
  assert.ok(usesNativePdfPrinting({ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel)" }));
  assert.ok(usesNativePdfPrinting({ userAgent: "Mozilla/5.0 (X11; Linux x86_64)", userAgentData: { platform: "Android" } }));
  assert.ok(usesNativePdfPrinting({ userAgent: "Mozilla/5.0 (X11; Linux x86_64)", platform: "Linux aarch64", maxTouchPoints: 5 }));
  assert.ok(usesNativePdfPrinting({ userAgent: "Mozilla/5.0 (Macintosh)", platform: "MacIntel", maxTouchPoints: 5 }));
  assert.equal(usesNativePdfPrinting({ userAgent: "Mozilla/5.0 (Windows NT 10.0)", platform: "Win32", maxTouchPoints: 5 }), false);
  assert.equal(usesNativePdfPrinting({ userAgent: "Mozilla/5.0 (X11; Linux x86_64)", maxTouchPoints: 0 }), false);
});

test("Prepared PDF is shared synchronously during the original print tap", async () => {
  const file = new File(["%PDF-1.7\nfixture"], "prescription.pdf", { type: "application/pdf" });
  let shared = false;
  const result = handoffPdfForPrinting(file, {
    userActivation: { isActive: true },
    canShare: () => true,
    share: async data => {
      assert.equal(data.files?.[0], file);
      shared = true;
    },
  }, () => assert.fail("No download after a successful native share"));
  assert.ok(shared, "No await may delay navigator.share until after activation expires");
  assert.equal(await result, "shared");
});

test("Unsupported, denied and expired native sharing downloads exactly the same PDF, never HTML", async () => {
  const file = new File(["%PDF-1.7\nfixture"], "receipt.pdf", { type: "application/pdf" });
  for (const target of [
    {},
    { canShare: () => false },
    { canShare: () => { throw new Error("Unsupported files"); } },
    { canShare: () => true, share: async () => { throw new DOMException("Permission denied", "NotAllowedError"); } },
    { userActivation: { isActive: false }, canShare: () => true, share: async () => assert.fail("Do not share after activation expires") },
  ]) {
    let saved = 0;
    assert.equal(await handoffPdfForPrinting(file, target, actual => { assert.equal(actual, file); saved++; }), "downloaded");
    assert.equal(saved, 1);
  }
});

test("Cancelling Android's sheet does not trigger an unwanted download", async () => {
  const file = new File(["%PDF-1.7\nfixture"], "prescription.pdf", { type: "application/pdf" });
  assert.equal(await handoffPdfForPrinting(file, {
    canShare: () => true,
    share: async () => { throw new DOMException("User cancelled", "AbortError"); },
  }, () => assert.fail("Cancellation must not save a file")), "cancelled");
});

test("Invalid or empty files are not sent to a printer", async () => {
  for (const file of [
    new File([], "empty.pdf", { type: "application/pdf" }),
    new File(["not pdf"], "page.html", { type: "text/html" }),
  ]) await assert.rejects(handoffPdfForPrinting(file, {}, () => assert.fail("No download")), /valid PDF/);
});

async function fixturePdf(count: number, size: [number, number] = [A4_WIDTH, A4_HEIGHT]): Promise<Blob> {
  const document = await PDFDocument.create();
  document.setTitle("Prescription fixture");
  for (let page = 0; page < count; page++) document.addPage(size).drawText(`Prescription content, page ${page + 1}`);
  const bytes = await document.save({ useObjectStreams: true });
  return new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], { type: "application/pdf" });
}

test("Compressed multi-page PDF is counted correctly and fitted to one genuine A4 page", async () => {
  const source = await fixturePdf(3);
  assert.equal(await pdfPageCount(source), 3);
  const output = await imposeOnSingleA4(source);
  const document = await PDFDocument.load(await output.arrayBuffer());
  assert.equal(document.getPageCount(), 1);
  assert.equal(document.getTitle(), "Prescription fixture");
  assert.equal(document.getPage(0).getWidth(), A4_WIDTH);
  assert.equal(document.getPage(0).getHeight(), A4_HEIGHT);
});

test("Existing one-page A4 is unchanged, while Letter and A5 are normalized to portrait A4", async () => {
  const a4 = await fixturePdf(1);
  assert.equal(await imposeOnSingleA4(a4), a4);
  for (const size of [[419.53, 595.28], [612, 792]] as [number, number][]) {
    const output = await imposeOnSingleA4(await fixturePdf(1, size));
    const document = await PDFDocument.load(await output.arrayBuffer());
    assert.equal(document.getPageCount(), 1);
    assert.equal(document.getPage(0).getWidth(), A4_WIDTH);
    assert.equal(document.getPage(0).getHeight(), A4_HEIGHT);
  }
});
