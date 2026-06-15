import { createHash } from "crypto";
import {
  NOC_VALIDITY_DAYS,
  assertValidNocPurpose,
  evaluateNocEligibility,
  type NocBillSnapshot,
} from "@society/operations-core";
import { pdfToDataUrl, renderNocPdf } from "@/lib/noc-pdf";
import { prisma } from "@/lib/prisma";

function mapBill(bill: {
  id: string;
  period: string;
  dueDate: Date;
  status: string;
  amount: number;
  lateFee: number;
  gstAmount: number;
  totalAmount: number | null;
  paidAmount: number | null;
  description: string | null;
}): NocBillSnapshot {
  return {
    id: bill.id,
    period: bill.period,
    dueDate: bill.dueDate,
    status: bill.status,
    totalAmount: bill.totalAmount ?? bill.amount + bill.lateFee + bill.gstAmount,
    paidAmount: bill.paidAmount ?? 0,
    description: bill.description,
  };
}

async function nextCertificateNo(societyId: string, issuedAt: Date) {
  const year = issuedAt.getFullYear();
  const prefix = `NOC-${year}-`;
  const count = await prisma.societyNocRequest.count({
    where: {
      societyId,
      certificateNo: { startsWith: prefix },
    },
  });
  return `${prefix}${String(count + 1).padStart(5, "0")}`;
}

function buildVerificationHash(input: {
  id: string;
  societyId: string;
  flatId: string;
  certificateNo: string;
  issuedAt: Date;
}) {
  return createHash("sha256")
    .update(
      [input.id, input.societyId, input.flatId, input.certificateNo, input.issuedAt.toISOString()].join(
        ":",
      ),
    )
    .digest("hex");
}

export async function getFlatNocEligibility(societyId: string, flatId: string) {
  const bills = await prisma.maintenanceBill.findMany({
    where: {
      societyId,
      flatId,
      status: { in: ["pending", "partial"] },
    },
    select: {
      id: true,
      period: true,
      dueDate: true,
      status: true,
      amount: true,
      lateFee: true,
      gstAmount: true,
      totalAmount: true,
      paidAmount: true,
      description: true,
    },
    orderBy: { dueDate: "asc" },
  });

  return evaluateNocEligibility({ bills: bills.map(mapBill) });
}

export async function requestSocietyNoc(input: {
  societyId: string;
  flatId: string;
  requestedBy: string;
  requesterName: string;
  purpose: string;
  notes?: string | null;
}) {
  const purpose = assertValidNocPurpose(input.purpose);
  const now = new Date();

  const existing = await prisma.societyNocRequest.findFirst({
    where: {
      flatId: input.flatId,
      purpose,
      status: "issued",
      validUntil: { gt: now },
    },
    include: {
      flat: { select: { flatNumber: true, wing: true } },
      society: { select: { name: true, address: true, city: true, pincode: true } },
    },
    orderBy: { issuedAt: "desc" },
  });

  if (existing) {
    return {
      issued: true,
      reused: true,
      eligibility: evaluateNocEligibility({ bills: [] }),
      noc: existing,
    };
  }

  const eligibility = await getFlatNocEligibility(input.societyId, input.flatId);
  if (!eligibility.eligible) {
    return {
      issued: false,
      reused: false,
      eligibility,
      noc: null,
    };
  }

  const [flat, society] = await Promise.all([
    prisma.flat.findFirst({
      where: { id: input.flatId, societyId: input.societyId },
      select: { flatNumber: true, wing: true, ownerName: true, tenantName: true },
    }),
    prisma.society.findUnique({
      where: { id: input.societyId },
      select: { name: true, address: true, city: true, pincode: true },
    }),
  ]);

  if (!flat || !society) {
    throw new Error("Flat or society not found");
  }

  const issuedAt = now;
  const validUntil = new Date(issuedAt.getTime() + NOC_VALIDITY_DAYS * 86_400_000);
  const certificateNo = await nextCertificateNo(input.societyId, issuedAt);
  const residentName =
    input.requesterName || flat.ownerName || flat.tenantName || "Resident";

  const draft = await prisma.societyNocRequest.create({
    data: {
      societyId: input.societyId,
      flatId: input.flatId,
      requestedBy: input.requestedBy,
      requesterName: residentName,
      purpose,
      status: "issued",
      certificateNo,
      totalDuesAmount: 0,
      verificationHash: "pending",
      issuedAt,
      validUntil,
      notes: input.notes?.trim() || null,
    },
  });

  const verificationHash = buildVerificationHash({
    id: draft.id,
    societyId: input.societyId,
    flatId: input.flatId,
    certificateNo,
    issuedAt,
  });

  const pdfBytes = await renderNocPdf({
    societyName: society.name,
    societyAddress: `${society.address}, ${society.city} - ${society.pincode}`,
    flatNumber: flat.flatNumber,
    wing: flat.wing,
    residentName,
    purpose,
    certificateNo,
    verificationHash,
    issuedAt,
    validUntil,
  });

  const noc = await prisma.societyNocRequest.update({
    where: { id: draft.id },
    data: {
      verificationHash,
      pdfDataUrl: pdfToDataUrl(pdfBytes),
    },
    include: {
      flat: { select: { flatNumber: true, wing: true } },
      society: { select: { name: true } },
    },
  });

  return {
    issued: true,
    reused: false,
    eligibility,
    noc,
  };
}

export async function verifySocietyNoc(certificateNo: string, verificationCode?: string) {
  const noc = await prisma.societyNocRequest.findUnique({
    where: { certificateNo },
    include: {
      flat: { select: { flatNumber: true, wing: true } },
      society: { select: { name: true, city: true } },
    },
  });

  if (!noc || noc.status !== "issued") {
    return { valid: false as const, reason: "Certificate not found" };
  }

  if (noc.validUntil.getTime() < Date.now()) {
    return {
      valid: false as const,
      reason: "Certificate expired",
      certificateNo: noc.certificateNo,
      expiredAt: noc.validUntil,
    };
  }

  if (verificationCode) {
    const expected = noc.verificationHash.slice(0, 12).toUpperCase();
    if (verificationCode.trim().toUpperCase() !== expected) {
      return { valid: false as const, reason: "Verification code mismatch" };
    }
  }

  return {
    valid: true as const,
    certificateNo: noc.certificateNo,
    societyName: noc.society.name,
    flatNumber: noc.flat.wing ? `${noc.flat.wing}-${noc.flat.flatNumber}` : noc.flat.flatNumber,
    residentName: noc.requesterName,
    purpose: noc.purpose,
    issuedAt: noc.issuedAt,
    validUntil: noc.validUntil,
    verificationCode: noc.verificationHash.slice(0, 12).toUpperCase(),
  };
}

export async function listSocietyNocRequests(input: {
  societyId: string;
  requestedBy?: string;
  flatId?: string;
  limit?: number;
}) {
  return prisma.societyNocRequest.findMany({
    where: {
      societyId: input.societyId,
      ...(input.requestedBy ? { requestedBy: input.requestedBy } : {}),
      ...(input.flatId ? { flatId: input.flatId } : {}),
    },
    include: {
      flat: { select: { flatNumber: true, wing: true } },
    },
    orderBy: { issuedAt: "desc" },
    take: input.limit ?? 50,
  });
}
