export function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildFlatNumber(wing: string, floor: number, unit: number, flatsPerFloor: number): string {
  const unitWidth = Math.max(2, String(flatsPerFloor).length);
  return `${wing}-${floor}${String(unit).padStart(unitWidth, "0")}`;
}

export function generateFloorRange(start: number, end: number): number[] {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return [];
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export interface FlatCandidate {
  flatNumber: string;
  wing: string;
  floor: number;
}

export function generateFlatCandidates(
  wings: string[],
  floors: number[],
  flatsPerFloor: number
): FlatCandidate[] {
  const candidates: FlatCandidate[] = [];
  for (const wing of wings) {
    const normalizedWing = wing.toUpperCase();
    for (const floor of floors) {
      for (let unit = 1; unit <= flatsPerFloor; unit++) {
        candidates.push({
          flatNumber: buildFlatNumber(normalizedWing, floor, unit, flatsPerFloor),
          wing: normalizedWing,
          floor,
        });
      }
    }
  }
  return candidates;
}

export function nextWingLabel(existing: string[]): string {
  const used = new Set(existing.map((wing) => wing.toUpperCase()));
  for (let index = 0; index < 26; index++) {
    const label = String.fromCharCode(65 + index);
    if (!used.has(label)) return label;
  }
  return `W${existing.length + 1}`;
}
