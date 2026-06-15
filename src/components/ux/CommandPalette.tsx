"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { mergeCommandResults } from "@/lib/navigation/search-merge";
import { usePersonaNav } from "@/lib/navigation/use-persona-nav";
import { useUser } from "@/lib/user-context";
import { getNavIcon } from "@/lib/navigation/nav-icons";

const RECENT_KEY = "society-recent-actions";

function readRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeRecent(href: string) {
  const next = [href, ...readRecent().filter((item) => item !== href)].slice(0, 8);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export function clearRecentActions() {
  localStorage.removeItem(RECENT_KEY);
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { user } = useUser();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [apiResults, setApiResults] = useState<Array<{ type: string; title: string; subtitle?: string; href: string }>>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const personaNav = usePersonaNav(
    user.societyId
      ? { subject: user.id || user.email || "user", societyId: user.societyId, role: user.role }
      : null,
  );

  const navItems = useMemo(
    () => personaNav?.navigation.sections.flatMap((section) => section.items) ?? [],
    [personaNav],
  );

  const results = useMemo(() => {
    if (!personaNav) return [];
    if (query.trim().length < 2) {
      return readRecent()
        .map((href) => navItems.find((item) => item.href === href))
        .filter(Boolean)
        .map((item) => ({
          id: `recent:${item!.href}`,
          kind: "nav" as const,
          label: item!.label,
          href: item!.href,
          subtitle: undefined,
        }));
    }

    return mergeCommandResults(
      query,
      navItems,
      personaNav.quickActions,
      apiResults,
      personaNav.persona,
    );
  }, [apiResults, navItems, personaNav, query]);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery("");
    setActiveIndex(0);
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setApiResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        .then((response) => response.json())
        .then((data) => setApiResults(data.results || []))
        .catch(() => {});
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, query]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveIndex(0);
  }, [query, results.length]);

  const navigate = useCallback(
    (href: string) => {
      writeRecent(href);
      onClose();
      router.push(href);
    },
    [onClose, router],
  );

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => Math.min(current + 1, Math.max(results.length - 1, 0)));
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) => Math.max(current - 1, 0));
      }

      if (event.key === "Enter" && results[activeIndex]) {
        event.preventDefault();
        navigate(results[activeIndex].href);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, navigate, onClose, open, results]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/45 p-4 pt-[12vh] backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search and quick actions"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-white shadow-2xl dark:border-[#303030] dark:bg-[#1E1E1E]"
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 dark:border-[#303030]">
          <Search className="h-5 w-5 text-text-secondary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages, actions, residents, visitors..."
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-text-primary outline-none"
            aria-controls="command-palette-list"
            aria-activedescendant={results[activeIndex] ? `command-item-${activeIndex}` : undefined}
          />
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-text-secondary hover:bg-surface" aria-label="Close search">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div ref={listRef} id="command-palette-list" className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm font-medium text-text-secondary">
              {query.trim().length < 2 ? "Type to search or use recent actions." : "No matches found."}
            </p>
          ) : (
            results.map((item, index) => {
              const Icon = getNavIcon(item.kind === "action" ? "layout-dashboard" : item.href.replace("/", "") || "layout-dashboard");
              return (
                <button
                  key={item.id}
                  id={`command-item-${index}`}
                  type="button"
                  onClick={() => navigate(item.href)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    index === activeIndex ? "bg-primary/10 text-primary" : "hover:bg-surface"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{item.label}</p>
                    {item.subtitle && (
                      <p className="truncate text-xs font-medium text-text-secondary">{item.subtitle}</p>
                    )}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">{item.kind}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return { open, setOpen };
}
