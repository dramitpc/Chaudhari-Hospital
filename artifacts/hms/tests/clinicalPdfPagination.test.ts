import assert from "node:assert/strict";
import { test } from "node:test";
import { registerHooks } from "node:module";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";
import type { Invoice, Prescription } from "@workspace/api-client-react";
import { createReceiptPdf } from "../src/lib/pdfDocuments";
import { A4_WIDTH, A4_HEIGHT } from "../src/lib/singlePagePdf";

test("Ordinary generated invoices remain one A4 page, including their payment history", async () => {
  const invoice = {
    id: "print-test", invoiceNumber: "PRINT-TEST", patientName: "Print Test Patient", doctorName: "Test Doctor",
    patientId: "test", createdAt: "2026-11-06T08:00:00Z", status: "paid", subtotal: 100,
    total: 100, amountPaid: 100, balance: 0, discount: 0, tax: 0,
    items: [{ description: "Consultation", quantity: 1, unitPrice: 100, total: 100 }],
  } as Invoice;
  const pdf = createReceiptPdf({
    invoice, payments: [{ id: "test", invoiceId: invoice.id, amount: 100, paymentMode: "cash", paidAt: invoice.createdAt }],
  });
  const document = await PDFDocument.load(pdf.output("arraybuffer"));
  assert.equal(document.getPageCount(), 1);
  assert.ok(Math.abs(document.getPage(0).getWidth() - A4_WIDTH) < 0.1);
  assert.ok(Math.abs(document.getPage(0).getHeight() - A4_HEIGHT) < 0.1);
});

test("Real prescription generator produces one A4 page for long English and bilingual prescriptions", async () => {
  // Reproduce Vite's ?url font imports in Node, using the same bundled fonts.
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier.endsWith(".woff?url")) {
        const resolved = next(specifier.slice(0, -4), context);
        return { ...resolved, url: `${resolved.url}?url` };
      }
      return next(specifier, context);
    },
    load(url, context, next) {
      if (url.endsWith(".woff?url")) return {
        format: "module", shortCircuit: true,
        source: `export default ${JSON.stringify(url.slice(0, -4))};`,
      };
      return next(url, context);
    },
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    if (typeof input === "string" && input.startsWith("file:")) {
      const bytes = await readFile(fileURLToPath(input));
      return new Response(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    }
    return originalFetch(input, init);
  };
  try {
    const { createPrescriptionPdf } = await import("../src/lib/multilingualPdfDocuments");
    const prescription = {
      id: "print-test", prescriptionNumber: "RX-PRINT-TEST", patientId: "test", doctorId: "test",
      patientName: "Print Test Patient", doctorName: "Test Doctor", visitDate: "2026-11-06",
      diagnosis: "Prescription pagination test", advice: "Follow instructions carefully. ".repeat(30),
      notes: "Bring previous reports to the next visit. ".repeat(20),
      items: Array.from({ length: 15 }, (_, index) => ({
        drugName: `Test medicine ${index + 1}`, genericName: "Example generic", dosage: "One tablet",
        frequency: "Twice daily", duration: "7 days", instructions: "After food with water.",
      })),
    } as Prescription;
    for (const displayMode of ["english", "bilingual"] as const) {
      const pdf = await createPrescriptionPdf({
        prescription,
        format: {
          showDiagnosis: true, showSoap: true, showInvestigations: true, showAdvice: true, showFollowUp: true,
          showReferenceTo: true, showGenericName: true, showInstructions: true, drugStyle: "table",
          headerAlign: "left", paperSize: "a4", fontSize: "lg", displayMode,
        },
        translation: displayMode === "bilingual" ? {
          language: "hi", advice: "दवा खाने के बाद लें। ".repeat(30),
          items: prescription.items.map(item => ({
            ...item, drugName: "दवा", dosage: "एक गोली", frequency: "दिन में दो बार",
            duration: "सात दिन", instructions: "भोजन के बाद लें।",
          })),
        } : null,
      });
      const document = await PDFDocument.load(await pdf.arrayBuffer());
      assert.equal(document.getPageCount(), 1, displayMode);
      assert.ok(Math.abs(document.getPage(0).getWidth() - A4_WIDTH) < 0.1);
      assert.ok(Math.abs(document.getPage(0).getHeight() - A4_HEIGHT) < 0.1);
    }
  } finally {
    globalThis.fetch = originalFetch;
    hooks.deregister();
  }
});
