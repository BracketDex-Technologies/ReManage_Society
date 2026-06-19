# App-wide Contrast Borders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all standard cards and buttons visibly outlined in light and dark themes without changing intentional pill, circular, divider, or status-indicator styling.

**Architecture:** Keep the behavior in `src/app/globals.css`, which already owns the palette and shared UI primitives. Add semantic border tokens, apply them to shared classes, then add narrow selectors for rounded utility-card containers and ordinary buttons so page JSX remains unchanged.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, Vitest, Playwright.

---

## File structure

- Create: `src/app/globals.test.ts` — CSS-contract regression test that verifies the tokens and selectors required by this visual system.
- Modify: `src/app/globals.css` — theme tokens and the shared card/button border rules.
- Create: `docs/superpowers/plans/2026-06-19-app-wide-contrast-borders.md` — this execution plan.

### Task 1: Define the visual regression contract

**Files:**
- Create: `src/app/globals.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

describe("global contrast-border system", () => {
  it("defines strong light and dark border tokens", () => {
    expect(styles).toContain("--color-card-border: #C7C7C7;");
    expect(styles).toContain("--color-control-border: #B0B0B0;");
    expect(styles).toContain("--color-card-border: #5B5B5B;");
    expect(styles).toContain("--color-control-border: #686868;");
  });

  it("uses a 1.5px, 1rem outline for shared cards and buttons", () => {
    expect(styles).toMatch(/\.btn \{[\s\S]*border-radius: 1rem;[\s\S]*border: 1\.5px solid var\(--color-control-border\);/);
    expect(styles).toMatch(/\.card \{[\s\S]*border-radius: 1rem;[\s\S]*border: 1\.5px solid var\(--color-card-border\);/);
    expect(styles).toContain('main :is(section, article, form, div)[class~="border"][class*="rounded"]');
  });

  it("keeps explicit circular and pill controls rounded", () => {
    expect(styles).toContain('button[class~="rounded-full"], [role="button"][class~="rounded-full"]');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm exec vitest run src/app/globals.test.ts`

Expected: FAIL because the new semantic tokens and 1.5px selector contract do not yet exist.

### Task 2: Implement the shared border system

**Files:**
- Modify: `src/app/globals.css:105-131`
- Modify: `src/app/globals.css:160-266`
- Modify: `src/app/globals.css:800-915`

- [ ] **Step 1: Add light and dark semantic border tokens**

Add the following declarations beside `--color-border` in `@theme` and override them inside `.dark`:

```css
--color-card-border: #C7C7C7;
--color-control-border: #B0B0B0;
--color-primary-border: #B83D00;
--color-success-border: #047857;
--color-danger-border: #B91C1C;
--color-warning-border: #A87500;
```

```css
--color-card-border: #5B5B5B;
--color-control-border: #686868;
--color-primary-border: #FFB080;
--color-success-border: #86EFAC;
--color-danger-border: #FCA5A5;
--color-warning-border: #FFE08A;
```

- [ ] **Step 2: Apply shared card and button borders**

Replace the `.btn`, `.card`, and `.stat-card` border declarations with these defaults and add semantic button variants:

```css
.btn {
  border: 1.5px solid var(--color-control-border);
  border-radius: 1rem;
}

.btn-primary { border-color: var(--color-primary-border); }
.btn-danger { border-color: var(--color-danger-border); }
.btn-success { border-color: var(--color-success-border); }

.card,
.stat-card,
.table-wrapper,
.modal-content {
  border: 1.5px solid var(--color-card-border);
  border-radius: 1rem;
}
```

Keep `.btn-secondary` on `var(--color-control-border)`, and update mobile `.card` and `.stat-card` to the same 1rem radius.

- [ ] **Step 3: Cover utility cards and ordinary buttons without overriding special shapes**

Append this narrow global rule set after the existing mobile hardening rules:

```css
button,
.btn,
[role="button"] {
  border: 1.5px solid var(--color-control-border);
  border-radius: 1rem;
}

button[class~="bg-primary"],
.btn-primary { border-color: var(--color-primary-border); }

button[class*="bg-red-"],
.btn-danger { border-color: var(--color-danger-border); }

button[class*="bg-emerald-"],
button[class*="bg-green-"],
.btn-success { border-color: var(--color-success-border); }

button[class*="bg-amber-"],
button[class*="bg-yellow-"] { border-color: var(--color-warning-border); }

main :is(section, article, form, div)[class~="border"][class*="rounded"]:not([class~="border-2"]) {
  border-top-width: 1.5px;
  border-right-width: 1.5px;
  border-bottom-width: 1.5px;
}

main :is(section, article, form, div)[class~="border"][class*="rounded"]:not([class*="border-l-"]):not([class~="border-2"]) {
  border-left-width: 1.5px;
}

main :is(section, article, form, div)[class*="border-border"][class*="rounded"]:not([class*="border-l-"]) {
  border-color: var(--color-card-border);
}

button[class~="rounded-full"],
[role="button"][class~="rounded-full"] { border-radius: 9999px; }
```

Do not add a `div`-only blanket rule. The selectors above require both the semantic `border` utility and a rounded class, so lines, table rules, and unbordered layout containers are excluded.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm exec vitest run src/app/globals.test.ts`

Expected: PASS with three passing tests.

- [ ] **Step 5: Commit the implementation**

```bash
git add src/app/globals.css src/app/globals.test.ts
git commit -m "style: strengthen card and button borders"
```

### Task 3: Verify compiled and rendered behavior

**Files:**
- Modify: none

- [ ] **Step 1: Run static checks**

Run: `npm run typecheck` and `npm run lint`

Expected: both commands exit with code 0.

- [ ] **Step 2: Run the focused browser smoke check**

Run: `npm exec playwright test tests/e2e/web-smoke.spec.ts --project="Desktop Chrome"`

Expected: the dashboard smoke test passes without a runtime or framework error overlay.

- [ ] **Step 3: Inspect light/dark desktop and mobile surfaces**

Use the in-app browser on a dashboard route at desktop and Pixel 7 widths. Toggle dark mode and confirm that a shared card, a utility card, a primary button, and a secondary button each have a visible outline; also confirm a circular icon button and a pill control retain their shape.

- [ ] **Step 4: Record final verification output**

Report the exact commands, exit codes, inspected route, viewports, and any remaining untested data states before claiming completion.
