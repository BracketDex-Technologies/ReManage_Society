import { normalizeSearchResult, type UxPersona } from "@society/ux-core";

export interface SearchResultItem {
  type: string;
  title: string;
  subtitle?: string;
  href: string;
  sensitive?: boolean;
  score?: number;
}

export interface CommandItem {
  id: string;
  kind: "nav" | "action" | "search";
  label: string;
  subtitle?: string;
  href: string;
}

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

export function scoreMatch(label: string, query: string) {
  const haystack = label.toLowerCase();
  if (haystack === query) return 100;
  if (haystack.startsWith(query)) return 80;
  if (haystack.includes(query)) return 60;
  return 0;
}

export function mergeCommandResults(
  query: string,
  navItems: Array<{ href: string; label: string }>,
  quickActions: Array<{ id: string; label: string; href: string }>,
  apiResults: SearchResultItem[],
  persona: UxPersona,
): CommandItem[] {
  const q = normalizeQuery(query);
  if (q.length < 2) return [];

  const merged: CommandItem[] = [];

  for (const item of navItems) {
    const score = scoreMatch(item.label, q);
    if (score > 0) {
      merged.push({
        id: `nav:${item.href}`,
        kind: "nav",
        label: item.label,
        href: item.href,
        score,
      } as CommandItem & { score: number });
    }
  }

  for (const action of quickActions) {
    const score = scoreMatch(action.label, q);
    if (score > 0) {
      merged.push({
        id: `action:${action.id}`,
        kind: "action",
        label: action.label,
        href: action.href,
        score,
      } as CommandItem & { score: number });
    }
  }

  for (const result of apiResults) {
    const normalized = normalizeSearchResult(result, persona);
    if (!normalized) continue;
    const score = Math.max(
      scoreMatch(normalized.title, q),
      normalized.subtitle ? scoreMatch(normalized.subtitle, q) : 0,
      scoreMatch(normalized.type, q),
    );
    if (score > 0) {
      merged.push({
        id: `search:${normalized.type}:${normalized.href}:${normalized.title}`,
        kind: "search",
        label: normalized.title,
        subtitle: normalized.subtitle,
        href: normalized.href,
        score,
      } as CommandItem & { score: number });
    }
  }

  return merged
    .sort((left, right) => (right as CommandItem & { score: number }).score - (left as CommandItem & { score: number }).score)
    .slice(0, 12)
    .map(({ id, kind, label, subtitle, href }) => ({ id, kind, label, subtitle, href }));
}
