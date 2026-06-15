import {
  appendUtilityDescriptionLine,
  buildMeterReadingPreview,
  buildUtilityDescriptionLine,
  indexFlatsByNormalizedNumber,
  matchFlatNumber,
  mergeSocietyMeterRates,
  parseMeterReadingRows,
  stripUtilityDescriptionLine,
  summarizeMeterImport,
  type MeterReadingPreviewRow,
  type MeterType,
  type RawMeterRow,
  type SocietyMeterRates,
} from "@society/finance-core";
import { logCreated } from "@/lib/activity-log";
import { prisma } from "@/lib/prisma";

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

function billTotal(bill: { amount: number; lateFee: number; gstAmount: number; totalAmount: number | null }) {
  return roundMoney(bill.totalAmount ?? bill.amount + bill.lateFee + bill.gstAmount);
}

export async function getSocietyMeterRates(societyId: string): Promise<SocietyMeterRates> {
  const society = await prisma.society.findUnique({
    where: { id: societyId },
    select: { meterRatesJson: true },
  });
  if (!society?.meterRatesJson) {
    return mergeSocietyMeterRates(null);
  }

  try {
    const parsed = JSON.parse(society.meterRatesJson) as Partial<SocietyMeterRates>;
    return mergeSocietyMeterRates(parsed);
  } catch {
    return mergeSocietyMeterRates(null);
  }
}

export async function previewMeterReadingImport(input: {
  societyId: string;
  period: string;
  meterType: MeterType;
  rawRows: RawMeterRow[];
}) {
  const [rates, flats] = await Promise.all([
    getSocietyMeterRates(input.societyId),
    prisma.flat.findMany({
      where: { societyId: input.societyId, isActive: true },
      select: { id: true, flatNumber: true },
      orderBy: { flatNumber: "asc" },
    }),
  ]);

  const flatsByNumber = indexFlatsByNormalizedNumber(flats);
  const parsedRows = parseMeterReadingRows(input.rawRows, input.meterType);
  const previewRows = buildMeterReadingPreview({
    rows: parsedRows,
    meterType: input.meterType,
    rates,
  });

  const bills = await prisma.maintenanceBill.findMany({
    where: {
      societyId: input.societyId,
      period: input.period,
      billType: "maintenance",
      billingCycle: "monthly",
    },
    select: {
      id: true,
      flatId: true,
      status: true,
      paidAmount: true,
      invoiceId: true,
    },
  });
  const billByFlatId = new Map(bills.map((bill) => [bill.flatId, bill]));

  const rows = previewRows.map((row) => {
    const flat = matchFlatNumber(row.flatNumber, flatsByNumber);
    const bill = flat ? billByFlatId.get(flat.id) : undefined;
    const canApply =
      row.errors.length === 0 &&
      Boolean(flat) &&
      Boolean(bill) &&
      bill?.status === "pending" &&
      !bill?.invoiceId &&
      !(bill?.paidAmount && bill.paidAmount > 0);

    let applyStatus: "ready" | "invalid" | "flat_not_found" | "bill_missing" | "bill_locked" = "ready";
    if (row.errors.length > 0) applyStatus = "invalid";
    else if (!flat) applyStatus = "flat_not_found";
    else if (!bill) applyStatus = "bill_missing";
    else if (!canApply) applyStatus = "bill_locked";

    return {
      ...row,
      flatId: flat?.id ?? null,
      billId: bill?.id ?? null,
      applyStatus,
    };
  });

  const summary = summarizeMeterImport(previewRows);
  const readyRows = rows.filter((row) => row.applyStatus === "ready").length;

  return {
    period: input.period,
    meterType: input.meterType,
    rates,
    summary: {
      ...summary,
      readyRows,
      flatNotFoundRows: rows.filter((row) => row.applyStatus === "flat_not_found").length,
      billMissingRows: rows.filter((row) => row.applyStatus === "bill_missing").length,
      billLockedRows: rows.filter((row) => row.applyStatus === "bill_locked").length,
    },
    rows,
  };
}

async function applyUtilityToBill(input: {
  billId: string;
  societyId: string;
  meterType: MeterType;
  chargeAmount: number;
  utilityLine: string;
  previousChargeAmount: number;
}) {
  const bill = await prisma.maintenanceBill.findFirst({
    where: { id: input.billId, societyId: input.societyId },
  });
  if (!bill) throw new Error("Bill not found");

  if (bill.status !== "pending" || bill.invoiceId || (bill.paidAmount ?? 0) > 0) {
    throw new Error("Bill is locked for utility updates");
  }

  const strippedDescription = stripUtilityDescriptionLine(bill.description, input.meterType);
  const nextDescription = appendUtilityDescriptionLine(
    strippedDescription,
    input.meterType,
    input.utilityLine,
  );
  const baseAmount = roundMoney(bill.amount - input.previousChargeAmount);
  const nextAmount = roundMoney(baseAmount + input.chargeAmount);
  const nextTotal = roundMoney(nextAmount + bill.lateFee + bill.gstAmount);

  return prisma.maintenanceBill.update({
    where: { id: bill.id },
    data: {
      amount: nextAmount,
      totalAmount: nextTotal,
      description: nextDescription,
    },
  });
}

