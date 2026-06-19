# App-wide contrast borders

## Objective

Make card and button boundaries clearly visible throughout the application in
light and dark themes, using a 1.5px solid border and a 1rem default radius.

## Scope

- Define stronger, theme-aware border tokens in `src/app/globals.css`.
- Update shared `.card`, `.stat-card`, `.btn`, and button styles.
- Cover utility-based rounded card containers and regular buttons through
  narrowly scoped selectors.
- Assign semantic border colors to primary, secondary, success, danger, and
  warning actions.
- Preserve explicit pill and circular shapes as well as separators and table
  rules.

## Approach

The shared CSS will own the default visual boundary. Light mode will use a
neutral darkened card/control border, and dark mode will use a lighter charcoal
border that remains distinct against `#171717` and `#222222` surfaces. Colored
buttons receive a matching darker or lighter edge token appropriate to their
theme. Explicit component utility classes remain able to override the default
radius and color.

## Non-goals

- No page-specific layout, spacing, typography, or color-palette redesign.
- No changes to pill badges, circular icon buttons, horizontal dividers, or
  table separators beyond existing explicit styling.

## Acceptance checks

- Shared and utility-based cards have a visible 1.5px outline in both themes.
- Standard buttons have a visible, color-appropriate 1.5px outline in both
  themes.
- Explicit `rounded-full` and circular icon controls retain their shape.
- `npm run typecheck` and `npm run lint` exit successfully.
- Desktop and mobile render checks show no clipping, contrast regression, or
  framework error overlay in either theme.
