import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type PrintableInvoiceFlat = {
  flatNumber: string;
  payerName: string;
  payerRole?: string | null;
};

export type PrintableInvoicePdfInput = {
  societyName: string;
  period: string;
  description: string;
  amount: number;
  dueDate: string;
  flats: PrintableInvoiceFlat[];
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;

export function buildPrintableInvoicePdfFilename(description: string, period: string) {
  const slug = (description || "custom-invoice")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "custom-invoice";
  return `${slug}-invoices-${period}.pdf`;
}

export async function renderPrintableInvoicePdf(input: PrintableInvoicePdfInput) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const amount = formatInr(input.amount);

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = drawHeader(page, bold, regular, input);

  for (const flat of input.flats) {
    if (y < 130) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = drawHeader(page, bold, regular, input);
    }
    y = drawInvoiceCard(page, regular, bold, y, { ...flat, amount, dueDate: input.dueDate, description: input.description, period: input.period });
  }

  if (input.flats.length === 0) {
    page.drawText("No flats selected.", { x: MARGIN, y, size: 11, font: regular, color: rgb(0.45, 0.45, 0.45) });
  }

  return pdf.save();
}

function drawHeader(page: PDFPage, bold: PDFFont, regular: PDFFont, input: PrintableInvoicePdfInput) {
  const societyLines = wrapText(input.societyName || "Society", bold, 18, PAGE_WIDTH - MARGIN * 2);
  let y = PAGE_HEIGHT - MARGIN;
  page.drawText("Printable Invoice Sheet", { x: MARGIN, y, size: 10, font: bold, color: rgb(1, 0.33, 0) });
  y -= 24;
  societyLines.slice(0, 3).forEach((line) => {
    page.drawText(line, { x: MARGIN, y, size: 18, font: bold, color: rgb(0.2, 0.2, 0.2) });
    y -= 22;
  });
  y -= 4;
  page.drawText(`${input.description || "Society Dues"} - ${input.period}`, {
    x: MARGIN,
    y,
    size: 11,
    font: regular,
    color: rgb(0.35, 0.35, 0.35),
  });
  y -= 18;
  page.drawText(`Due date: ${formatDate(input.dueDate)} - Amount per flat: ${formatInr(input.amount)}`, {
    x: MARGIN,
    y,
    size: 10,
    font: regular,
    color: rgb(0.35, 0.35, 0.35),
  });
  y -= 24;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1, color: rgb(0.86, 0.86, 0.86) });
  return y - 20;
}

function drawInvoiceCard(
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont,
  y: number,
  input: PrintableInvoiceFlat & { amount: string; dueDate: string; description: string; period: string },
) {
  const cardHeight = 84;
  const x = MARGIN;
  const width = PAGE_WIDTH - MARGIN * 2;

  page.drawRectangle({
    x,
    y: y - cardHeight,
    width,
    height: cardHeight,
    borderColor: rgb(0.82, 0.82, 0.82),
    borderWidth: 1,
    color: rgb(1, 1, 1),
  });
  page.drawText(`Flat ${input.flatNumber}`, { x: x + 14, y: y - 22, size: 13, font: bold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText(input.amount, { x: x + width - 120, y: y - 22, size: 13, font: bold, color: rgb(1, 0.33, 0) });
  page.drawText(`Bill to: ${input.payerName || "Resident"}${input.payerRole ? ` (${input.payerRole})` : ""}`, {
    x: x + 14,
    y: y - 43,
    size: 10,
    font: regular,
    color: rgb(0.35, 0.35, 0.35),
  });
  page.drawText(`${input.description} - ${input.period}`, { x: x + 14, y: y - 61, size: 10, font: regular, color: rgb(0.35, 0.35, 0.35) });
  page.drawText(`Due: ${formatDate(input.dueDate)}`, { x: x + width - 120, y: y - 61, size: 10, font: regular, color: rgb(0.35, 0.35, 0.35) });

  return y - cardHeight - 12;
}

function formatInr(value: number) {
  return `Rs. ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value)}`;
}

function formatDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [text];
}
