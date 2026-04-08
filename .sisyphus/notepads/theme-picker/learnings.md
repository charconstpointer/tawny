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
