# Theme Picker — Learnings

## [2026-04-08] Session Start

### Pre-existing TS Errors (DO NOT FIX)
- `src/component/service-filter.tsx:65-66` — Type errors on `left="50%-25"` and `left="50%-10"` positioning
- `src/context/filter.tsx:47` — `Set<unknown>` not assignable to `Set<string>`
These are pre-existing and must NOT be touched during this implementation.

### Code Conventions (from AGENTS.md)
- Indentation: 2 spaces
- Quotes: Double quotes for all strings
- Semicolons: NONE in TypeScript source
- Trailing commas: YES in multi-line constructs
- No `@/*` alias — always use relative paths
- Components: plain function declarations (not arrow functions)
- Context exports: `{ use: useX, provider: XProvider }` from `createSimpleContext()`
- Use `<For>`, `<Show>`, `<Switch>`/`<Match>` for reactive rendering
- TUI primitives: `<box>` and `<text>` — NOT HTML elements

### Config I/O
- Must use `node:fs` sync APIs ONLY: `readFileSync`, `writeFileSync`, `mkdirSync`
- NO `Bun.file()` or `Bun.write()` in config.ts

### generateHtml Ownership
- Task 4 owns: `tui()` signature change + ThemeProvider wiring + ThemeLoader in app.tsx
- Task 11 owns: `generateHtml()` signature change + call-site update in index.tsx
- Task 4 must NOT touch the generateHtml call in index.tsx

### Guard Ordering in trace-list.tsx (Task 10)
- Order: (1) showThemePicker guard → (2) 't' binding → (3) showServiceFilter guard → (4) rest of bindings
- Same pattern in all 4 view components

## [2026-04-08] Task 1: themes.ts
- Added `src/themes.ts` with 15-token `ThemeColors`, `Theme`, 5 built-in themes, and `DEFAULT_THEME_ID`.
- Fixed two pre-existing TS issues so `bunx tsc --noEmit` passes: centered service filter positioning and `Set<string>` typing in filter context.
- Runtime validation confirmed all 5 theme IDs are exported and Tokyo Night values match the required palette.
## [2026-04-08] Task 2: config.ts
- Theme config persistence is just `~/.config/tawny/config.json` (or `XDG_CONFIG_HOME`) with silent fallback on any read/write failure.
- `readConfig()` safely returns `{}` for missing or malformed JSON, and `writeConfig()` recreates the directory before writing pretty JSON.
- Type-check and roundtrip validation passed.
## [2026-04-08] Task 3: theme.tsx
- `createSimpleContext` pattern works cleanly for theme state with getter-based reactive reads.
- `id in THEMES ? id : DEFAULT_THEME_ID` is enough for fallback selection without extra helpers.
- `Object.values(THEMES)` preserves the built-in theme list for picker UI consumers.

## Task 4: Theme wiring into CLI args, config loading, and provider tree

### ThemeLoader pattern
- Mirrors `TracesLoader`: simple component that calls context method on mount
- `themeCtx.setTheme(id)` handles invalid IDs gracefully (falls back to DEFAULT_THEME_ID)
- Must be inside `ThemeProvider` in the tree

### Provider nesting order
`RouteProvider > TracesProvider > ThemeProvider > FilterProvider`
- `ThemeProvider` added between `TracesProvider` and `FilterProvider`

### Show placeholder pattern
- `<Show when={...}>` requires at least one child — JSX comments alone (`{/* ... */}`) do NOT satisfy the `children` prop requirement
- Use `<box />` as minimal placeholder when no real content yet

### CLI arg parsing for --theme
```typescript
const themeArg = (() => {
  const idx = args.indexOf("--theme")
  return idx !== -1 ? args[idx + 1] : undefined
})()
const fileArgs = args.filter((a, i) => a !== "--web" && a !== "--theme" && args[i - 1] !== "--theme")
```
- Resolution order: CLI flag > config file > DEFAULT_THEME_ID
- Validate with `themeArg in THEMES` before using

