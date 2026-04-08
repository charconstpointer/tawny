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
