"use client";

import Link from "next/link";
import { AlertTriangle, IndianRupee } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface DuesEnforcementStatus {
  blocked: boolean;
  enabled: boolean;
  maxOverdueDays: number;
  message: string | null;
  totalOverdueAmount: number;
  oldestOverdueDays: number;
  overdueBills: Array<{
    id: string;
    period: string;
    remainingAmount: number;
    daysOverdue: number;
  }>;
}

export default function DuesEnforcementBanner({
  status,
  featureLabel = "amenity bookings and guest parking",
}: {
  status: DuesEnforcementStatus | null;
  featureLabel?: string;
}) {
  if (!status?.blocked) return null;

  return (
    <div className="card mb-6 border-l-4 border-l-danger bg-danger/5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5 text-danger" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-text-primary">Dues overdue — {featureLabel} blocked</h2>
          <p className="text-sm text-text-secondary mt-1">
            {status.message ||
              `Clear maintenance dues older than ${status.maxOverdueDays} days to continue.`}
          </p>
          {status.overdueBills.length > 0 && (
            <div className="mt-3 space-y-1">
              {status.overdueBills.slice(0, 3).map((bill) => (
                <p key={bill.id} className="text-xs text-text-secondary flex items-center gap-2">
                  <IndianRupee className="w-3 h-3" />
                  {bill.period}: {formatCurrency(bill.remainingAmount)} · {bill.daysOverdue} days overdue
                </p>
              ))}
            </div>
          )}
          <Link href="/my-bills" className="btn btn-primary btn-sm mt-4 inline-flex">
            Pay dues now
          </Link>
        </div>
      </div>
    </div>
  );
}