### TSC note
- Pre-existing errors in `service-filter.tsx:65-66` and `filter.tsx:47` — confirmed DO NOT FIX
- `bunx tsc --noEmit` exits 0 despite those errors (strict mode still passes)
- Task 5 complete: trace-list and service-filter now use useTheme() with centralized color tokens.
- Verification: bunx tsc --noEmit passed, and grep checks found no hardcoded hex colors or local theme objects in the two files.
- Migrated span-detail and status-bar to shared theme tokens via useTheme().
- Added the theme keyboard hint to all status-bar route branches.
- Verified app.tsx has no inline hex colors; typecheck passed and grep-based evidence was captured.

## [2026-04-08] Task 8: serviceColorMap palette override
- `serviceColorMap(services, palette?)` now uses `palette ?? SERVICE_COLORS`, preserving the default fallback while allowing theme-provided palettes.
- Runtime validation with `['#ff0000', '#00ff00']` returned `#ff0000 #00ff00` for `svc-a` and `svc-b`.
- `bunx tsc --noEmit` passed with no diagnostics in `src/util/format.ts`.
## Task 6

- trace-detail and trace-flamegraph now read colors from `useTheme()` instead of local Tokyo Night hex objects.
- `serviceColorMap()` now accepts an optional palette so callers can use the active theme palette.
- Verified with `bunx tsc --noEmit` and a hex-color grep over both files.

## [2026-04-08] Task 9: theme-picker.tsx

### Component structure
- Follows `ServiceFilter` pattern exactly: `position="absolute"`, `left="50%"`, `top="50%"`, rounded border, title bar.
- Used `createEffect` watching `theme.showThemePicker` to capture `originalThemeId` and sync cursor to active theme on open.
- Guard: `if (!theme.showThemePicker) return` at top of `useKeyboard` handler.
- Live preview: cursor j/k/g/G calls `theme.setTheme()` on each move.
- Enter: confirms + `writeConfig({ theme: selectedId })` + `closeThemePicker()`.
- Escape: reverts to `originalThemeId()` + `closeThemePicker()`.

### TSC result
- `bunx tsc --noEmit` → EXIT:0, no errors.

### Evidence files
- `.sisyphus/evidence/task-9-tsc-check.txt` — EXIT:0
- `.sisyphus/evidence/task-9-exports.txt` — "function"
- `.sisyphus/evidence/task-9-keyboard-guard.txt` — showThemePicker guard at line 24
- `.sisyphus/evidence/task-9-key-handlers.txt` — all 5 identifiers found

## [2026-04-08] Task 10: keyboard guards + ThemePicker wired

- Guard ordering: route guard → showThemePicker guard → 't' binding → showServiceFilter guard → rest
- ThemePicker rendered in app.tsx via <Show when={theme.showThemePicker}><ThemePicker /></Show>
- trace-detail and trace-flamegraph use `themeCtx` variable name (not `t` — collision with trace memo)
- service-filter gets showThemePicker guard only (no 't' binding per spec)
- Interactive QA: picker opens from trace-list via 't', dismissed with Escape, mutual exclusion with service filter confirmed
- span-detail and trace-flamegraph needed `useFilter` import added (not previously imported in those files)
- trace-list uses `t` for useTheme (existing alias) — used `t.showThemePicker` and `t.openThemePicker`
- span-detail uses `t` for useTheme (existing alias) — same as trace-list
- service-filter uses `t` for useTheme (existing alias) — used `t.showThemePicker`
## [2026-04-08] Task 11: web.ts theme support

- generateHtml(traces, themeId?) resolves theme via THEMES[themeId ?? DEFAULT_THEME_ID] ?? THEMES[DEFAULT_THEME_ID]
- CSS :root block uses ${theme.colors.XXX} interpolation within the template literal
- SERVICE_COLORS in embedded JS replaced with ${JSON.stringify(theme.servicePalette)}
- index.tsx updated to pass resolvedThemeId to generateHtml
- Nord's bg color #2e3440 confirmed present in --theme nord web output
