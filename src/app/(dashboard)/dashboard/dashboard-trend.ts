export interface CollectionTrendPoint {
  period: string;
  label: string;
  collected: number;
  pending: number;
  expenses: number;
  collectionRate: number;
}

function chartHeight(value: number, maxValue: number) {
  if (value <= 0) return 0;
  return Math.max(8, Math.round((value / maxValue) * 100));
}

export function shapeCollectionTrend(items: CollectionTrendPoint[]) {
  const maxValue = Math.max(
    ...items.flatMap((item) => [item.collected, item.pending, item.expenses]),
    1,
  );

  return {
    maxValue,
    items: items.map((item) => ({
      ...item,
      collectedHeight: chartHeight(item.collected, maxValue),
      pendingHeight: chartHeight(item.pending, maxValue),
      expensesHeight: chartHeight(item.expenses, maxValue),
    })),
  };
}
