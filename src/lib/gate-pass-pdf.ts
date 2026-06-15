import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type GatePassPdfInput = {
  societyName: string;
  societyAddress: string;
  flatNumber: string;
  wing?: string | null;
  residentName: string;
  moveType: string;
  gatePassCode: string;
  scheduledMoveDate: Date;
  issuedAt: Date;
};

function formatDate(date: Date) {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function renderGatePassPdf(input: GatePassPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const flatLabel = input.wing ? `${input.wing}-${input.flatNumber}` : input.flatNumber;
  const moveLabel = input.moveType === "move_out" ? "MOVE-OUT" : "MOVE-IN";

  page.drawText(input.societyName.toUpperCase(), {
    x: 50,
    y: 760,
    size: 16,
    font: fontBold,
    color: rgb(0.05, 0.25, 0.55),
  });
  page.drawText(input.societyAddress, { x: 50, y: 740, size: 9, font, color: rgb(0.35, 0.35, 0.35) });

  page.drawText("GATE PASS", {
    x: 50,
    y: 690,
    size: 22,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  page.drawText(`${moveLabel} · Flat ${flatLabel}`, { x: 50, y: 665, size: 12, font: fontBold });

  const lines = [
    `Resident: ${input.residentName}`,
    `Scheduled date: ${formatDate(input.scheduledMoveDate)}`,
    `Issued: ${formatDate(input.issuedAt)}`,
    "",
    "Present this pass at the society gate. Security will verify the code below.",
  ];
  let y = 620;
  for (const line of lines) {
    page.drawText(line, { x: 50, y, size: 11, font });
    y -= 18;
  }

  page.drawRectangle({
    x: 50,
    y: 480,
    width: 495,
    height: 100,
    borderColor: rgb(0.05, 0.25, 0.55),
    borderWidth: 2,
    color: rgb(0.95, 0.97, 1),
  });
  page.drawText("ENTRY CODE", { x: 70, y: 545, size: 10, font: fontBold, color: rgb(0.35, 0.35, 0.35) });
  page.drawText(input.gatePassCode, {
    x: 70,
    y: 500,
    size: 36,
    font: fontBold,
    color: rgb(0.05, 0.25, 0.55),
  });

  page.drawText("Digitally issued via ReManage after manager approval.", {
    x: 50,
    y: 440,
    size: 9,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });

  return pdf.save();
}

export function pdfToDataUrl(bytes: Uint8Array) {
  return `data:application/pdf;base64,${Buffer.from(bytes).toString("base64")}`;
}

export function pdfFromDataUrl(dataUrl: string): Buffer | null {
  const match = /^data:application\/pdf;base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  try {
    return Buffer.from(match[1], "base64");
  } catch {
    return null;
  }
}
