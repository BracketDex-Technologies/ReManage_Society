export function getBillTotal(bill: {
  totalAmount?: number | null;
  amount: number;
  lateFee?: number;
  gstAmount?: number;
}): number {
  return bill.totalAmount ?? bill.amount + (bill.lateFee || 0) + (bill.gstAmount || 0);
}

export function generateMaintenanceUpiLink(input: {
  upiId: string;
  societyName: string;
  amount: number;
  period: string;
  flatNumber: string;
}): string {
  const amount = input.amount.toFixed(2);
  const payeeName = encodeURIComponent(input.societyName || "Society");
  const transactionRef = encodeURIComponent(`MAINT-${input.period}-${input.flatNumber}`);
  const transactionNote = encodeURIComponent(
    `Maintenance ${input.period} - Flat ${input.flatNumber}`,
  );
  return `upi://pay?pa=${input.upiId}&pn=${payeeName}&tr=${transactionRef}&tn=${transactionNote}&am=${amount}&cu=INR`;
}

export function sortBillsByPriority<
  T extends { status: string; dueDate: string },
>(bills: T[]): T[] {
  const rank = (status: string) => {
    if (status === "pending") return 0;
    if (status === "partial") return 1;
    return 2;
  };

  return [...bills].sort((a, b) => {
    const byStatus = rank(a.status) - rank(b.status);
    if (byStatus !== 0) return byStatus;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
}

export function buildDefaultDueDate(period: string, dueDay = 10): string {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`;
}
