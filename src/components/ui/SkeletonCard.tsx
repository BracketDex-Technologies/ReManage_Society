"use client";

import { motion } from "framer-motion";

export function SkeletonCard({ 
  count = 1, 
  className = "" 
}: { 
  count?: number; 
  className?: string 
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div 
          key={i} 
          className={`bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 sm:p-8 space-y-6 overflow-hidden ${className}`}
        >
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-lg w-1/3 animate-pulse" />
              <div className="h-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg w-1/2 animate-pulse" />
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="h-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg w-full animate-pulse" />
            <div className="h-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg w-5/6 animate-pulse" />
          </div>

          <div className="pt-6 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse" />
              <div className="w-20 h-2 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
            </div>
            <div className="w-24 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 animate-pulse" />
          </div>
        </div>
      ))}
    </>
  );
}

export function SkeletonTable() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden">
      <div className="p-6 border-b border-slate-50 dark:border-slate-800">
        <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-lg w-32 animate-pulse" />
      </div>
      <div className="p-6 space-y-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
              <div className="space-y-2">
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-lg w-40 animate-pulse" />
                <div className="h-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg w-24 animate-pulse" />
              </div>
            </div>
            <div className="h-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg w-20 animate-pulse" />
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
