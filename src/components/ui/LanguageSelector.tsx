"use client";

import { Languages } from "lucide-react";
import { LANGUAGE_OPTIONS, useI18n } from "@/lib/i18n";

export default function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, t } = useI18n();

  if (compact) {
    return (
      <div
        className="relative flex h-full w-full items-center justify-center text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
        title={t("Language")}
      >
        <Languages className="h-4 w-4 shrink-0 pointer-events-none" />
        <select
          aria-label={t("Language")}
          value={language}
          onChange={(event) => setLanguage(event.target.value as typeof language)}
          className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.code} value={option.code} className="text-black dark:text-white bg-white dark:bg-[#1E1E1E]">
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <label
      className="flex h-10 items-center gap-2 rounded-xl border border-border bg-white/80 px-2 text-text-secondary shadow-sm backdrop-blur transition-colors hover:text-text-primary dark:bg-slate-900/80"
      title={t("Language")}
    >
      <Languages className="h-4 w-4 shrink-0" />
      <select
        aria-label={t("Language")}
        value={language}
        onChange={(event) => setLanguage(event.target.value as typeof language)}
        className="h-8 min-w-[6.5rem] cursor-pointer rounded-lg bg-transparent text-sm font-bold text-text-primary outline-none"
      >
        {LANGUAGE_OPTIONS.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
