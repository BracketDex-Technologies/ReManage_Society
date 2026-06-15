export const SUPPORTED_METER_TYPES = [
  "water",
  "electricity_grid",
  "electricity_dg",
  "gas",
] as const;

export type MeterType = (typeof SUPPORTED_METER_TYPES)[number];

export interface MeterRateTier {
  upTo: number | null;
  ratePerUnit: number;
}

export interface MeterRateConfig {
  flatRate?: number;
  ratePerUnit: number;
  tiers?: MeterRateTier[];
}

export type SocietyMeterRates = Record<MeterType, MeterRateConfig>;

export const DEFAULT_METER_RATES: SocietyMeterRates = {
  water: {
    flatRate: 0,
    ratePerUnit: 8,
    tiers: [
      { upTo: 100, ratePerUnit: 8 },
      { upTo: null, ratePerUnit: 12 },
    ],
  },
  electricity_grid: { flatRate: 0, ratePerUnit: 6.5, tiers: [] },
  electricity_dg: { flatRate: 0, ratePerUnit: 18, tiers: [] },
  gas: { flatRate: 0, ratePerUnit: 45, tiers: [] },
};

export interface RawMeterRow {
  rowIndex: number;
  values: Record<string, string>;
}

export interface ParsedMeterReadingRow {
  rowIndex: number;
  flatNumber: string;
  previousReading: number;
  currentReading: number;
  meterType?: MeterType;
}

export interface MeterReadingPreviewRow {
  rowIndex: number;
  flatNumber: string;
  normalizedFlatNumber: string;
  previousReading: number;
  currentReading: number;
  unitsConsumed: number;
  chargeAmount: number;
  meterType: MeterType;
  errors: string[];
}

export interface FlatLookupEntry {
  id: string;
  flatNumber: string;
}

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function pickValue(values: Record<string, string>, aliases: string[]) {
  for (const [key, raw] of Object.entries(values)) {
    const normalized = normalizeHeader(key);
    if (aliases.some((alias) => normalized === alias)) {
      return String(raw ?? "").trim();
    }
  }

  for (const [key, raw] of Object.entries(values)) {
    const normalized = normalizeHeader(key);
    if (aliases.some((alias) => normalized.includes(alias))) {
      return String(raw ?? "").trim();
    }
  }

  return "";
}

