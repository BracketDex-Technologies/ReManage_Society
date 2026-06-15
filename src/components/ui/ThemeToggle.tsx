"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useI18n } from "@/lib/i18n";

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? "#0B1220" : "#3B82F6");
}

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // Wait until client-side mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);

    const theme = localStorage.getItem("theme");
    const dark = theme === "dark";

    setIsDark(dark);
    applyTheme(dark);
  }, []);

  const toggleTheme = () => {
    const next = !isDark;

    setIsDark(next);
    localStorage.setItem("theme", next ? "dark" : "light");
    applyTheme(next);
    window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: next ? "dark" : "light" } }));
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <button className={`${compact ? "p-0" : "p-2"} rounded-full opacity-0 pointer-events-none`}>
        <Moon className="w-4 h-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={isDark}
      className={`text-text-secondary hover:text-text-primary transition-colors relative ${
        compact ? "flex h-full w-full items-center justify-center" : "p-2 hover:bg-surface rounded-full"
      }`}
      title={isDark ? t("Switch to light mode") : t("Switch to dark mode")}
    >
      {isDark ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
    </button>
  );
}
