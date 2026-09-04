import jsPDF from "jspdf";
import type {
  ClinicSettings,
  Consultation,
  Invoice,
  InvoicePayment,
  Patient,
  Prescription,
} from "@workspace/api-client-react";
import { calcAge, fmtDate } from "@/lib/dateUtils";

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 14;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const PAGE_BOTTOM = PAGE_HEIGHT - 14;
const BRAND: [number, number, number] = [30, 58, 95];
const MUTED: [number, number, number] = [92, 103, 116];
const LIGHT: [number, number, number] = [241, 245, 249];

type PdfDocument = jsPDF;

export type PrescriptionPdfInput = {
  prescription: Prescription;
  patient?: Patient;
  consultation?: Consultation;
  settings?: ClinicSettings;
};

export type ReceiptPdfInput = {
  invoice: Invoice;
  patient?: Patient;
  payments?: InvoicePayment[];
  settings?: ClinicSettings;
};

type TextOptions = {
  size?: number;
  style?: "normal" | "bold" | "italic";
  color?: [number, number, number];
  lineHeight?: number;
  align?: "left" | "center" | "right";
};

function createDocument(): PdfDocument {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
  });
  doc.setProperties({
    creator: "ClinicOS",
  });
  return doc;
}

function setTextStyle(doc: PdfDocument, options: TextOptions = {}) {
  doc.setFont("helvetica", options.style ?? "normal");
  doc.setFontSize(options.size ?? 9);
  doc.setTextColor(...(options.color ?? [15, 23, 42]));
}

function wrappedLines(doc: PdfDocument, value: unknown, width: number): string[] {
  const text = String(value ?? "").trim();
  if (!text) return [];
  return doc.splitTextToSize(text, width) as string[];
}

function writeText(
  doc: PdfDocument,
  value: unknown,
  x: number,
  y: number,
  width: number,
  options: TextOptions = {},
): number {
  setTextStyle(doc, options);
  const lines = wrappedLines(doc, value, width);
  if (lines.length === 0) return y;
  const lineHeight = options.lineHeight ?? 4.2;
  doc.text(lines, x, y, {
    align: options.align ?? "left",
    maxWidth: width,
    lineHeightFactor: lineHeight / (options.size ?? 9) * 2.835,
  });
  return y + lines.length * lineHeight;
}

function ensureSpace(doc: PdfDocument, y: number, required: number): number {
  if (y + required <= PAGE_BOTTOM) return y;
  doc.addPage();
  return MARGIN;
}

function drawHeader(
  doc: PdfDocument,
  settings: ClinicSettings | undefined,
  documentTitle: string,
  reference?: string,
): number {
  const clinicName = settings?.clinicName ?? "ClinicOS";
  setTextStyle(doc, { size: 18, style: "bold", color: BRAND });
  doc.text(clinicName, MARGIN, MARGIN + 3);

  let leftY = MARGIN + 8;
  const contact = [settings?.address, settings?.phone, settings?.email, settings?.website]
    .filter(Boolean)
    .join(" | ");
  if (contact) {
    leftY = writeText(doc, contact, MARGIN, leftY, 115, { size: 7.5, color: MUTED, lineHeight: 3.3 });
  }
  if (settings?.registrationNumber) {
    leftY = writeText(doc, `Registration: ${settings.registrationNumber}`, MARGIN, leftY, 115, {
      size: 7.5,
      color: MUTED,
      lineHeight: 3.3,
    });
  }

  setTextStyle(doc, { size: 14, style: "bold", color: BRAND });
  doc.text(documentTitle, PAGE_WIDTH - MARGIN, MARGIN + 3, { align: "right" });
  if (reference) {
    setTextStyle(doc, { size: 8, style: "bold", color: MUTED });
    doc.text(reference, PAGE_WIDTH - MARGIN, MARGIN + 8, { align: "right" });
  }

  const lineY = Math.max(leftY + 1, MARGIN + 14);
  doc.setDrawColor(...BRAND);
  doc.setLineWidth(0.7);
  doc.line(MARGIN, lineY, PAGE_WIDTH - MARGIN, lineY);
  return lineY + 6;
}

