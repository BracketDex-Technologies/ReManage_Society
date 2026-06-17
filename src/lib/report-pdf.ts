import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import { expenseCategoryLabel } from "@/lib/finance-categories";

export type ReportPdfType = "monthly" | "annual" | "financial";

export type ReportPdfInput = {
  societyName: string;
  type: ReportPdfType;
  periodLabel: string;
  generatedAt?: Date;
  monthly?: {
    summary: {
      totalFlats: number;
      activeFlats: number;
      vacantFlats: number;
      billsGenerated: number;
      paid: number;
      pending: number;
      totalCollected: number;
      totalPending: number;
      collectionRate: number;
    };
    paymentMethodBreakdown: Array<{ method: string; count: number; amount: number }>;
    pendingFlats: Array<{ flatNumber: string; ownerName: string; contact: string; amount: number }>;
  };
  annual?: {
    year: number;
    months: Array<{ period: string; month: string; generated: number; collected: number; pending: number; rate: number }>;
    totals: { generated: number; collected: number; pending: number; rate: number };
  };
  financial?: {
    income: { maintenance: number; marketplace: number; other: number; total: number };
    expenses: { total: number; byCategory: Record<string, number> };
    profitOrLoss: number;
  };
};

function formatInr(amount: number): string {
  return `Rs ${Math.round(amount).toLocaleString("en-IN")}`;
}

function formatPeriodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return period;
  return new Date(year, month - 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

type PdfWriter = {
  pdf: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  fontBold: PDFFont;
  y: number;
  margin: number;
  lineHeight: number;
};

function ensureSpace(writer: PdfWriter, needed = 24) {
  if (writer.y >= needed) return;
  writer.page = writer.pdf.addPage([595, 842]);
  writer.y = 780;
}

function drawText(writer: PdfWriter, text: string, size = 10, bold = false, indent = 0) {
  ensureSpace(writer, size + 20);
  writer.page.drawText(text, {
    x: writer.margin + indent,
    y: writer.y,
    size,
    font: bold ? writer.fontBold : writer.font,
    color: rgb(0.1, 0.1, 0.1),
  });
  writer.y -= size + writer.lineHeight;
}

function drawSectionTitle(writer: PdfWriter, title: string) {
  writer.y -= 6;
  drawText(writer, title, 12, true);
  writer.page.drawLine({
    start: { x: writer.margin, y: writer.y + 4 },
    end: { x: 545, y: writer.y + 4 },
    thickness: 0.5,
    color: rgb(0.85, 0.85, 0.85),
  });
  writer.y -= 4;
}

function drawKeyValue(writer: PdfWriter, label: string, value: string) {
  drawText(writer, `${label}: ${value}`, 10);
}

function drawTableRow(writer: PdfWriter, columns: string[], bold = false) {
  const widths = [120, 110, 110, 110, 70];
  let x = writer.margin;
  ensureSpace(writer, 18);
  const y = writer.y;
  columns.forEach((col, index) => {
    writer.page.drawText(col.slice(0, 28), {
      x,
      y,
      size: 9,
      font: bold ? writer.fontBold : writer.font,
      color: rgb(0.1, 0.1, 0.1),
    });
    x += widths[index] ?? 100;
  });
  writer.y -= 16;
}

function renderMonthly(writer: PdfWriter, data: NonNullable<ReportPdfInput["monthly"]>) {
  drawSectionTitle(writer, "Collection Summary");
  drawKeyValue(writer, "Total flats", String(data.summary.totalFlats));
  drawKeyValue(writer, "Active / billable flats", String(data.summary.activeFlats));
  drawKeyValue(writer, "Invoices generated", String(data.summary.billsGenerated));
  drawKeyValue(writer, "Collected", formatInr(data.summary.totalCollected));
  drawKeyValue(writer, "Pending", formatInr(data.summary.totalPending));
  drawKeyValue(writer, "Collection rate", `${data.summary.collectionRate}%`);

  if (data.paymentMethodBreakdown.length > 0) {
    drawSectionTitle(writer, "Payment Methods");
    drawTableRow(writer, ["Method", "Count", "Amount", "", ""], true);
    for (const method of data.paymentMethodBreakdown) {
      drawTableRow(writer, [
        method.method.toUpperCase(),
        String(method.count),
        formatInr(method.amount),
        "",
        "",
      ]);
    }
  }

  if (data.pendingFlats.length > 0) {
    drawSectionTitle(writer, "Pending Flats");
    drawTableRow(writer, ["Flat", "Owner", "Contact", "Amount", ""], true);
    for (const flat of data.pendingFlats.slice(0, 40)) {
      drawTableRow(writer, [
        flat.flatNumber,
        flat.ownerName,
        flat.contact || "-",
        formatInr(flat.amount),
        "",
      ]);
    }
    if (data.pendingFlats.length > 40) {
      drawText(writer, `... and ${data.pendingFlats.length - 40} more pending flats`, 9);
    }
  }
}

function renderAnnual(writer: PdfWriter, data: NonNullable<ReportPdfInput["annual"]>) {
  drawSectionTitle(writer, "Annual Totals");
  drawKeyValue(writer, "Generated", formatInr(data.totals.generated));
  drawKeyValue(writer, "Collected", formatInr(data.totals.collected));
  drawKeyValue(writer, "Pending", formatInr(data.totals.pending));
  drawKeyValue(writer, "Overall rate", `${data.totals.rate}%`);

  drawSectionTitle(writer, "Monthly Breakdown");
  drawTableRow(writer, ["Month", "Generated", "Collected", "Pending", "Rate"], true);
  for (const month of data.months.filter((entry) => entry.generated > 0)) {
    drawTableRow(writer, [
      month.month,
      formatInr(month.generated),
      formatInr(month.collected),
      formatInr(month.pending),
      `${month.rate}%`,
    ]);
  }
}

function renderFinancial(writer: PdfWriter, data: NonNullable<ReportPdfInput["financial"]>) {
  drawSectionTitle(writer, "Profit & Loss Summary");
  drawKeyValue(writer, "Total income", formatInr(data.income.total));
  drawKeyValue(writer, "Total expenses", formatInr(data.expenses.total));
  drawKeyValue(
    writer,
    "Net profit / loss",
    `${data.profitOrLoss >= 0 ? "+" : ""}${formatInr(data.profitOrLoss)}`,
  );

  drawSectionTitle(writer, "Income Breakdown");
  drawKeyValue(writer, "Maintenance collection", formatInr(data.income.maintenance));
  drawKeyValue(writer, "Marketplace & amenities", formatInr(data.income.marketplace));
  drawKeyValue(writer, "Other receipts", formatInr(data.income.other));

  const categories = Object.entries(data.expenses.byCategory || {})
    .filter(([, amount]) => amount > 0)
    .sort(([, a], [, b]) => b - a);

  if (categories.length > 0) {
    drawSectionTitle(writer, "Expense Breakdown");
    drawTableRow(writer, ["Category", "Amount", "", "", ""], true);
    for (const [category, amount] of categories) {
      drawTableRow(writer, [expenseCategoryLabel(category), formatInr(amount), "", "", ""]);
    }
  }
}

export async function renderReportPdf(input: ReportPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const generatedAt = input.generatedAt ?? new Date();

  const writer: PdfWriter = {
    pdf,
    page,
    font,
    fontBold,
    y: 780,
    margin: 50,
    lineHeight: 6,
  };

  const reportTitle =
    input.type === "monthly"
      ? "Monthly Collection Report"
      : input.type === "annual"
        ? "Annual Summary Report"
        : "Income & Expense Report";

  writer.page.drawText(input.societyName.toUpperCase(), {
    x: writer.margin,
    y: writer.y,
    size: 16,
    font: fontBold,
    color: rgb(0.05, 0.25, 0.55),
  });
  writer.y -= 28;

  drawText(writer, reportTitle, 14, true);
  drawText(writer, `Period: ${input.periodLabel}`, 11);
  drawText(
    writer,
    `Generated: ${generatedAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`,
    9,
  );
  writer.y -= 8;

  if (input.type === "monthly" && input.monthly) {
    renderMonthly(writer, input.monthly);
  } else if (input.type === "annual" && input.annual) {
    renderAnnual(writer, input.annual);
  } else if (input.type === "financial" && input.financial) {
    renderFinancial(writer, input.financial);
  } else {
    drawText(writer, "No report data available for export.", 11, true);
  }

  writer.page.drawText("Generated via ReManage Society", {
    x: writer.margin,
    y: 40,
    size: 8,
    font,
    color: rgb(0.45, 0.45, 0.45),
  });

  return pdf.save();
}

export function buildReportPdfFilename(type: ReportPdfType, period: string): string {
  if (type === "annual") return `annual-report-${period}.pdf`;
  if (type === "financial") return `financial-report-${period}.pdf`;
  return `monthly-report-${period}.pdf`;
}

export function buildReportPeriodLabel(type: ReportPdfType, period: string): string {
  if (type === "annual") return String(period);
  if (type === "financial" || type === "monthly") return formatPeriodLabel(period);
  return period;
}
