const counters = new Map<string, number>();

export interface TestClock {
  now: () => Date;
  iso: () => string;
}

export function createTestId(prefix: string): string {
  const nextValue = (counters.get(prefix) || 0) + 1;
  counters.set(prefix, nextValue);
  return `${prefix}_test_${nextValue.toString().padStart(4, "0")}`;
}

export function resetTestIds(): void {
  counters.clear();
}

export function createTestClock(isoTimestamp: string): TestClock {
  const fixedDate = new Date(isoTimestamp);

  if (Number.isNaN(fixedDate.getTime())) {
    throw new Error(`Invalid test clock timestamp: ${isoTimestamp}`);
  }

  return {
    now: () => new Date(fixedDate),
    iso: () => fixedDate.toISOString(),
  };
}
