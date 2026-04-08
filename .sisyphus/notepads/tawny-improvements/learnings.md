# Learnings — tawny-improvements

## [2026-04-09] Session start

### Code conventions confirmed
- 2-space indent, double quotes, no semicolons, trailing commas
- Components: `export function PascalCase() { ... }` (NOT arrow functions)
- Context pattern: `createSimpleContext()` from `src/context/helper.tsx`
- Theme colors via `useTheme()` context — `themeCtx.colors.X`
- No bundler — Bun runs TypeScript directly
- No tests currently — use bash/grep/playwright for verification
- All SolidJS: `<box>` and `<text>` primitives (NOT HTML elements in TUI components)

### Theme system (from theme-picker plan, already completed)
- `src/themes.ts` has THEMES record + DEFAULT_THEME_ID + Theme interface
- `src/context/theme.tsx` provides `useTheme()` hook
- Theme accessed as `themeCtx.colors.X` in components

### Solarized Light theme addition
- Added `solarized-light` using the same Theme shape as the existing presets
- Registered the theme in `THEMES` and surfaced it in CLI help text
- Verified the new theme id appears twice in `src/themes.ts` (definition + registration)

### File sizes (from investigation)
- `src/web.ts`: ~1,228 lines — self-contained HTML generator
- `src/component/trace-detail.tsx`: ~522 lines
- `src/component/trace-list.tsx`: ~288 lines
- `src/context/filter.tsx`: ~73 lines

### Key web.ts patterns
- `esc()` function at line ~320-324: safe HTML escaping (createElement + textContent → innerHTML)
- CSS custom properties on `:root` at line ~113-121
- `SERVICE_COLORS` + `assignServiceColors()` at line ~287-293
- `field()` function at line ~1219: currently NOT safe (passes raw value)
- Data embedding at line ~282-284: `const TRACES = ${data}` — XSS vector

## [2026-04-09] Web report XSS hardening

### Security patterns applied in `src/web.ts`
- Escape every embedded JSON payload before inlining into `<script>` with `JSON.stringify(...).replace(/<\//g, "<\\/").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029")`
- Keep `field()` safe-by-default for plain strings and isolate trusted markup in a separate `fieldHtml()` helper
- Wrap interpolated attribute values with `esc()` for `data-*` and `title` attributes, even when values are usually IDs
- A restrictive CSP meta tag works with the self-contained export as long as inline script/style and `data:` images remain allowed

## [2026-04-09] Parser robustness hardening
- `Object.create(null)` is the right default for kvlist materialization to avoid prototype pollution via keys like `__proto__`
- Malformed OTLP timestamps should be skipped at parse time instead of allowing BigInt conversion failures to abort the whole trace file
- Guarding missing `traceId` / `spanId` early keeps bad spans out of the trace index and avoids downstream tree/index corruption
- For event timestamps, dropping just the bad event preserves the rest of the span payload

## [2026-04-09] Span detail viewport sizing
- `src/component/span-detail.tsx` now mirrors `trace-list.tsx` by deriving visible rows from `process.stdout.rows`
- When terminal height changes, scroll math and footer pagination stay aligned because every `visibleHeight` use now calls the helper

## [2026-04-09] Filter context expansion
- `src/context/filter.tsx` follows the existing signal/getter/action pattern cleanly for new filter state
- Cycling selectors are easiest to keep consistent when the threshold arrays stay module-local and the next value is derived with `indexOf` + modulo
- New context fields should be exported directly from the `return { ... }` object so downstream components can consume them without extra plumbing

## [2026-04-09] Help overlay implementation
- Reused the existing overlay pattern from `theme-picker.tsx`: centered absolute `<box>`, `useKeyboard`, and close-on-Esc behavior
- A global `?` handler works well in `app.tsx` as long as it bails out while the help overlay is already open to avoid double toggles
- Keeping help state in `Filter` context avoids another provider and keeps overlay visibility alongside other transient UI state

## [2026-04-09] Trace list dynamic sorting
- The trace list should sort from a memoized filtered list, then apply a second memo for the active sort key so keyboard-driven sort cycling stays reactive
- When list order changes, selection should reset and all row navigation should read from the sorted array, not the filtered one
- Footer status text can show the active sort key inline without adding extra column or header indicators

## [2026-04-09] Trace list error/duration filters
- Keep the new error-only and minimum-duration filters in the same memo as the existing span/service/search filters, but before sort.
- When toggling a list filter from the keyboard, reset cursor and scroll offset to avoid landing on an invalid row.

## [2026-04-09] T5 — Web runtime theme switching

### CSS variable mapping (web.ts)
The `:root` CSS custom properties in the generated HTML use different names than ThemeColors keys:
- `--bg` ← `bg`
- `--surface` ← `bgAlt`
- `--hover` / `--selected` ← `bgHighlight` (both map to same value)
- `--text` / `--text-bright` ← `fg` (both map to same value)
- `--text-dim` ← `fgDim`
- `--border` ← `border`
- `--accent` ← `accent`
- `--ok` ← `success`
- `--warn` ← `warning`
- `--error` ← `error`

### Theme data embedding pattern
- Build all theme data at TypeScript time in `buildThemeDataJson()` helper
- Embed as `const THEME_DATA = ${themeDataJson}` in the script block
- Include `const DEFAULT_THEME_ID = "${defaultThemeId}"` for reference

### SERVICE_COLORS mutability pattern
- Declared as `let SERVICE_COLORS = [...]` (not const) to enable `setTheme` to splice it
- Use `SERVICE_COLORS.length = 0; for (c of palette) SERVICE_COLORS.push(c)` to mutate in place
- `globalServiceColors` stays as a `const {}` but properties are mutated via `delete` + `Object.assign`

### Init pattern for localStorage
- IIFE in `// === Init ===` section reads saved theme, sets select value, applies theme if != default
- Wire change handler from same IIFE

### Playwright verification
- `page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim())` to check computed bg
- `dispatchEvent(new Event('change'))` to trigger select change listener programmatically
 - Added a cyclic min-spans filter button to the web report toolbar, mirroring the existing service-filter button pattern.
 - Trace list filtering can be layered cleanly in getFilteredTraces() by applying span-count thresholds before search/sort.

## [2026-04-09] T12 — Critical path highlighting in TUI waterfall
- A small standalone util works best here: `computeCriticalPath(spans)` can rebuild a parent→children map from flat spans rather than depending on prebuilt tree roots.
- The requested greedy algorithm is straightforward: treat spans with missing/nonexistent parents as roots, then walk each root by repeatedly choosing the child with the latest `endTimeNano`.
- In `trace-detail.tsx`, critical-path highlighting composes cleanly with the existing search rendering by computing a memoized `Set<string>` and only changing span-name prefix/color, leaving waterfall bars untouched.
- For traces with multiple roots or orphaned spans, selecting the root with the latest `endTimeNano` avoids incorrectly highlighting multiple disconnected branches while still preserving the simple greedy approach.