function drawInfoBox(
  doc: PdfDocument,
  y: number,
  rows: Array<Array<{ label: string; value: unknown }>>,
): number {
  const rowHeight = 9;
  const height = rows.length * rowHeight;
  doc.setFillColor(...LIGHT);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, height, 1.5, 1.5, "FD");

  rows.forEach((row, rowIndex) => {
    const cellWidth = CONTENT_WIDTH / row.length;
    row.forEach((cell, cellIndex) => {
      const x = MARGIN + cellIndex * cellWidth + 3;
      const top = y + rowIndex * rowHeight + 3.2;
      setTextStyle(doc, { size: 6.5, style: "bold", color: MUTED });
      doc.text(cell.label.toUpperCase(), x, top);
      setTextStyle(doc, { size: 8.5, style: "bold" });
      const value = String(cell.value ?? "-").trim() || "-";
      doc.text(value, x, top + 3.8, { maxWidth: cellWidth - 6 });
    });
  });

  return y + height + 5;
}

function drawSection(doc: PdfDocument, y: number, label: string, value: unknown): number {
  const lines = wrappedLines(doc, value, CONTENT_WIDTH);
  if (lines.length === 0) return y;
  const required = 7 + lines.length * 4;
  y = ensureSpace(doc, y, required);
  setTextStyle(doc, { size: 7, style: "bold", color: BRAND });
  doc.text(label.toUpperCase(), MARGIN, y);
  return writeText(doc, value, MARGIN, y + 4.2, CONTENT_WIDTH, {
    size: 8.5,
    lineHeight: 4,
  }) + 3;
}

