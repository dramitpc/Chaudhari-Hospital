import assert from "node:assert/strict";
import { test } from "node:test";
import { crc32 } from "node:zlib";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import pdfMake from "pdfmake/build/pdfmake";
import { PDFDocument } from "pdf-lib";
import type { DailyOpdReport } from "@workspace/api-client-react";
import { csvCell, dailyOpdDownload, productivityDownload, reportCsv, revenueDownload } from "../src/lib/reportData";
import { createReportFile, reportPdfDefinition } from "../src/lib/reportDownloads";
import { reportXlsx } from "../src/lib/reportXlsx";

const date = "2026-10-03";
const exportedAt = "2026-10-03T12:00:00Z";
const daily: DailyOpdReport = {
  date, totalPatients: 2, totalRevenue: 35.5, newPatients: 1, followUps: 1,
  byDoctor: [{ doctorId: "test", doctorName: "Doctor Test", patients: 2, revenue: 35.5 }],
  byPaymentMode: [{ mode: "cash", amount: 35.5, count: 1 }],
  revenueList: [{
    invoiceNumber: "TEST-1", patientName: 'Patient, "Test"\nनाम', status: "partial",
    total: 100, amountPaid: 35.5, balance: 64.5,
    items: [{ description: "=1+1", total: 60, unitPrice: 60 }, { description: "Review & advice", total: 40, unitPrice: 40 }],
  }],
  pendingList: [{ invoiceNumber: "TEST-2", patientName: "Empty invoice", status: "pending", total: 50, balance: 50, items: [] }],
};

function zipEntries(bytes: Uint8Array): Map<string, Buffer> {
  const buffer = Buffer.from(bytes);
  const files = new Map<string, Buffer>();
  let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(buffer.readUInt16LE(offset + 8), 0, "Standard uncompressed ZIP entry");
    const size = buffer.readUInt32LE(offset + 18);
    const nameSize = buffer.readUInt16LE(offset + 26);
    const extraSize = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + nameSize).toString();
    const dataStart = offset + 30 + nameSize + extraSize;
    const data = buffer.subarray(dataStart, dataStart + size);
    assert.equal(crc32(data), buffer.readUInt32LE(offset + 14), `${name} checksum`);
    files.set(name, data);
    offset = dataStart + size;
  }
  assert.equal(buffer.readUInt32LE(offset), 0x02014b50, "Central directory exists");
  assert.equal(buffer.readUInt32LE(buffer.length - 22), 0x06054b50, "ZIP end record exists");
  assert.equal(buffer.readUInt16LE(buffer.length - 12), files.size);
  return files;
}

test("Daily OPD includes every section and does not double-count receipts across line items", () => {
  const report = dailyOpdDownload(daily);
  assert.equal(report.filename, `daily-opd-${date}`);
  assert.equal(report.tables.length, 5);
  const paid = report.tables.find(table => table.name === "Paid Invoices")!;
  assert.equal(paid.rows.length, 2);
  assert.deepEqual(paid.rows.map(row => row[10]), [35.5, ""]);
  assert.equal(paid.rows[0][5], 1, "Default quantity matches invoice API");
  const pending = report.tables.find(table => table.name === "Pending Invoices")!;
  assert.equal(pending.rows.length, 1, "Invoices without items are retained");
  assert.equal(pending.rows[0][11], 50);
});

test("Revenue includes all charge types rather than only the chart's top eight", () => {
  const report = revenueDownload({
    startDate: date, endDate: date, totalRevenue: 200, totalInvoices: 2, collected: 120, pending: 80,
    daily: [{ date, revenue: 200, count: 2 }],
    byChargeType: Array.from({ length: 12 }, (_, index) => ({ name: `Type ${index}`, category: "test", total: 10, count: 1 })),
    byCategory: [{ name: "test", total: 120, count: 12 }],
  });
  assert.equal(report.tables[2].rows.length, 12);
  assert.equal(report.tables[2].rows[0][4], 5);
  assert.deepEqual(report.tables[0].rows[3], ["Outstanding (INR)", 80]);
  assert.equal(report.period, `${date} to ${date}`);
});

test("Productivity retains unassigned clinic revenue and all doctor metrics", () => {
  const report = productivityDownload({
    startDate: date, endDate: date, doctors: [{
      doctorId: "__unassigned__", doctorName: "Clinic / Unassigned", totalPatients: 0,
      totalRevenue: 75.25, avgPerDay: 0, prescriptions: 0, certificates: 0,
    }],
  });
  assert.deepEqual(report.tables[1].rows[0], ["Clinic / Unassigned", 0, 0, 0, 0, 75.25]);
  assert.deepEqual(report.tables[0].rows[3], ["Collected Revenue (INR)", 75.25]);
});

