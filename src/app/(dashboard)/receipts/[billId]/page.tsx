"use client";

import { useEffect, useState, use } from "react";
import { Printer, Download, MessageSquare, ArrowLeft } from "lucide-react";
import { formatCurrency, formatDate, formatPeriod } from "@/lib/utils";

interface ReceiptData {
  bill: {
    id: string;
    receiptNumber: string;
    amount: number;
    lateFee: number;
    paidAmount: number;
    paidVia: string;
    paidAt: string;
    period: string;
    receiptNote: string;
    flat: { flatNumber: string; ownerName: string; contact: string };
    society: { name: string; address: string; bankDetails: string; upiId: string };
  };
}

export default function ReceiptPage({ params }: { params: Promise<{ billId: string }> }) {
  const { billId } = use(params);
  const [data, setData] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/receipts/${billId}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [billId]);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="spinner" /></div>;
  }

  if (!data?.bill) {
    return <div className="text-center py-12 text-text-secondary">Receipt not found</div>;
  }

  const { bill } = data;
  const totalPaid = (bill.paidAmount || bill.amount) + (bill.lateFee || 0);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Actions */}
      <div className="flex items-center justify-between mb-6 no-print">
        <button onClick={() => window.history.back()} className="flex items-center gap-2 text-sm text-text-secondary hover:text-primary">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="btn btn-secondary btn-sm">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button className="btn btn-secondary btn-sm">
            <Download className="w-4 h-4" /> PDF
          </button>
          <button
            onClick={() => {
              const text = `Receipt ${bill.receiptNumber}\nFlat: ${bill.flat.flatNumber}\nAmount: ${formatCurrency(totalPaid)}\nPeriod: ${formatPeriod(bill.period)}\nPaid via: ${bill.paidVia?.toUpperCase()}`;
              window.open(`https://wa.me/91${bill.flat.contact}?text=${encodeURIComponent(text)}`, "_blank");
            }}
            className="btn btn-success btn-sm"
          >
            <MessageSquare className="w-4 h-4" /> WhatsApp
          </button>
        </div>
      </div>

      {/* Receipt Card */}
      <div className="bg-white border-2 border-border rounded-xl overflow-hidden shadow-sm">
        {/* Header */}
        <div className="bg-primary text-white px-8 py-6 text-center">
          <h1 className="text-xl font-bold tracking-wide">{bill.society.name}</h1>
          <p className="text-sm opacity-80 mt-1">Maintenance Receipt {new Date(bill.paidAt).getFullYear()}</p>
        </div>

        {/* Receipt Details */}
        <div className="px-8 py-6">
          <div className="flex justify-between text-sm border-b border-border pb-4 mb-4">
            <div>
              <p className="text-text-secondary">Receipt No.</p>
              <p className="font-semibold">{bill.receiptNumber || "—"}</p>
            </div>
            <div className="text-right">
              <p className="text-text-secondary">Date</p>
              <p className="font-semibold">{formatDate(bill.paidAt)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm border-b border-border pb-4 mb-4">
            <div>
              <p className="text-text-secondary">Flat</p>
              <p className="font-semibold text-lg">{bill.flat.flatNumber}</p>
            </div>
            <div>
              <p className="text-text-secondary">Resident</p>
              <p className="font-semibold">{bill.flat.ownerName}</p>
            </div>
            <div className="col-span-2">
              <p className="text-text-secondary">Period</p>
              <p className="font-semibold">{formatPeriod(bill.period)}</p>
            </div>
          </div>

          {/* Amounts */}
          <div className="space-y-2 text-sm border-b border-border pb-4 mb-4">
            <div className="flex justify-between">
              <span className="text-text-secondary">Maintenance</span>
              <span className="font-medium">{formatCurrency(bill.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Late Fee</span>
              <span className="font-medium">{formatCurrency(bill.lateFee || 0)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t border-border pt-2 mt-2">
              <span>TOTAL PAID</span>
              <span className="text-success">{formatCurrency(totalPaid)}</span>
            </div>
          </div>

          {/* Payment Info */}
          <div className="grid grid-cols-2 gap-4 text-sm border-b border-border pb-4 mb-4">
            <div>
              <p className="text-text-secondary">Paid via</p>
              <p className="font-semibold uppercase">{bill.paidVia}</p>
            </div>
            <div>
              <p className="text-text-secondary">Paid on</p>
              <p className="font-semibold">{formatDate(bill.paidAt)}</p>
            </div>
            {bill.receiptNote && (
              <div className="col-span-2">
                <p className="text-text-secondary">Note</p>
                <p className="font-medium">{bill.receiptNote}</p>
              </div>
            )}
          </div>

          {/* Bank Details */}
          {bill.society.bankDetails && (
            <div className="text-sm mb-6">
              <p className="text-text-secondary">Society Bank</p>
              <p className="font-medium">{bill.society.bankDetails}</p>
            </div>
          )}

          {/* Signature */}
          <div className="text-right mt-8">
            <div className="w-48 border-t border-text-primary inline-block pt-2">
              <p className="text-xs text-text-secondary">Authorised Signature</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