function drawFooter(doc: PdfDocument, settings?: ClinicSettings) {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.line(MARGIN, PAGE_HEIGHT - 10, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 10);
    setTextStyle(doc, { size: 7, color: MUTED });
    doc.text(`Generated by ClinicOS${settings?.clinicName ? ` for ${settings.clinicName}` : ""}`, MARGIN, PAGE_HEIGHT - 6);
    doc.text(`Page ${page} of ${pages}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 6, { align: "right" });
  }
}

function drawPrescriptionTable(doc: PdfDocument, y: number, prescription: Prescription): number {
  const widths = [8, 52, 24, 28, 24, 46];
  const headers = ["#", "Medicine", "Dose", "Frequency", "Duration", "Instructions"];
  const tableWidth = widths.reduce((sum, width) => sum + width, 0);

  const drawTableHeader = (top: number) => {
    doc.setFillColor(...BRAND);
    doc.rect(MARGIN, top, tableWidth, 8, "F");
    let x = MARGIN;
    headers.forEach((header, index) => {
      setTextStyle(doc, { size: 7, style: "bold", color: [255, 255, 255] });
      doc.text(header, x + 1.5, top + 5.2, { maxWidth: widths[index] - 3 });
      x += widths[index];
    });
    return top + 8;
  };

  y = ensureSpace(doc, y, 18);
  setTextStyle(doc, { size: 7, style: "bold", color: BRAND });
  doc.text("RX - MEDICATIONS", MARGIN, y);
  y = drawTableHeader(y + 3);

  prescription.items.forEach((item, index) => {
    const medicine = [item.drugName, item.genericName ? `(${item.genericName})` : ""].filter(Boolean).join("\n");
    const values = [
      String(index + 1),
      medicine,
      item.dosage,
      item.frequency,
      item.duration,
      item.instructions ?? "-",
    ];
    const lineSets = values.map((value, cellIndex) => wrappedLines(doc, value, widths[cellIndex] - 3));
    const maxLines = Math.max(...lineSets.map(lines => Math.max(lines.length, 1)));
    const rowHeight = Math.max(8, maxLines * 3.5 + 3);

    if (y + rowHeight > PAGE_BOTTOM) {
      doc.addPage();
      y = drawTableHeader(MARGIN);
    }

    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(MARGIN, y, tableWidth, rowHeight, "F");
    }
    doc.setDrawColor(226, 232, 240);
    doc.rect(MARGIN, y, tableWidth, rowHeight);

    let x = MARGIN;
    lineSets.forEach((lines, cellIndex) => {
      setTextStyle(doc, {
        size: 7.5,
        style: cellIndex === 1 ? "bold" : "normal",
      });
      doc.text(lines.length ? lines : ["-"], x + 1.5, y + 4.2, {
        maxWidth: widths[cellIndex] - 3,
        lineHeightFactor: 1.25,
      });
      x += widths[cellIndex];
    });
    y += rowHeight;
  });

  return y + 5;
}

function parseOrthotics(notes?: string | null): string {
  if (!notes) return "";
  try {
    const parsed = JSON.parse(notes) as unknown;
    return Array.isArray(parsed) ? parsed.map(String).join(", ") : "";
  } catch {
    return notes;
  }
}

function addSignature(doc: PdfDocument, y: number, prescription: Prescription): number {
  y = ensureSpace(doc, y, 30);
  const x = PAGE_WIDTH - MARGIN - 58;
  if (prescription.doctorSignatureData?.startsWith("data:image/")) {
    try {
      doc.addImage(prescription.doctorSignatureData, x + 10, y, 38, 14);
      y += 15;
    } catch {
      // Keep the typed signature block when the stored image is unsupported.
    }
  }
  setTextStyle(doc, { size: 9, style: "bold" });
  doc.text(prescription.doctorName ?? "Doctor", x + 58, y + 4, { align: "right" });
  if (prescription.doctorRegistrationNumber) {
    setTextStyle(doc, { size: 7.5, color: MUTED });
    doc.text(`Reg. No: ${prescription.doctorRegistrationNumber}`, x + 58, y + 8, { align: "right" });
  }
  setTextStyle(doc, { size: 7, color: MUTED });
  doc.text("Signature and Stamp", x + 58, y + 12, { align: "right" });
  return y + 14;
}

export function createPrescriptionPdf(input: PrescriptionPdfInput): PdfDocument {
  const { prescription, patient, consultation, settings } = input;
  const doc = createDocument();
  doc.setProperties({
    title: `Prescription - ${prescription.patientName ?? patient?.fullName ?? "Patient"}`,
    subject: "Medical prescription",
  });

  let y = drawHeader(doc, settings, "PRESCRIPTION");
  const age = calcAge(patient?.dateOfBirth) ?? patient?.age ?? "-";
  y = drawInfoBox(doc, y, [
    [
      { label: "Patient", value: prescription.patientName ?? patient?.fullName },
      { label: "Patient ID", value: patient?.patientId },
      { label: "Date", value: fmtDate(prescription.visitDate) },
    ],
    [
      { label: "Age / Sex", value: `${age} / ${patient?.gender ?? "-"}` },
      { label: "Doctor", value: prescription.doctorName },
      { label: "Visit Type", value: consultation?.visitType?.replace("_", " ") ?? "-" },
    ],
  ]);

  if (patient?.allergies) {
    y = drawSection(doc, y, "Known Allergies", patient.allergies);
  }
  y = drawSection(doc, y, "Diagnosis", prescription.diagnosis);
  y = drawSection(doc, y, "Investigations", consultation?.investigationOrders ?? prescription.investigationOrders);
  y = drawPrescriptionTable(doc, y, prescription);
  y = drawSection(doc, y, "Prescribed Orthotics", parseOrthotics(prescription.notes));
  y = drawSection(doc, y, "Advice", prescription.advice);
  y = drawSection(doc, y, "Follow-up", prescription.followUpDate ? fmtDate(prescription.followUpDate) : "");
  y = drawSection(doc, y, "Reference To", prescription.referenceTo);
  addSignature(doc, y + 2, prescription);
  drawFooter(doc, settings);
  return doc;
}

function drawInvoiceTable(doc: PdfDocument, y: number, invoice: Invoice): number {
  const widths = [9, 85, 18, 32, 38];
  const headers = ["#", "Description", "Qty", "Unit Price", "Amount"];

  const drawTableHeader = (top: number) => {
    doc.setFillColor(...BRAND);
    doc.rect(MARGIN, top, CONTENT_WIDTH, 8, "F");
    let x = MARGIN;
    headers.forEach((header, index) => {
      setTextStyle(doc, { size: 7, style: "bold", color: [255, 255, 255] });
      doc.text(header, index >= 2 ? x + widths[index] - 2 : x + 2, top + 5.2, {
        align: index >= 2 ? "right" : "left",
        maxWidth: widths[index] - 4,
      });
      x += widths[index];
    });
    return top + 8;
  };

  y = drawTableHeader(y);
  invoice.items.forEach((item, index) => {
    const descriptionLines = wrappedLines(doc, item.description, widths[1] - 4);
    const rowHeight = Math.max(8, descriptionLines.length * 3.6 + 3);
    if (y + rowHeight > PAGE_BOTTOM) {
      doc.addPage();
      y = drawTableHeader(MARGIN);
    }

    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight, "F");
    }
    doc.setDrawColor(226, 232, 240);
    doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight);

    const values = [
      String(index + 1),
      descriptionLines,
      String(item.quantity),
      money(item.unitPrice),
      money(item.total),
    ];
    let x = MARGIN;
    values.forEach((value, cellIndex) => {
      setTextStyle(doc, { size: 7.8, style: cellIndex === 1 ? "bold" : "normal" });
      doc.text(value, cellIndex >= 2 ? x + widths[cellIndex] - 2 : x + 2, y + 4.5, {
        align: cellIndex >= 2 ? "right" : "left",
        maxWidth: widths[cellIndex] - 4,
        lineHeightFactor: 1.25,
      });
      x += widths[cellIndex];
    });
    y += rowHeight;
  });
  return y + 5;
}

function money(value: number | null | undefined): string {
  return `INR ${(value ?? 0).toFixed(2)}`;
}

function drawTotals(doc: PdfDocument, y: number, invoice: Invoice): number {
  y = ensureSpace(doc, y, 34);
  const x = PAGE_WIDTH - MARGIN - 72;
  const rows: Array<[string, string, boolean?]> = [
    ["Subtotal", money(invoice.subtotal)],
    ...(invoice.discount ? [["Discount", `- ${money(invoice.discount)}`] as [string, string]] : []),
    ...(invoice.tax ? [["Tax", money(invoice.tax)] as [string, string]] : []),
    ["Total", money(invoice.total), true],
    ["Paid", money(invoice.amountPaid)],
    ["Balance Due", money(invoice.balance), true],
  ];

  rows.forEach(([label, value, bold], index) => {
    const rowY = y + index * 5;
    if (bold) {
      doc.setFillColor(...LIGHT);
      doc.rect(x, rowY - 3.6, 72, 5, "F");
    }
    setTextStyle(doc, { size: 8, style: bold ? "bold" : "normal", color: bold ? BRAND : MUTED });
    doc.text(label, x + 2, rowY);
    doc.text(value, x + 70, rowY, { align: "right" });
  });
  return y + rows.length * 5 + 4;
}

function drawPayments(doc: PdfDocument, y: number, payments: InvoicePayment[]): number {
  if (payments.length === 0) return y;
  y = ensureSpace(doc, y, 12 + payments.length * 5);
  setTextStyle(doc, { size: 7, style: "bold", color: BRAND });
  doc.text("PAYMENT HISTORY", MARGIN, y);
  y += 4;
  payments.forEach(payment => {
    setTextStyle(doc, { size: 8 });
    doc.text(`${fmtDate(payment.paidAt)} - ${payment.paymentMode.toUpperCase()}`, MARGIN, y);
    doc.text(money(payment.amount), PAGE_WIDTH - MARGIN, y, { align: "right" });
    y += 4.5;
  });
  return y + 3;
}

export function createReceiptPdf(input: ReceiptPdfInput): PdfDocument {
  const { invoice, patient, payments = [], settings } = input;
  const doc = createDocument();
  doc.setProperties({
    title: `Invoice - ${invoice.invoiceNumber}`,
    subject: "Invoice and payment receipt",
  });
  const right = PAGE_WIDTH - MARGIN;
  const clinicName = settings?.clinicName ?? "ClinicOS";
  const amount = (value: number | null | undefined) => `INR ${(value ?? 0).toFixed(2)}`;
  const statusColor: [number, number, number] =
    invoice.status === "paid" ? [22, 101, 52]
      : invoice.status === "partial" ? [30, 64, 175]
        : invoice.status === "pending" ? [146, 64, 14]
          : [153, 27, 27];
  const statusFill: [number, number, number] =
    invoice.status === "paid" ? [220, 252, 231]
      : invoice.status === "partial" ? [219, 234, 254]
        : invoice.status === "pending" ? [254, 243, 199]
          : [254, 226, 226];

  setTextStyle(doc, { size: 17, style: "bold", color: BRAND });
  doc.text(clinicName, MARGIN, 17);
  let contactY = 22;
  if (settings?.address) {
    contactY = writeText(doc, settings.address, MARGIN, contactY, 108, { size: 7.5, color: MUTED, lineHeight: 3.2 });
  }
  const contact = [settings?.phone, settings?.email].filter(Boolean).join("  |  ");
  if (contact) writeText(doc, contact, MARGIN, contactY, 108, { size: 7.5, color: MUTED });

  setTextStyle(doc, { size: 20, style: "bold", color: BRAND });
  doc.text("INVOICE", right, 17, { align: "right" });
  setTextStyle(doc, { size: 9, style: "bold", color: [68, 68, 68] });
  doc.text(invoice.invoiceNumber, right, 22, { align: "right" });
  setTextStyle(doc, { size: 7.5, color: MUTED });
  doc.text(`Date: ${fmtDate(invoice.createdAt)}`, right, 26, { align: "right" });
  doc.setFillColor(...statusFill);
  doc.roundedRect(right - 25, 28, 25, 7, 1, 1, "F");
  setTextStyle(doc, { size: 7, style: "bold", color: statusColor });
  doc.text(invoice.status.toUpperCase(), right - 12.5, 32.6, { align: "center" });
  doc.setDrawColor(...BRAND);
  doc.setLineWidth(0.7);
  doc.line(MARGIN, 38, right, 38);

  const cardY = 43;
  const cardGap = 5;
  const cardWidth = (CONTENT_WIDTH - cardGap) / 2;
  const drawCard = (x: number, label: string, primary: string, details: string[]) => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, cardY, cardWidth, 24, 1, 1, "FD");
    setTextStyle(doc, { size: 6.5, style: "bold", color: BRAND });
    doc.text(label.toUpperCase(), x + 4, cardY + 5);
    setTextStyle(doc, { size: 9, style: "bold" });
    doc.text(primary || "-", x + 4, cardY + 10);
    setTextStyle(doc, { size: 7, color: MUTED });
    details.filter(Boolean).slice(0, 2).forEach((detail, index) => doc.text(detail, x + 4, cardY + 15 + index * 3.5));
  };
  drawCard(MARGIN, "Bill To", invoice.patientName ?? patient?.fullName ?? "-", [
    patient?.dateOfBirth ? `DOB: ${fmtDate(patient.dateOfBirth)}` : "",
    patient?.phone ? `Phone: ${patient.phone}` : "",
  ]);
  drawCard(MARGIN + cardWidth + cardGap, "Consulting Doctor", invoice.doctorName ?? "-", []);

  const tableY = 72;
  const widths = [10, 94, 20, 29, 29];
  const headers = ["#", "Description", "Qty", "Rate", "Amount"];
  doc.setFillColor(...BRAND);
  doc.rect(MARGIN, tableY, CONTENT_WIDTH, 8, "F");
  let x = MARGIN;
  headers.forEach((header, index) => {
    setTextStyle(doc, { size: 7, style: "bold", color: [255, 255, 255] });
    doc.text(header, index >= 2 ? x + widths[index] - 2 : x + 2, tableY + 5.2, {
      align: index >= 2 ? "right" : "left",
    });
    x += widths[index];
  });

  let rowY = tableY + 8;
  invoice.items.forEach((item, index) => {
    const description = wrappedLines(doc, item.description, widths[1] - 4);
    const rowHeight = Math.max(7, description.length * 3.2 + 3);
    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(MARGIN, rowY, CONTENT_WIDTH, rowHeight, "F");
    }
    doc.setDrawColor(226, 232, 240);
    doc.rect(MARGIN, rowY, CONTENT_WIDTH, rowHeight);
    const values: Array<string | string[]> = [
      String(index + 1), description, String(item.quantity), amount(item.unitPrice), amount(item.total),
    ];
    x = MARGIN;
    values.forEach((value, cellIndex) => {
      setTextStyle(doc, { size: 7, style: cellIndex === 1 ? "bold" : "normal" });
      doc.text(value, cellIndex >= 2 ? x + widths[cellIndex] - 2 : x + 2, rowY + 4.2, {
        align: cellIndex >= 2 ? "right" : "left",
        maxWidth: widths[cellIndex] - 4,
        lineHeightFactor: 1.2,
      });
      x += widths[cellIndex];
    });
    rowY += rowHeight;
  });

  const summaryY = Math.max(rowY + 6, 100);
  setTextStyle(doc, { size: 6.5, style: "bold", color: BRAND });
  doc.text("PAYMENT DETAILS", MARGIN, summaryY);
  if (payments.length > 0) {
    payments.slice(0, 4).forEach((payment, index) => {
      const y = summaryY + 5 + index * 4;
      setTextStyle(doc, { size: 7 });
      doc.text(`${fmtDate(payment.paidAt)}  ${payment.paymentMode.toUpperCase()}`, MARGIN, y);
      doc.text(amount(payment.amount), MARGIN + 72, y, { align: "right" });
    });
  } else {
    setTextStyle(doc, { size: 7, color: MUTED });
    doc.text(invoice.paymentMode?.toUpperCase() ?? "No payment recorded", MARGIN, summaryY + 5);
  }
  if ((invoice.balance ?? 0) > 0) {
    setTextStyle(doc, { size: 7, style: "bold", color: [146, 64, 14] });
    doc.text(`Balance: ${amount(invoice.balance)}`, MARGIN, summaryY + 25);
  }

  const totalX = right - 72;
  const totals: Array<[string, string, "normal" | "green" | "strong"]> = [];
  totals.push(["Subtotal", amount(invoice.subtotal), "normal"]);
  if (invoice.discount) totals.push(["Discount", `- ${amount(invoice.discount)}`, "green"]);
  if (invoice.tax) totals.push(["Tax", amount(invoice.tax), "normal"]);
  totals.push(
    ["TOTAL", amount(invoice.total), "strong"],
    ["Paid", amount(invoice.amountPaid), "green"],
    ["Balance Due", amount(invoice.balance), (invoice.balance ?? 0) > 0 ? "strong" : "green"],
  );
  totals.forEach(([label, value, emphasis], index) => {
    const y = summaryY - 2 + index * 5;
    doc.setDrawColor(emphasis === "strong" ? 30 : 226, emphasis === "strong" ? 58 : 232, emphasis === "strong" ? 95 : 240);
    doc.line(totalX, y + 2, right, y + 2);
    const color: [number, number, number] =
      emphasis === "green" ? [22, 163, 74] : emphasis === "strong" ? BRAND : [85, 85, 85];
    setTextStyle(doc, { size: emphasis === "strong" ? 8.5 : 7, style: emphasis === "strong" ? "bold" : "normal", color });
    doc.text(label, totalX, y);
    doc.text(value, right, y, { align: "right" });
  });

  const footerY = Math.max(139, summaryY + totals.length * 5 + 5);
  doc.setDrawColor(226, 232, 240);
  doc.line(MARGIN, footerY, right, footerY);
  setTextStyle(doc, { size: 7, color: [136, 136, 136] });
  doc.text(`Thank you for choosing ${clinicName}. We wish you good health.`, MARGIN, footerY + 5);
  doc.text(invoice.invoiceNumber, right, footerY + 5, { align: "right" });
  return doc;
}

export function prescriptionPdfFileName(prescription: Prescription): string {
  return safeFileName(`prescription-${prescription.patientName ?? prescription.id}.pdf`);
}

export function receiptPdfFileName(invoice: Invoice): string {
  return safeFileName(`receipt-${invoice.invoiceNumber}.pdf`);
}

function safeFileName(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function pdfToBlob(doc: PdfDocument): Blob {
  return doc.output("blob");
}

export function downloadPdf(doc: PdfDocument, fileName: string): void {
  doc.save(fileName);
}

export function openPdf(doc: PdfDocument, fileName = "document.pdf"): void {
  const url = URL.createObjectURL(pdfToBlob(doc));
  const opened = window.open(url, "_blank");
  if (opened) opened.opener = null;
  if (!opened) {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function pdfToFile(doc: PdfDocument, fileName: string): File {
  return new File([pdfToBlob(doc)], fileName, { type: "application/pdf" });
}