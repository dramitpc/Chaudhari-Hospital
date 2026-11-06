import { PDFDocument } from "pdf-lib";

export const A4_WIDTH = 595.28;
export const A4_HEIGHT = 841.89;

export async function pdfPageCount(pdf: Blob): Promise<number> {
  return (await PDFDocument.load(await pdf.arrayBuffer())).getPageCount();
}

/** Keep every rendered page's vector content, fitted onto one portrait A4 sheet. */
export async function imposeOnSingleA4(pdf: Blob): Promise<Blob> {
  const source = await PDFDocument.load(await pdf.arrayBuffer());
  const pages = source.getPages();
  if (!pages.length) throw new Error("The prescription PDF has no pages.");
  if (pages.length === 1 && Math.abs(pages[0].getWidth() - A4_WIDTH) < 0.5 &&
      Math.abs(pages[0].getHeight() - A4_HEIGHT) < 0.5) return pdf;

  const output = await PDFDocument.create();
  if (source.getTitle()) output.setTitle(source.getTitle()!);
  if (source.getAuthor()) output.setAuthor(source.getAuthor()!);
  output.setCreator("ClinicOS");
  const margin = 18;
  const gap = Math.min(4, (A4_HEIGHT - margin * 2) / (pages.length * 4));
  const height = A4_HEIGHT - margin * 2 - gap * (pages.length - 1);
  const scale = Math.min(
    (A4_WIDTH - margin * 2) / Math.max(...pages.map(page => page.getWidth())),
    height / pages.reduce((sum, page) => sum + page.getHeight(), 0),
  );
  const embedded = await output.embedPages(pages);
  const target = output.addPage([A4_WIDTH, A4_HEIGHT]);
  let y = A4_HEIGHT - margin;
  embedded.forEach((page, index) => {
    const width = pages[index].getWidth() * scale;
    const pageHeight = pages[index].getHeight() * scale;
    y -= pageHeight;
    target.drawPage(page, { x: (A4_WIDTH - width) / 2, y, width, height: pageHeight });
    y -= gap;
  });
  const bytes = await output.save();
  return new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], { type: "application/pdf" });
}