function parseNumber(value: string) {
  const cleaned = value.replace(/[,₹\s]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeFlatNumber(value: string) {
  return value.trim().replace(/[\s\-_/]+/g, "").toUpperCase();
}

export function normalizeMeterType(value: string | undefined, fallback: MeterType): MeterType {
  const normalized = (value ?? fallback).trim().toLowerCase().replace(/[\s-]+/g, "_");
  const aliases: Record<string, MeterType> = {
    water: "water",
    w: "water",
    electricity: "electricity_grid",
    electricity_grid: "electricity_grid",
    grid: "electricity_grid",
    eb: "electricity_grid",
    dg: "electricity_dg",
    electricity_dg: "electricity_dg",
    generator: "electricity_dg",
    gen: "electricity_dg",
    gas: "gas",
    piped_gas: "gas",
    lpg: "gas",
  };

  const mapped = aliases[normalized];
  if (mapped) return mapped;

  if (SUPPORTED_METER_TYPES.includes(normalized as MeterType)) {
    return normalized as MeterType;
  }

  return fallback;
}

export function meterTypeLabel(type: MeterType) {
  switch (type) {
    case "water":
      return "Water";
    case "electricity_grid":
      return "Electricity (Grid)";
    case "electricity_dg":
      return "Electricity (DG/Generator)";
    case "gas":
      return "Piped Gas";
    default:
      return type;
  }
}

export function parseMeterReadingRows(
  rows: RawMeterRow[],
  defaultMeterType: MeterType,
): ParsedMeterReadingRow[] {
  const parsed: ParsedMeterReadingRow[] = [];

  for (const row of rows) {
    const flatNumber =
      pickValue(row.values, ["flat", "flat number", "flat no", "unit", "unit no", "apt"]) ||
      row.values.flat_number ||
      row.values.flatNumber ||
      "";
    const previousValue = pickValue(row.values, [
      "previous reading",
      "prev reading",
      "opening reading",
      "old reading",
      "last reading",
    ]);
    const currentValue =
      pickValue(row.values, [
        "current reading",
        "present reading",
        "closing reading",
        "new reading",
      ]) ||
      pickValue(
        Object.fromEntries(
          Object.entries(row.values).filter(
            ([key]) => !normalizeHeader(key).match(/previous|prev|opening|old|last/),
          ),
        ),
        ["reading"],
      );
    const meterTypeValue = pickValue(row.values, ["meter type", "utility", "type", "service"]);

    if (!flatNumber && !previousValue && !currentValue) continue;

    const previousReading = parseNumber(previousValue);
    const currentReading = parseNumber(currentValue);
    if (!flatNumber || previousReading === null || currentReading === null) continue;

    parsed.push({
      rowIndex: row.rowIndex,
      flatNumber: flatNumber.trim(),
      previousReading,
      currentReading,
      meterType: normalizeMeterType(meterTypeValue || undefined, defaultMeterType),
    });
  }

  return parsed;
}

export function calculateMeterUsage(previousReading: number, currentReading: number) {
  if (currentReading < previousReading) {
    throw new Error("Current reading cannot be less than previous reading.");
  }
  return roundMoney(currentReading - previousReading);
}

export function calculateMeterCharge(unitsConsumed: number, config: MeterRateConfig) {
  if (unitsConsumed < 0) {
    throw new Error("Units consumed cannot be negative.");
  }

  let charge = roundMoney(config.flatRate ?? 0);
  const tiers =
    config.tiers && config.tiers.length > 0
      ? config.tiers
      : [{ upTo: null as number | null, ratePerUnit: config.ratePerUnit }];

  let remaining = unitsConsumed;
  let lowerBound = 0;

  for (const tier of tiers) {
    if (remaining <= 0) break;
    const tierCap = tier.upTo === null ? remaining : Math.max(0, tier.upTo - lowerBound);
    const tierUnits = Math.min(remaining, tierCap);
    if (tierUnits <= 0) continue;
    charge = roundMoney(charge + tierUnits * tier.ratePerUnit);
    remaining = roundMoney(remaining - tierUnits);
    lowerBound = tier.upTo ?? lowerBound + tierUnits;
  }

  return roundMoney(charge);
}

export function utilityDescriptionTag(meterType: MeterType) {
  return `[UTILITY:${meterType}]`;
}

export function buildUtilityDescriptionLine(input: {
  meterType: MeterType;
  unitsConsumed: number;
  chargeAmount: number;
  ratePerUnit?: number | null;
}) {
  const label = meterTypeLabel(input.meterType);
  const rateHint =
    input.ratePerUnit && input.ratePerUnit > 0
      ? `@ ₹${input.ratePerUnit}`
      : "";
  return `${utilityDescriptionTag(input.meterType)} ${label}: ${input.unitsConsumed} units ${rateHint} = ₹${input.chargeAmount.toLocaleString("en-IN")}`;
}

export function stripUtilityDescriptionLine(description: string | null | undefined, meterType: MeterType) {
  const tag = utilityDescriptionTag(meterType);
  const lines = (description || "")
    .split(/\r?\n|;\s*/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith(tag));

  return lines.join("; ");
}

export function appendUtilityDescriptionLine(
  description: string | null | undefined,
  meterType: MeterType,
  line: string,
) {
  const base = stripUtilityDescriptionLine(description, meterType);
  return base ? `${base}; ${line}` : line;
}

export function mergeSocietyMeterRates(input?: Partial<SocietyMeterRates> | null): SocietyMeterRates {
  return {
    water: { ...DEFAULT_METER_RATES.water, ...(input?.water ?? {}) },
    electricity_grid: { ...DEFAULT_METER_RATES.electricity_grid, ...(input?.electricity_grid ?? {}) },
    electricity_dg: { ...DEFAULT_METER_RATES.electricity_dg, ...(input?.electricity_dg ?? {}) },
    gas: { ...DEFAULT_METER_RATES.gas, ...(input?.gas ?? {}) },
  };
}

export function buildMeterReadingPreview(input: {
  rows: ParsedMeterReadingRow[];
  meterType: MeterType;
  rates: SocietyMeterRates;
}): MeterReadingPreviewRow[] {
  return input.rows.map((row) => {
    const meterType = row.meterType ?? input.meterType;
    const errors: string[] = [];
    let unitsConsumed = 0;
    let chargeAmount = 0;

    try {
      unitsConsumed = calculateMeterUsage(row.previousReading, row.currentReading);
      chargeAmount = calculateMeterCharge(unitsConsumed, input.rates[meterType]);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Invalid meter reading");
    }

    if (!row.flatNumber.trim()) {
      errors.push("Flat number is required");
    }

    return {
      rowIndex: row.rowIndex,
      flatNumber: row.flatNumber,
      normalizedFlatNumber: normalizeFlatNumber(row.flatNumber),
      previousReading: row.previousReading,
      currentReading: row.currentReading,
      unitsConsumed,
      chargeAmount,
      meterType,
      errors,
    };
  });
}

export function indexFlatsByNormalizedNumber(flats: readonly FlatLookupEntry[]) {
  const map = new Map<string, FlatLookupEntry>();
  for (const flat of flats) {
    map.set(normalizeFlatNumber(flat.flatNumber), flat);
  }
  return map;
}

export function matchFlatNumber(
  flatNumber: string,
  flatsByNumber: ReadonlyMap<string, FlatLookupEntry>,
) {
  return flatsByNumber.get(normalizeFlatNumber(flatNumber)) ?? null;
}

export function summarizeMeterImport(rows: readonly MeterReadingPreviewRow[]) {
  const validRows = rows.filter((row) => row.errors.length === 0);
  return {
    totalRows: rows.length,
    validRows: validRows.length,
    invalidRows: rows.length - validRows.length,
    totalUnits: roundMoney(validRows.reduce((sum, row) => sum + row.unitsConsumed, 0)),
    totalCharge: roundMoney(validRows.reduce((sum, row) => sum + row.chargeAmount, 0)),
  };
}