test("CSV preserves Unicode, quotes, newlines and blocks formula injection without altering numbers", () => {
  const csv = reportCsv(dailyOpdDownload(daily), exportedAt);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"Patient, ""Test""\nनाम"'));
  assert.ok(csv.includes(`"'=1+1"`));
  assert.ok(csv.includes(exportedAt));
  assert.equal(csvCell(-5), '"-5"');
  for (const value of ["=HYPERLINK(1)", "+cmd", "-cmd", "@SUM(1)", "\t=1", " \n@SUM(2)"]) {
    assert.ok(csvCell(value).startsWith(`"'`));
  }
});

test("XLSX is a valid ZIP workbook with safe text cells, typed numeric amounts and distinct sheets", () => {
  const files = zipEntries(reportXlsx(dailyOpdDownload(daily), exportedAt));
  assert.ok(files.has("[Content_Types].xml"));
  const workbook = files.get("xl/workbook.xml")!.toString();
  assert.ok(workbook.includes('name="Paid Invoices"'));
  assert.ok(workbook.includes('name="Pending Invoices"'));
  const sheet = files.get("xl/worksheets/sheet4.xml")!.toString();
  assert.ok(sheet.includes('t="inlineStr"'));
  assert.ok(sheet.includes("=1+1"));
  assert.ok(!sheet.includes("<f>"), "User-controlled cells cannot be Excel formulas");
  assert.ok(sheet.includes('r="K7" s="3"><v>35.5</v>'));
  assert.ok(sheet.includes("नाम"));
  assert.ok(sheet.includes("&quot;Test&quot;"));
  assert.ok(sheet.includes("Review &amp; advice"));
  assert.ok(sheet.includes('state="frozen"'));
});

test("Empty reports remain downloadable, including their dates and table headers", async () => {
  const report = productivityDownload({ startDate: date, endDate: date, doctors: [] });
  for (const format of ["csv", "xlsx"] as const) {
    const blob = await createReportFile(report, format);
    assert.ok(blob.size > 0);
    if (format === "csv") assert.ok((await blob.text()).includes("No records for the selected period"));
    else assert.ok(zipEntries(new Uint8Array(await blob.arrayBuffer())).get("xl/worksheets/sheet2.xml")!.toString()
      .includes("No records for the selected period"));
  }
});

test("PDF is a real, paginated document for long reports, with structured table headers", async () => {
  const report = dailyOpdDownload({
    ...daily,
    revenueList: Array.from({ length: 80 }, (_, index) => ({
      ...daily.revenueList![0], invoiceNumber: `TEST-${index}`, patientName: `Patient ${index} नाम`,
    })),
  });
  const definition = reportPdfDefinition(report, exportedAt);
  assert.equal(definition.pageOrientation, "landscape");
  const require = createRequire(import.meta.url);
  const vfs = Object.fromEntries([["NotoSans.woff", "400"], ["NotoSansBold.woff", "600"]].map(([name, weight]) =>
    [name, readFileSync(require.resolve(`@fontsource/noto-sans/files/noto-sans-latin-${weight}-normal.woff`)).toString("base64")]));
  vfs["Devanagari.woff"] = readFileSync(require.resolve(
    "@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-400-normal.woff",
  )).toString("base64");
  assert.ok(JSON.stringify(definition.content).includes('"font":"Devanagari"'), "Mixed-script names use their local Unicode font");
  const buffer = await new Promise<Uint8Array>((resolve, reject) => {
    try {
      pdfMake.createPdf(definition, undefined, {
        NotoSans: { normal: "NotoSans.woff", bold: "NotoSansBold.woff", italics: "NotoSans.woff", bolditalics: "NotoSansBold.woff" },
        Devanagari: { normal: "Devanagari.woff", bold: "Devanagari.woff", italics: "Devanagari.woff", bolditalics: "Devanagari.woff" },
      }, vfs).getBuffer(resolve);
    } catch (error) { reject(error); }
  });
  const document = await PDFDocument.load(buffer);
  assert.ok(document.getPageCount() > 1, "Long reports must not be clipped to a single page");
  assert.equal(document.getTitle(), "Daily OPD Report");
});