import {
  assertDuesEnforcementAllows,
  evaluateDuesEnforcement,
  type DuesBillSnapshot,
  type DuesEnforcementEvaluation,
  type DuesEnforcementFeature,
} from "../../operations-core/src/dues-enforcement.ts";
import { prisma } from "./prisma.ts";

export interface FlatDuesEnforcementInput {
  societyId: string;
  flatId: string;
  now?: Date;
  feature?: DuesEnforcementFeature;
}

function mapBillSnapshot(bill: {
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
}): DuesBillSnapshot {
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

export async function getFlatDuesEnforcement(
  input: FlatDuesEnforcementInput,
): Promise<DuesEnforcementEvaluation> {
  const now = input.now ?? new Date();

  const [society, bills] = await Promise.all([
    prisma.society.findUnique({
      where: { id: input.societyId },
      select: {
        duesEnforcementEnabled: true,
        duesEnforcementDays: true,
      },
    }),
    prisma.maintenanceBill.findMany({
      where: {
        societyId: input.societyId,
        flatId: input.flatId,
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
    }),
  ]);

  if (!society) {
    throw new Error(`Society ${input.societyId} not found.`);
  }

  const evaluation = evaluateDuesEnforcement({
    bills: bills.map(mapBillSnapshot),
    now,
    enabled: society.duesEnforcementEnabled,
    maxOverdueDays: society.duesEnforcementDays,
    feature: input.feature,
  });

  return evaluation;
}

export async function assertFlatDuesClear(input: {
  societyId: string;
  flatId: string;
  now?: Date;
  feature: DuesEnforcementFeature;
}): Promise<DuesEnforcementEvaluation> {
  const evaluation = await getFlatDuesEnforcement({
    societyId: input.societyId,
    flatId: input.flatId,
    now: input.now,
    feature: input.feature,
  });

  assertDuesEnforcementAllows({ evaluation, feature: input.feature });
  return evaluation;
}

export async function assertFlatNumberDuesClear(input: {
  societyId: string;
  flatNumber: string;
  now?: Date;
  feature: DuesEnforcementFeature;
}): Promise<DuesEnforcementEvaluation> {
  const flat = await prisma.flat.findFirst({
    where: { societyId: input.societyId, flatNumber: input.flatNumber },
    select: { id: true },
  });

  if (!flat) {
    throw new Error(`Flat ${input.flatNumber} not found in society ${input.societyId}.`);
  }

  return assertFlatDuesClear({
    societyId: input.societyId,
    flatId: flat.id,
    now: input.now,
    feature: input.feature,
  });
}

export async function getFlatDuesEnforcementByFlatNumber(input: {
  societyId: string;
  flatNumber: string;
  now?: Date;
  feature?: DuesEnforcementFeature;
}): Promise<DuesEnforcementEvaluation | null> {
  const flat = await prisma.flat.findFirst({
    where: { societyId: input.societyId, flatNumber: input.flatNumber },
    select: { id: true },
  });

  if (!flat) {
    return null;
  }

  return getFlatDuesEnforcement({
    societyId: input.societyId,
    flatId: flat.id,
    now: input.now,
    feature: input.feature,
  });
}
