export function formatPeriodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return period;
  return new Date(year, month - 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function navigatePeriod(period: string, direction: -1 | 1): string {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(year, month - 1 + direction, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function groupByYear<T>(
  items: T[],
  getDate: (item: T) => string | null | undefined,
): Array<{ year: string; items: T[] }> {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const raw = getDate(item);
    const year = raw ? String(new Date(raw).getFullYear()) : "Unknown";
    const list = buckets.get(year) || [];
    list.push(item);
    buckets.set(year, list);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([year, grouped]) => ({ year, items: grouped }));
}

export function isNoticeArchived(
  notice: { expiresAt: string | null; createdAt: string; isPinned?: boolean },
  archiveDays = 30,
): boolean {
  if (notice.isPinned) return false;
  if (notice.expiresAt && new Date(notice.expiresAt) < new Date()) return true;
  const ageMs = Date.now() - new Date(notice.createdAt).getTime();
  return ageMs > archiveDays * 24 * 60 * 60 * 1000;
}

export function isComplaintHistory(status: string): boolean {
  return status === "resolved" || status === "closed";
}

export function distinctMonthsFromDates(dates: string[]): string[] {
  const months = new Set<string>();
  for (const date of dates) {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) continue;
    months.add(`${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`);
  }
  return [...months].sort((a, b) => b.localeCompare(a));
}
