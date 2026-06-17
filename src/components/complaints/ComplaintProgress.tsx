"use client";

import { CheckCircle2 } from "lucide-react";
import { COMPLAINT_STEPS, complaintStepIndex } from "./complaint-config";

interface ComplaintProgressProps {
  status: string;
  hasRating?: boolean;
  compact?: boolean;
}

export function ComplaintProgress({ status, hasRating = false, compact = false }: ComplaintProgressProps) {
  const current = complaintStepIndex(status, hasRating);

  return (
    <div className={`flex items-center w-full ${compact ? "gap-1" : "gap-0"}`}>
      {COMPLAINT_STEPS.map((step, index) => {
        const stepNum = index + 1;
        const done = stepNum < current;
        const active = stepNum === current;

        return (
          <div key={step.key} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center flex-1 min-w-0">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${
                  done
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : active
                      ? "bg-primary border-primary text-white"
                      : "bg-white border-border/60 text-text-tertiary"
                }`}
              >
                {done ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <span className="text-[10px] font-bold">{stepNum}</span>
                )}
              </div>
              {!compact && (
                <span
                  className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-wide mt-1.5 text-center truncate w-full px-0.5 ${
                    active ? "text-primary" : done ? "text-emerald-600" : "text-text-tertiary"
                  }`}
                >
                  {step.label}
                </span>
              )}
            </div>
            {index < COMPLAINT_STEPS.length - 1 && (
              <div
                className={`h-0.5 flex-1 min-w-[8px] ${compact ? "" : "-mt-4"} ${
                  stepNum < current ? "bg-emerald-400" : "bg-border/50"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