export async function applyMeterReadingImport(input: {
  societyId: string;
  period: string;
  meterType: MeterType;
  fileName?: string | null;
  importedBy?: string | null;
  rawRows: RawMeterRow[];
}) {
  const preview = await previewMeterReadingImport({
    societyId: input.societyId,
    period: input.period,
    meterType: input.meterType,
    rawRows: input.rawRows,
  });

  const session = await prisma.meterReadingImportSession.create({
    data: {
      societyId: input.societyId,
      period: input.period,
      meterType: input.meterType,
      fileName: input.fileName || null,
      status: "preview",
      totalRows: preview.rows.length,
      importedBy: input.importedBy || null,
    },
  });

  let appliedRows = 0;
  let skippedRows = 0;
  let totalCharge = 0;
  const results: Array<{ rowIndex: number; status: string; message?: string }> = [];

  for (const row of preview.rows) {
    if (row.applyStatus !== "ready" || !row.flatId || !row.billId) {
      skippedRows += 1;
      const skipMessage =
        row.applyStatus === "flat_not_found"
          ? "Flat not found"
          : row.applyStatus === "bill_missing"
            ? "No pending maintenance bill for this period"
            : row.applyStatus === "bill_locked"
              ? "Bill already has payments or invoice"
              : row.errors.join("; ") || "Invalid row";

      if (row.flatId) {
        await prisma.meterReading.create({
          data: {
            societyId: input.societyId,
            flatId: row.flatId,
            importSessionId: session.id,
            period: input.period,
            meterType: row.meterType,
            rowIndex: row.rowIndex,
            flatNumber: row.flatNumber,
            previousReading: row.previousReading,
            currentReading: row.currentReading,
            unitsConsumed: row.unitsConsumed,
            ratePerUnit: preview.rates[row.meterType].ratePerUnit,
            chargeAmount: row.chargeAmount,
            billId: row.billId,
            status: "skipped",
            errorMessage: skipMessage,
          },
        });
      }

      results.push({
        rowIndex: row.rowIndex,
        status: "skipped",
        message: skipMessage,
      });
      continue;
    }

    const existing = await prisma.meterReading.findUnique({
      where: {
        societyId_flatId_period_meterType: {
          societyId: input.societyId,
          flatId: row.flatId,
          period: input.period,
          meterType: row.meterType,
        },
      },
    });

    const utilityLine = buildUtilityDescriptionLine({
      meterType: row.meterType,
      unitsConsumed: row.unitsConsumed,
      chargeAmount: row.chargeAmount,
      ratePerUnit: preview.rates[row.meterType].ratePerUnit,
    });

    try {
      await applyUtilityToBill({
        billId: row.billId,
        societyId: input.societyId,
        meterType: row.meterType,
        chargeAmount: row.chargeAmount,
        utilityLine,
        previousChargeAmount: existing?.chargeAmount ?? 0,
      });

      await prisma.meterReading.upsert({
        where: {
          societyId_flatId_period_meterType: {
            societyId: input.societyId,
            flatId: row.flatId,
            period: input.period,
            meterType: row.meterType,
          },
        },
        create: {
          societyId: input.societyId,
          flatId: row.flatId,
          importSessionId: session.id,
          period: input.period,
          meterType: row.meterType,
          rowIndex: row.rowIndex,
          flatNumber: row.flatNumber,
          previousReading: row.previousReading,
          currentReading: row.currentReading,
          unitsConsumed: row.unitsConsumed,
          ratePerUnit: preview.rates[row.meterType].ratePerUnit,
          chargeAmount: row.chargeAmount,
          billId: row.billId,
          status: "applied",
        },
        update: {
          importSessionId: session.id,
          rowIndex: row.rowIndex,
          flatNumber: row.flatNumber,
          previousReading: row.previousReading,
          currentReading: row.currentReading,
          unitsConsumed: row.unitsConsumed,
          ratePerUnit: preview.rates[row.meterType].ratePerUnit,
          chargeAmount: row.chargeAmount,
          billId: row.billId,
          status: "applied",
          errorMessage: null,
        },
      });

      appliedRows += 1;
      totalCharge = roundMoney(totalCharge + row.chargeAmount);
      results.push({ rowIndex: row.rowIndex, status: "applied" });
    } catch (error) {
      skippedRows += 1;
      const message = error instanceof Error ? error.message : "Failed to apply reading";
      await prisma.meterReading.create({
        data: {
          societyId: input.societyId,
          flatId: row.flatId,
          importSessionId: session.id,
          period: input.period,
          meterType: row.meterType,
          rowIndex: row.rowIndex,
          flatNumber: row.flatNumber,
          previousReading: row.previousReading,
          currentReading: row.currentReading,
          unitsConsumed: row.unitsConsumed,
          ratePerUnit: preview.rates[row.meterType].ratePerUnit,
          chargeAmount: row.chargeAmount,
          billId: row.billId,
          status: "error",
          errorMessage: message,
        },
      });
      results.push({ rowIndex: row.rowIndex, status: "error", message });
    }
  }

  const updatedSession = await prisma.meterReadingImportSession.update({
    where: { id: session.id },
    data: {
      status: appliedRows > 0 ? "applied" : "failed",
      appliedRows,
      skippedRows,
      totalCharge,
      appliedAt: appliedRows > 0 ? new Date() : null,
    },
  });

  if (appliedRows > 0) {
    await logCreated("maintenance", session.id, `Imported ${appliedRows} meter readings`, {
      period: input.period,
      meterType: input.meterType,
      totalCharge,
    });
  }

  return {
    session: updatedSession,
    preview,
    results,
  };
}

export async function listMeterReadingSessions(societyId: string, period?: string) {
  return prisma.meterReadingImportSession.findMany({
    where: {
      societyId,
      ...(period ? { period } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      readings: {
        orderBy: { rowIndex: "asc" },
        take: 200,
      },
    },
  });
}

export type MeterReadingPreviewResult = Awaited<ReturnType<typeof previewMeterReadingImport>>;
export type MeterReadingPreviewRowWithStatus = MeterReadingPreviewResult["rows"][number];
