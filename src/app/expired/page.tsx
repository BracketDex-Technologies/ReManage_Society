"use client";

import { Siren, Phone, RefreshCw } from "lucide-react";

export default function ExpiredPage() {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-red-500/20 flex items-center justify-center mb-6">
          <Siren className="w-10 h-10 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Subscription Expired</h1>
        <p className="text-sm text-slate-400 leading-relaxed mb-8">
          Your society&apos;s subscription has expired. Contact your committee chairman or secretary to recharge the plan.
        </p>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3 mb-6">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">WHAT TO DO</p>
          <div className="text-left text-sm text-slate-300 space-y-2">
            <p>1. Contact your society chairman</p>
            <p>2. Ask them to recharge via Settings → Subscription</p>
            <p>3. Once recharged, refresh this page</p>
          </div>
        </div>
        <div className="flex gap-3">
          <a href="tel:+919999999999" className="flex-1 bg-white/10 text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-white/15 transition-colors">
            <Phone className="w-4 h-4" /> Call Support
          </a>
          <button onClick={() => window.location.reload()} className="flex-1 bg-primary text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
