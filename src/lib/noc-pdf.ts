import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { buildNocVerificationCode, nocPurposeLabel } from "@society/operations-core";

export type NocPdfInput = {
  societyName: string;
  societyAddress: string;
  flatNumber: string;
  wing?: string | null;
  residentName: string;
  purpose: string;
  certificateNo: string;
  verificationHash: string;
  issuedAt: Date;
  validUntil: Date;
};

function wrapLines(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function renderNocPdf(input: NocPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  let y = 780;

  const draw = (text: string, size: number, bold = false, color = rgb(0.1, 0.1, 0.1)) => {
    page.drawText(text, {
      x: margin,
      y,
      size,
      font: bold ? fontBold : font,
      color,
    });
    y -= size + 8;
  };

  page.drawText(input.societyName.toUpperCase(), {
    x: margin,
    y,
    size: 18,
    font: fontBold,
    color: rgb(0.05, 0.25, 0.55),
  });
  y -= 28;

  for (const line of wrapLines(input.societyAddress, 80)) {
    draw(line, 10);
  }

  y -= 10;
  draw("NO OBJECTION CERTIFICATE", 14, true);
  draw(`Certificate No: ${input.certificateNo}`, 10);
  draw(`Issued: ${formatDate(input.issuedAt)}`, 10);
  draw(`Valid until: ${formatDate(input.validUntil)}`, 10);

  y -= 8;
  draw("To Whom It May Concern,", 11, true);

  const flatLabel = input.wing ? `${input.wing}-${input.flatNumber}` : input.flatNumber;
  const body = [
    `This is to certify that ${input.residentName}, resident of Flat ${flatLabel} in ${input.societyName},`,
    `has no outstanding maintenance dues with the society as on ${formatDate(input.issuedAt)}.`,
    `This certificate is issued for the purpose of: ${nocPurposeLabel(input.purpose)}.`,
    "The management committee has no objection to the above request, subject to society bylaws and applicable regulations.",
  ].join(" ");

  for (const line of wrapLines(body, 95)) {
    draw(line, 11);
  }

  y -= 12;
  draw("Verification", 11, true);
  draw(`Verification code: ${buildNocVerificationCode(input.verificationHash)}`, 10);
  draw(`Verify at your society office or via ReManage using certificate ${input.certificateNo}.`, 10);

  y -= 24;
  draw("Digitally issued via ReManage — no physical signature required.", 9, false, rgb(0.35, 0.35, 0.35));

  page.drawLine({
    start: { x: 360, y: 120 },
    end: { x: 520, y: 120 },
    thickness: 1,
    color: rgb(0.2, 0.2, 0.2),
  });
  page.drawText("Authorised Signatory", {
    x: 380,
    y: 100,
    size: 9,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });
  page.drawText("Management Committee", {
    x: 372,
    y: 88,
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

function formatDate(date: Date) {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
