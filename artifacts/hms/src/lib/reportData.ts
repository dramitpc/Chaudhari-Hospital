import type { DailyOpdReport, DailyRevenueItem, DoctorProductivityReport, RevenueReport } from "@workspace/api-client-react";

export type ReportCell = string | number;
export type ReportTable = { name: string; headers: string[]; rows: ReportCell[][] };
export type DownloadableReport = {
  title: string;
  period: string;
  filename: string;
  tables: ReportTable[];
  note?: string;
};

function invoiceTable(name: string, invoices: DailyRevenueItem[]): ReportTable {
  return {
    name,
    headers: ["Patient", "Invoice", "Status", "Charge Type", "Description", "Quantity",
      "Unit Price (INR)", "Discount (INR)", "Line Total (INR)", "Invoice Total (INR)", "Received (INR)", "Balance (INR)"],
    rows: invoices.flatMap(invoice => {
      // Include invoices with no line items too; show invoice-level amounts once only.
      const items = invoice.items.length ? invoice.items : [null];
      return items.map((item, index) => [
        invoice.patientName, invoice.invoiceNumber, invoice.status, item?.chargeTypeName ?? "",
        item?.description ?? "", item ? item.quantity ?? 1 : "",
        item ? item.unitPrice ?? 0 : "", item ? item.discount ?? 0 : "", item?.total ?? "",
        index === 0 ? invoice.total : "", index === 0 ? invoice.amountPaid ?? 0 : "",
        index === 0 ? invoice.balance ?? invoice.total - (invoice.amountPaid ?? 0) : "",
      ]);
    }),
  };
}

export function dailyOpdDownload(report: DailyOpdReport): DownloadableReport {
  return {
    title: "Daily OPD Report", period: report.date, filename: `daily-opd-${report.date}`,
    note: "Partially paid invoices appear in both Paid Invoices and Pending Invoices. Invoice-level amounts are shown once per invoice in each section.",
    tables: [
      { name: "Summary", headers: ["Metric", "Value"], rows: [
        ["Total Patients", report.totalPatients], ["New Patients", report.newPatients ?? 0],
        ["Follow-ups", report.followUps ?? 0], ["Collected (INR)", report.totalRevenue],
        ["Pending Balance (INR)", (report.pendingList ?? []).reduce((sum, invoice) => sum + (invoice.balance ?? invoice.total), 0)],
      ] },
      { name: "Doctor Summary", headers: ["Doctor", "Patients", "Revenue (INR)"],
        rows: report.byDoctor.map(doctor => [doctor.doctorName, doctor.patients, doctor.revenue]) },
      { name: "Payment Modes", headers: ["Payment Mode", "Amount (INR)", "Invoice Count"],
        rows: (report.byPaymentMode ?? []).map(payment => [payment.mode, payment.amount, payment.count]) },
      invoiceTable("Paid Invoices", report.revenueList ?? []),
      invoiceTable("Pending Invoices", report.pendingList ?? []),
    ],
  };
}

export function revenueDownload(report: RevenueReport): DownloadableReport {
  return {
    title: "Revenue Report", period: `${report.startDate} to ${report.endDate}`,
    filename: `revenue-${report.startDate}-to-${report.endDate}`,
    tables: [
      { name: "Summary", headers: ["Metric", "Value"], rows: [
        ["Total Billed (INR)", report.totalRevenue], ["Total Invoices", report.totalInvoices],
        ["Collected (INR)", report.collected], ["Outstanding (INR)", report.pending],
      ] },
      { name: "Daily Billing", headers: ["Date", "Billed (INR)", "Invoice Count"],
        rows: (report.daily ?? []).map(day => [day.date, day.revenue, day.count]) },
      { name: "Charge Types", headers: ["Charge Type", "Category", "Line Items", "Total (INR)", "Percent of Billed"],
        rows: (report.byChargeType ?? []).map(row => [row.name, row.category ?? "", row.count, row.total,
          report.totalRevenue > 0 ? Math.round(row.total / report.totalRevenue * 1000) / 10 : 0]) },
      { name: "Categories", headers: ["Category", "Line Items", "Total (INR)"],
        rows: (report.byCategory ?? []).map(row => [row.name, row.count, row.total]) },
    ],
  };
}

export function productivityDownload(report: DoctorProductivityReport): DownloadableReport {
  return {
    title: "Doctor Productivity Report", period: `${report.startDate} to ${report.endDate}`,
    filename: `doctor-productivity-${report.startDate}-to-${report.endDate}`,
    tables: [
      { name: "Summary", headers: ["Metric", "Value"], rows: [
        ["Total Patients", report.doctors.reduce((sum, doctor) => sum + doctor.totalPatients, 0)],
        ["Total Prescriptions", report.doctors.reduce((sum, doctor) => sum + (doctor.prescriptions ?? 0), 0)],
        ["Total Certificates", report.doctors.reduce((sum, doctor) => sum + (doctor.certificates ?? 0), 0)],
        ["Collected Revenue (INR)", report.doctors.reduce((sum, doctor) => sum + doctor.totalRevenue, 0)],
      ] },
      { name: "Doctor Productivity",
      headers: ["Doctor", "Patients", "Average per Day", "Prescriptions", "Certificates", "Revenue (INR)"],
      rows: report.doctors.map(doctor => [doctor.doctorName, doctor.totalPatients, doctor.avgPerDay,
        doctor.prescriptions ?? 0, doctor.certificates ?? 0, doctor.totalRevenue]),
      },
    ],
  };
}

export function csvCell(value: ReportCell): string {
  let text = String(value);
  // Prevent patient/doctor names or descriptions from becoming spreadsheet formulas.
  if (typeof value === "string" && /^[\s\uFEFF]*[=+\-@]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function reportCsv(report: DownloadableReport, exportedAt: string): string {
  const rows: ReportCell[][] = [[report.title], ["Period", report.period], ["Exported at (UTC)", exportedAt]];
  if (report.note) rows.push(["Note", report.note]);
  for (const table of report.tables) {
    rows.push([], [table.name], table.headers, ...table.rows);
    if (!table.rows.length) rows.push(["No records for the selected period"]);
  }
  // Excel recognizes the UTF-8 BOM; preserve non-English names and use RFC 4180 quoting.
  return "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}