import type { DownloadableReport, ReportCell } from "./reportData";

const encoder = new TextEncoder();
const xml = (value: string) => value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&apos;");
const crcTable = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  return crc >>> 0;
});
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
  return (crc ^ 0xffffffff) >>> 0;
}

/** OOXML uses standard ZIP containers; store entries without compression or dependencies. */
function zip(files: Record<string, string>): Uint8Array<ArrayBuffer> {
  const entries = Object.entries(files).map(([name, content]) => ({
    name: encoder.encode(name), data: encoder.encode(content),
  }));
  const localSize = entries.reduce((size, entry) => size + 30 + entry.name.length + entry.data.length, 0);
  const centralSize = entries.reduce((size, entry) => size + 46 + entry.name.length, 0);
  const bytes = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(bytes.buffer);
  let offset = 0;
  let directory = localSize;
  for (const entry of entries) {
    const checksum = crc32(entry.data);
    view.setUint32(offset, 0x04034b50, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, 0x0800, true);
    view.setUint16(offset + 12, 33, true); // 1980-01-01 (valid DOS ZIP date)
    view.setUint32(offset + 14, checksum, true);
    view.setUint32(offset + 18, entry.data.length, true);
    view.setUint32(offset + 22, entry.data.length, true);
    view.setUint16(offset + 26, entry.name.length, true);
    bytes.set(entry.name, offset + 30);
    bytes.set(entry.data, offset + 30 + entry.name.length);
    view.setUint32(directory, 0x02014b50, true);
    view.setUint16(directory + 4, 20, true);
    view.setUint16(directory + 6, 20, true);
    view.setUint16(directory + 8, 0x0800, true);
    view.setUint16(directory + 14, 33, true);
    view.setUint32(directory + 16, checksum, true);
    view.setUint32(directory + 20, entry.data.length, true);
    view.setUint32(directory + 24, entry.data.length, true);
    view.setUint16(directory + 28, entry.name.length, true);
    view.setUint32(directory + 42, offset, true);
    bytes.set(entry.name, directory + 46);
    offset += 30 + entry.name.length + entry.data.length;
    directory += 46 + entry.name.length;
  }
  view.setUint32(directory, 0x06054b50, true);
  view.setUint16(directory + 8, entries.length, true);
  view.setUint16(directory + 10, entries.length, true);
  view.setUint32(directory + 12, centralSize, true);
  view.setUint32(directory + 16, localSize, true);
  return bytes;
}

function columnName(index: number): string {
  let name = "";
  for (let column = index + 1; column > 0; column = Math.floor((column - 1) / 26)) {
    name = String.fromCharCode(65 + (column - 1) % 26) + name;
  }
  return name;
}

function cell(value: ReportCell, column: number, row: number, style: number): string {
  const attributes = `r="${columnName(column)}${row}" s="${style}"`;
  // All text is an inline string, never a formula, even if it starts with "=".
  return typeof value === "number" && Number.isFinite(value)
    ? `<c ${attributes}><v>${value}</v></c>`
    : `<c ${attributes} t="inlineStr"><is><t xml:space="preserve">${xml(String(value))}</t></is></c>`;
}

export function reportXlsx(report: DownloadableReport, exportedAt: string): Uint8Array<ArrayBuffer> {
  const main = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const relationships = "http://schemas.openxmlformats.org/package/2006/relationships";
  const documentRelationships = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const files: Record<string, string> = {
    "_rels/.rels": `<Relationships xmlns="${relationships}"><Relationship Id="rId1" Type="${documentRelationships}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/styles.xml": `<styleSheet xmlns="${main}">
      <numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>
      <fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts>
      <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1E3A5F"/><bgColor indexed="64"/></patternFill></fill></fills>
      <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
      <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
      <cellXfs count="4">${[
        [0, 0, 0], [0, 1, 2], [0, 2, 0], [164, 0, 0],
      ].map(([format, font, fill]) => `<xf numFmtId="${format}" fontId="${font}" fillId="${fill}" borderId="0" xfId="0" applyAlignment="1" applyNumberFormat="1"><alignment vertical="top" wrapText="1"/></xf>`).join("")}</cellXfs>
      <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
    </styleSheet>`,
  };
  report.tables.forEach((table, index) => {
    const rows: ReportCell[][] = [[report.title], [report.period], [`Exported at (UTC): ${exportedAt}`],
      [report.note ?? ""], [], table.headers, ...table.rows];
    if (!table.rows.length) rows.push(["No records for the selected period"]);
    const columns = table.headers.map((header, column) => {
      const width = Math.min(42, Math.max(16, header.length + 2,
        ...table.rows.slice(0, 100).map(row => Math.min(40, String(row[column] ?? "").length + 2))));
      return `<col min="${column + 1}" max="${column + 1}" width="${width}" customWidth="1"/>`;
    }).join("");
    files[`xl/worksheets/sheet${index + 1}.xml`] = `<worksheet xmlns="${main}">
      <sheetViews><sheetView workbookViewId="0"><pane ySplit="6" topLeftCell="A7" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
      <cols>${columns}</cols><sheetData>${rows.map((row, rowIndex) =>
        `<row r="${rowIndex + 1}">${row.map((value, column) => cell(value, column, rowIndex + 1,
          rowIndex === 0 ? 2 : rowIndex === 5 ? 1 : rowIndex > 5 && typeof value === "number" &&
          (table.headers[column]?.includes("(INR)") || (column === 1 && String(row[0]).includes("(INR)"))) ? 3 : 0)).join("")}</row>`,
      ).join("")}</sheetData>
      <autoFilter ref="A6:${columnName(table.headers.length - 1)}${Math.max(6, 6 + table.rows.length)}"/>
    </worksheet>`;
  });
  files["xl/workbook.xml"] = `<workbook xmlns="${main}" xmlns:r="${documentRelationships}"><sheets>${report.tables.map((table, index) =>
    `<sheet name="${xml(table.name.slice(0, 31))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
  ).join("")}</sheets></workbook>`;
  files["xl/_rels/workbook.xml.rels"] = `<Relationships xmlns="${relationships}">${report.tables.map((_, index) =>
    `<Relationship Id="rId${index + 1}" Type="${documentRelationships}/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
  ).join("")}<Relationship Id="styles" Type="${documentRelationships}/styles" Target="styles.xml"/></Relationships>`;
  files["[Content_Types].xml"] = `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
    <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
    ${report.tables.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}
  </Types>`;
  return zip(files);
}