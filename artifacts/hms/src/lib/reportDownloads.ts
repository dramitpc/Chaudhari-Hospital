import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { DownloadableReport } from "./reportData";
import { reportCsv } from "./reportData";
import { reportXlsx } from "./reportXlsx";

export type ReportFormat = "pdf" | "xlsx" | "csv";

function pdfText(value: string): string | Content[] {
  if (!/[\u0900-\u0CFF]/u.test(value)) return value;
  const fonts: [RegExp, string][] = [
    [/[\u0900-\u097F]/u, "Devanagari"], [/[\u0980-\u09FF]/u, "Bengali"],
    [/[\u0A00-\u0A7F]/u, "Gurmukhi"], [/[\u0A80-\u0AFF]/u, "Gujarati"],
    [/[\u0B80-\u0BFF]/u, "Tamil"], [/[\u0C00-\u0C7F]/u, "Telugu"], [/[\u0C80-\u0CFF]/u, "Kannada"],
  ];
  const runs: { text: string; font: string }[] = [];
  for (const character of value) {
    const previous = runs.at(-1);
    const font = /[\u200C\u200D]/u.test(character) && previous
      ? previous.font : fonts.find(([pattern]) => pattern.test(character))?.[1] ?? "NotoSans";
    if (previous?.font === font) previous.text += character;
    else runs.push({ text: character, font });
  }
  return runs;
}

export function reportPdfDefinition(report: DownloadableReport, exportedAt: string): TDocumentDefinitions {
  const content: Content[] = [
    { text: report.title, style: "title" },
    { text: `Period: ${report.period}`, margin: [0, 4, 0, 4] },
    { text: `Exported at (UTC): ${exportedAt}`, color: "#64748b", fontSize: 8, margin: [0, 0, 0, 10] },
  ];
  if (report.note) content.push({ text: report.note, fontSize: 8, color: "#64748b", margin: [0, 0, 0, 10] });
  for (const table of report.tables) {
    content.push({ text: table.name, bold: true, fontSize: 11, margin: [0, 12, 0, 6], headlineLevel: 1 });
    if (!table.rows.length) {
      content.push({ text: "No records for the selected period", color: "#64748b" });
      continue;
    }
    content.push({
      fontSize: table.headers.length > 8 ? 7 : 9,
      table: {
        headerRows: 1,
        widths: table.headers.map(() => "*"),
        body: [
          table.headers.map(header => ({ text: header, bold: true, color: "#ffffff", fillColor: "#1e3a5f" })),
          ...table.rows.map(row => row.map((value, column) => ({
            text: pdfText(typeof value === "number" && (table.headers[column]?.includes("(INR)") ||
              (column === 1 && String(row[0]).includes("(INR)"))) ? value.toFixed(2) : String(value)),
            alignment: typeof value === "number" ? "right" as const : "left" as const,
          }))),
        ],
      },
      layout: "lightHorizontalLines",
    });
  }
  return {
    pageSize: "A4", pageOrientation: "landscape", pageMargins: [28, 28, 28, 32],
    info: { title: report.title, author: "ClinicOS", subject: report.period },
    defaultStyle: { font: "NotoSans", fontSize: 9 },
    styles: { title: { fontSize: 18, bold: true, color: "#1e3a5f" } },
    content,
    pageBreakBefore: (node, followingNodesOnPage) => node.headlineLevel === 1 && followingNodesOnPage.length === 0,
    footer: (page, total) => ({
      text: `${report.title} · ${report.period} · Page ${page} of ${total}`,
      alignment: "center", fontSize: 8, color: "#64748b", margin: [20, 10, 20, 0],
    }),
  };
}

export async function createReportFile(report: DownloadableReport, format: ReportFormat): Promise<Blob> {
  const exportedAt = new Date().toISOString();
  if (format === "csv") return new Blob([reportCsv(report, exportedAt)], { type: "text/csv;charset=utf-8" });
  if (format === "xlsx") return new Blob([reportXlsx(report, exportedAt)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  // Reuse the existing local Unicode fonts and data-driven PDF renderer, not screenshots.
  const { renderReportPdf } = await import("./multilingualPdfDocuments");
  return renderReportPdf(reportPdfDefinition(report, exportedAt));
}

export async function downloadReport(report: DownloadableReport, format: ReportFormat): Promise<void> {
  const blob = await createReportFile(report, format);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${report.filename}.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Leave enough time for mobile browsers to consume the file.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}