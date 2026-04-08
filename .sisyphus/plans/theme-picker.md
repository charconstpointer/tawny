# Theme Picker

## TL;DR

> **Quick Summary**: Add a centralized theme system with 5 built-in color palettes (Tokyo Night, Catppuccin Mocha, Dracula, Nord, Gruvbox Dark), a keyboard-activated theme picker modal, config file persistence, `--theme` CLI flag, and web report theme support.
> 
> **Deliverables**:
> - `src/themes.ts` — Theme interface + 5 theme definitions with per-theme service color palettes
> - `src/context/theme.tsx` — ThemeContext using createSimpleContext pattern
> - `src/component/theme-picker.tsx` — Modal overlay for theme selection (live preview, persist on Enter)
> - Updated all 7 components + app.tsx to consume centralized theme context (zero hardcoded hex colors)
> - `--theme <name>` CLI flag in src/index.tsx
> - Config persistence at `~/.config/tawny/config.json`
> - Web report (src/web.ts) generates HTML using selected theme's CSS variables
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES — 3 waves
> **Critical Path**: Task 1 → Task 2 → Task 3 → Tasks 4-9 (parallel) → Task 10 → Task 11

---

## Context

### Original Request
User requested a theme picker with common themes for the TUI-based OpenTelemetry trace viewer.

### Interview Summary
**Key Discussions**:
- **Activation**: Keyboard shortcut 't' opens theme picker overlay from any route
- **Themes**: 5 built-in themes — Tokyo Night (current default), Catppuccin Mocha, Dracula, Nord, Gruvbox Dark
- **Service colors**: Each theme provides its own 10-color service palette adapted to the theme's aesthetic
- **Persistence**: Save to `~/.config/tawny/config.json` — read on startup, write on selection
- **CLI**: `--theme <name>` flag overrides config but does NOT persist (one-time override)
- **Web**: Static theme application via CSS `:root` variables at generation time (no interactive picker in web)
- **Custom themes**: Out of scope — built-in only
- **Live preview**: Theme changes preview live as cursor moves, Enter confirms + persists, Escape reverts

**Research Findings**:
- Current codebase has NO centralized theme — 7 components each define local `const theme = {...}` with hardcoded Tokyo Night hex colors
- 6+ inline hardcoded hex values in app.tsx, status-bar.tsx, trace-detail.tsx bypass even the local theme objects
- `SERVICE_COLORS` (10-color array) exists in src/util/format.ts and is duplicated in src/web.ts
- createSimpleContext pattern is well-established (3 existing contexts: Route, Traces, Filter)
- ServiceFilter overlay provides proven modal pattern (absolute positioning, useKeyboard with early-return guards)
- 't' key is completely unused across all keyboard handlers — safe to claim

### Metis Review
**Identified Gaps** (addressed):
- Inline hardcoded colors beyond theme objects must also be migrated (6+ found)
- Keyboard guards needed in ALL 5 useKeyboard handlers, not just trace-list
- Theme picker and service filter must be mutually exclusive
- CLI `--theme` should override config but NOT persist
- Config read should happen in index.tsx before tui(), not inside context init
- Web report gets static theme only, no interactive picker
- Config file errors handled silently with fallback to Tokyo Night
- Respect `XDG_CONFIG_HOME` if set, else `~/.config`

---

## Work Objectives

### Core Objective
Replace all 7 component-local theme objects and inline hex colors with a centralized, reactive Theme context that supports 5 built-in color palettes, runtime switching via a keyboard-activated picker, config persistence, CLI override, and themed web report output.

### Concrete Deliverables
- `src/themes.ts` — Theme interface, 5 theme definitions, theme registry
- `src/context/theme.tsx` — ThemeContext with get/set/list
- `src/component/theme-picker.tsx` — Modal overlay component
- Updated `src/app.tsx` — ThemeProvider in provider tree, theme picker conditional render
- Updated `src/index.tsx` — `--theme` CLI flag, config reading, pass theme to tui() and generateHtml()
- Updated all 7 components — consume useTheme() instead of local theme consts
- Updated `src/util/format.ts` — serviceColorMap accepts palette from theme
- Updated `src/web.ts` — generateHtml() accepts theme, injects into CSS `:root`
- Updated `src/component/status-bar.tsx` — 't' hint, theme-aware colors

### Definition of Done
- [ ] `bunx tsc --noEmit` passes with 0 errors
- [ ] `grep -rn '#1a1b26\|#24283b\|#292e42\|#c0caf5\|#565f89\|#7aa2f7\|#f7768e\|#9ece6a\|#bb9af7\|#7dcfff\|#e0af68\|#3b4261' src/component/ src/app.tsx` returns 0 matches
- [ ] App launches with each of the 5 `--theme` values without error
- [ ] App launches with `--theme nonexistent` and falls back to Tokyo Night
- [ ] Web report output contains theme-specific CSS `:root` colors
- [ ] Theme picker opens with 't' from all 4 route views
- [ ] Config file created/updated on theme selection in picker

### Must Have
- 5 built-in themes with unique service color palettes
- Keyboard shortcut 't' opens picker from any view
- Live preview while navigating picker; Enter confirms, Escape reverts
- Config persistence at `$XDG_CONFIG_HOME/tawny/config.json` or `~/.config/tawny/config.json`
- `--theme <name>` CLI flag (overrides config, does not persist)
- Web report applies selected theme to CSS `:root` variables
- Zero hardcoded hex colors remaining in component files after migration

### Must NOT Have (Guardrails)
- NO custom user-defined themes or theme file loading
- NO light mode theme variants
- NO interactive theme picker in the web HTML report
- NO config keys beyond `{ "theme": "<name>" }` — config stores ONLY the theme name
- NO keyboard shortcut customization — 't' is hardcoded
- NO separate files per theme — all definitions in one `src/themes.ts` file
- NO centralized key dispatcher refactor — follow existing per-component useKeyboard guard pattern
- NO JSDoc additions or comment bloat during migration
- NO shared "modal" component extraction from ServiceFilter — just follow its pattern
- NO mouse input support in theme picker
- NO theme transition animations

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO (AGENTS.md confirms no test runner configured)
- **Automated tests**: None
- **Framework**: N/A
- **QA Method**: Agent-executed QA scenarios using Bash (CLI verification), tmux (TUI interaction), and grep (code auditing)

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **TUI interaction**: Use interactive_bash (tmux) — run app, send keystrokes, validate output
- **CLI verification**: Use Bash — run commands, check exit codes, grep output
- **Code auditing**: Use grep/ast_grep_search — verify no hardcoded colors remain
- **Type checking**: Use Bash — `bunx tsc --noEmit`

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — start immediately, all independent):
├── Task 1: Theme interface + 5 theme definitions [quick]
├── Task 2: Config read/write utility module [quick]
└── Task 3: ThemeContext using createSimpleContext [quick]

Wave 2 (Migration + UI — after Wave 1, MAX PARALLEL):
├── Task 4: Wire theme into app.tsx + index.tsx (CLI flag, config, providers) [unspecified-high]
├── Task 5: Migrate trace-list.tsx + service-filter.tsx to useTheme() [quick]
├── Task 6: Migrate trace-detail.tsx + trace-flamegraph.tsx to useTheme() [quick]
├── Task 7: Migrate span-detail.tsx + status-bar.tsx + app.tsx inline colors [quick]
├── Task 8: Update serviceColorMap to accept theme palette [quick]
└── Task 9: Build ThemePicker component [unspecified-high]

Wave 3 (Integration + Web — after Wave 2):
├── Task 10: Add keyboard guards + wire theme picker into all views [unspecified-high]
└── Task 11: Update web.ts for theme support [quick]

Wave FINAL (after ALL tasks — 4 parallel reviews, then user okay):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
→ Present results → Get explicit user okay
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | — | 3, 4, 5, 6, 7, 8, 9, 10, 11 | 1 |
| 2 | — | 4, 10 | 1 |
| 3 | 1 | 4, 5, 6, 7, 9, 10 | 1 |
| 4 | 1, 2, 3 | 5, 6, 7, 8, 9, 10, 11 | 2 |
| 5 | 3, 4 | 10 | 2 |
| 6 | 3, 4 | 10 | 2 |
| 7 | 3, 4 | 10 | 2 |
| 8 | 1, 4 | 6, 11 | 2 |
| 9 | 1, 3, 4 | 10 | 2 |
| 10 | 2, 5, 6, 7, 9 | 11 | 3 |
| 11 | 1, 4, 8 | — | 3 |
| F1-F4 | ALL | — | FINAL |

### Agent Dispatch Summary

- **Wave 1**: **3 tasks** — T1 → `quick`, T2 → `quick`, T3 → `quick`
- **Wave 2**: **6 tasks** — T4 → `unspecified-high`, T5 → `quick`, T6 → `quick`, T7 → `quick`, T8 → `quick`, T9 → `unspecified-high`
- **Wave 3**: **2 tasks** — T10 → `unspecified-high`, T11 → `quick`
- **FINAL**: **4 tasks** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [x] 1. Define Theme interface and 5 built-in theme definitions

  **What to do**:
  - Create `src/themes.ts` with a `ThemeColors` interface containing exactly these 15 semantic color tokens:
    - `bg` — main background (e.g., `#1a1b26` for Tokyo Night)
    - `bgAlt` — surface/panel background (e.g., `#24283b`)
    - `bgHighlight` — selected/hover row background (e.g., `#292e42`)
    - `fg` — primary text color (e.g., `#c0caf5`)
    - `fgDim` — muted/secondary text (e.g., `#565f89`)
    - `border` — borders, dividers, separators (e.g., `#3b4261`)
    - `accent` — primary accent (links, durations, key labels) (e.g., `#7aa2f7`)
    - `accent2` — secondary accent (trace IDs, attribute keys) (e.g., `#bb9af7`)
    - `accent3` — tertiary accent (service names, checkmarks) (e.g., `#7dcfff`)
    - `success` — ok/pass status (e.g., `#9ece6a`)
    - `warning` — warning/caution (e.g., `#e0af68`)
    - `error` — error/fail status (e.g., `#f7768e`)
    - `headerBg` — header bar background (can equal `bg` or `bgAlt`)
    - `headerFg` — header bar text (can equal `fg`)
    - `barFill` — waterfall/flamegraph bar background fill (e.g., `#24283b`)
  - Add a `Theme` interface: `{ name: string, id: string, colors: ThemeColors, servicePalette: string[] }`
  - `servicePalette` is an array of 10 hex color strings per theme, adapted to each theme's aesthetic
  - Define 5 theme objects: `tokyoNight`, `catppuccinMocha`, `dracula`, `nord`, `gruvboxDark`
  - Export a `THEMES` record: `Record<string, Theme>` keyed by id (e.g., `"tokyo-night"`, `"catppuccin-mocha"`, `"dracula"`, `"nord"`, `"gruvbox-dark"`)
  - Export a `DEFAULT_THEME_ID` constant: `"tokyo-night"`
  - The Tokyo Night theme MUST exactly match the current hardcoded hex values from the codebase
  - For each of the other 4 themes, use the researched hex values from the librarian's findings, mapping each of the 15 tokens to the theme's canonical palette
  - For service palettes: pick 10 colors from each theme's extended palette that are distinct and readable against that theme's background

  **Must NOT do**:
  - Do not create separate files per theme
  - Do not add more than 15 color tokens to ThemeColors
  - Do not add JSDoc comments

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Pure data definition, no complex logic, single file creation
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - None relevant — this is a data-only task

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Tasks 3, 4, 5, 6, 7, 8, 9, 10, 11
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/component/trace-list.tsx:5-17` — Local theme object showing all keys used by trace-list (selected, normal, header, headerFg, traceId, service, duration, spanCount, error, ok, unset, dim, searchBg, searchFg)
  - `src/component/trace-detail.tsx:6-18` — Local theme object for trace-detail (selected, normal, header, headerFg, spanName, duration, error, ok, unset, dim, tree, rulerFg, barBg, divider, collapseIndicator)
  - `src/component/span-detail.tsx:5-13` — Local theme object for span-detail (header, headerFg, label, value, dim, error, ok, unset, attrKey, attrVal, sectionBg, normal, selected)
  - `src/component/trace-flamegraph.tsx:7-14` — Local theme for flamegraph (normal, selected, header, headerFg, dim, rulerBg, rulerFg, fill, error, duration, zoom)
  - `src/component/service-filter.tsx:8-12` — Local theme for service-filter (bg, border, header, selected, normal, service, check, uncheck, dim)
  - `src/component/status-bar.tsx:5-7` — Local theme for status-bar (key, desc, sep)

  **API/Type References**:
  - `src/types.ts` — Project type conventions (const objects as enums, interface for shapes)

  **WHY Each Reference Matters**:
  - The 6 component theme objects show EVERY color key currently used — the 15-token ThemeColors must cover ALL of them via mapping. Each component-local key will map to one of the 15 canonical tokens.

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Theme file compiles without errors
    Tool: Bash
    Preconditions: src/themes.ts exists
    Steps:
      1. Run `bunx tsc --noEmit`
      2. Check exit code is 0
    Expected Result: No type errors
    Failure Indicators: Any tsc error output referencing themes.ts
    Evidence: .sisyphus/evidence/task-1-tsc-check.txt

  Scenario: All 5 themes are exported and have correct structure
    Tool: Bash
    Preconditions: src/themes.ts exists
    Steps:
      1. Run `bun -e "import { THEMES, DEFAULT_THEME_ID } from './src/themes'; console.log(Object.keys(THEMES).join(',')); console.log(DEFAULT_THEME_ID); const t = THEMES['tokyo-night']; console.log(Object.keys(t.colors).length); console.log(t.servicePalette.length)"`
      2. Verify output line 1 contains all 5 theme IDs
      3. Verify line 2 is "tokyo-night"
      4. Verify line 3 is "15" (color token count)
      5. Verify line 4 is "10" (service palette length)
    Expected Result: 5 theme IDs listed, default is tokyo-night, 15 colors, 10 service colors
    Failure Indicators: Missing themes, wrong count, import errors
    Evidence: .sisyphus/evidence/task-1-theme-structure.txt

  Scenario: Tokyo Night theme matches current hardcoded values
    Tool: Bash
    Preconditions: src/themes.ts exists
    Steps:
      1. Run `bun -e "import { THEMES } from './src/themes'; const c = THEMES['tokyo-night'].colors; console.log(c.bg, c.fg, c.error, c.success, c.accent)"`
      2. Verify: bg=#1a1b26, fg=#c0caf5, error=#f7768e, success=#9ece6a, accent=#7aa2f7
    Expected Result: All values match current codebase hex colors exactly
    Failure Indicators: Any color mismatch
    Evidence: .sisyphus/evidence/task-1-tokyo-night-values.txt
  ```

  **Commit**: YES
  - Message: `feat(theme): add theme interface and 5 built-in theme definitions`
  - Files: `src/themes.ts`
  - Pre-commit: `bunx tsc --noEmit`

- [x] 2. Create config read/write utility module

  **What to do**:
  - Create `src/config.ts` with functions:
    - `getConfigPath(): string` — returns `$XDG_CONFIG_HOME/tawny/config.json` if `XDG_CONFIG_HOME` is set, else `$HOME/.config/tawny/config.json` (use `os.homedir()` from `node:os`)
    - `readConfig(): { theme?: string }` — reads and parses config file **synchronously** using `readFileSync` from `node:fs`, returns `{}` on any error (file missing, malformed JSON, parse error). Wraps in try/catch — never throws. Import `{ readFileSync, mkdirSync, writeFileSync }` from `node:fs`.
    - `writeConfig(config: { theme: string }): void` — writes config as formatted JSON using `writeFileSync` from `node:fs`. Creates directory recursively with `mkdirSync` with `{ recursive: true }`. Wraps everything in try/catch — fails silently. **Do NOT use `Bun.file()` or `Bun.write()` in this module** — use only `node:fs` sync APIs for synchronous, blocking I/O.
  - Config file format is EXACTLY `{ "theme": "<theme-id>" }` — no other keys
  - Import `os` from `node:os` and `{ readFileSync, mkdirSync, writeFileSync }` from `node:fs`

  **Must NOT do**:
  - Do not add config keys beyond `theme`
  - Do not throw errors — all failures must be silent with fallback
  - Do not add logging or console output on config errors

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small utility module, straightforward I/O with error handling
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Tasks 4, 10
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/index.tsx:1-30` — Shows how Bun.file() is used for reading files, and the CLI arg parsing pattern
  - `bin/cli.ts` — Entry point shebang pattern

  **External References**:
  - Bun docs: `Bun.file()`, `Bun.write()` for file I/O

  **WHY Each Reference Matters**:
  - index.tsx shows how Bun file APIs are used in this project — follow the same import style and error handling approach

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Config module compiles without errors
    Tool: Bash
    Preconditions: src/config.ts exists
    Steps:
      1. Run `bunx tsc --noEmit`
      2. Check exit code is 0
    Expected Result: No type errors
    Failure Indicators: Any tsc error referencing config.ts
    Evidence: .sisyphus/evidence/task-2-tsc-check.txt

  Scenario: readConfig returns empty object when no config file exists
    Tool: Bash
    Preconditions: No config file at path
    Steps:
      1. Run `bun -e "import { readConfig } from './src/config'; const c = readConfig(); console.log(JSON.stringify(c))"`
      2. Temporarily ensure no config file exists (or use a temp XDG path)
    Expected Result: Output is `{}` — no crash, no error output
    Failure Indicators: Thrown error, crash, non-empty output
    Evidence: .sisyphus/evidence/task-2-read-missing.txt

  Scenario: writeConfig creates directory and file, readConfig reads it back
    Tool: Bash
    Preconditions: Clean state
    Steps:
      1. Run `XDG_CONFIG_HOME=/tmp/tawny-test-$$ bun -e "import { writeConfig, readConfig } from './src/config'; writeConfig({ theme: 'dracula' }); const c = readConfig(); console.log(JSON.stringify(c))"`
      2. Verify output is `{"theme":"dracula"}`
      3. Clean up: `rm -rf /tmp/tawny-test-*`
    Expected Result: Config round-trips correctly
    Failure Indicators: Missing file, wrong content, crash
    Evidence: .sisyphus/evidence/task-2-roundtrip.txt

  Scenario: readConfig handles malformed JSON gracefully
    Tool: Bash
    Preconditions: Config file exists with invalid content
    Steps:
      1. Run `mkdir -p /tmp/tawny-bad/tawny && echo "not json" > /tmp/tawny-bad/tawny/config.json && XDG_CONFIG_HOME=/tmp/tawny-bad bun -e "import { readConfig } from './src/config'; console.log(JSON.stringify(readConfig()))"`
      2. Verify output is `{}`
      3. Clean up: `rm -rf /tmp/tawny-bad`
    Expected Result: Returns empty object, no crash
    Failure Indicators: Thrown error, crash
    Evidence: .sisyphus/evidence/task-2-malformed.txt
  ```

  **Commit**: YES
  - Message: `feat(config): add config read/write utility`
  - Files: `src/config.ts`
  - Pre-commit: `bunx tsc --noEmit`

- [x] 3. Create ThemeContext using createSimpleContext

  **What to do**:
  - Create `src/context/theme.tsx` using the `createSimpleContext` pattern from `src/context/helper.tsx`
  - Context init receives initial theme ID as a parameter — use a module-level variable or accept it via a prop on the provider component (follow the TracesLoader pattern where data is injected after provider mount)
  - Actually, simplest approach: the ThemeProvider should accept an `initialTheme` prop, and use it to set the initial signal value. This avoids needing a module-level variable.
  - Alternatively, since `createSimpleContext` doesn't support props on the provider, use a `ThemeLoader` component inside the provider (like `TracesLoader` for traces) that reads the initial theme and calls `setTheme()`.
  - Context shape (getter properties + methods):
    - `get colors(): ThemeColors` — returns current theme's colors
    - `get servicePalette(): string[]` — returns current theme's service palette
    - `get id(): string` — returns current theme ID
    - `get name(): string` — returns current theme display name
    - `get allThemes(): Theme[]` — returns all available themes
    - `setTheme(id: string): void` — switches to theme by ID, falls back to default if ID not found
    - `get showThemePicker(): boolean` — signal controlling picker visibility
    - `toggleThemePicker(): void` — opens/closes the picker
    - `closeThemePicker(): void` — closes the picker
    - `openThemePicker(): void` — opens the picker
  - Import `THEMES`, `DEFAULT_THEME_ID`, `Theme`, `ThemeColors` from `../themes`
  - Use `createSignal` for current theme ID and showThemePicker flag
  - Export `{ use: useTheme, provider: ThemeProvider }`

  **Must NOT do**:
  - Do not do file I/O inside the context — config reading/writing happens outside
  - Do not create a new context pattern — use createSimpleContext exactly as other contexts do
  - Do not add persistence logic here — that belongs in the theme picker component

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small context module following an established pattern exactly
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2) — but depends on Task 1 for imports
  - **Blocks**: Tasks 4, 5, 6, 7, 9, 10
  - **Blocked By**: Task 1 (needs Theme types and THEMES record)

  **References**:

  **Pattern References**:
  - `src/context/helper.tsx` — Full createSimpleContext implementation; this is the EXACT pattern to follow
  - `src/context/filter.tsx` — Best reference for a context with boolean signal flags (showServiceFilter, showSearch) and toggle/open/close methods — theme picker visibility follows this exact pattern
  - `src/context/route.tsx` — Shows createStore usage for complex state, but createSignal is fine for theme
  - `src/context/traces.tsx` — Shows the data loading pattern via a TracesLoader component that calls context methods after mount

  **API/Type References**:
  - `src/themes.ts` (created in Task 1) — Theme, ThemeColors, THEMES, DEFAULT_THEME_ID

  **WHY Each Reference Matters**:
  - `helper.tsx` is the factory — must use it identically
  - `filter.tsx` is the closest analog for boolean show/hide signals with toggle/open/close methods
  - `traces.tsx` shows how to inject initial data into a context from outside (TracesLoader pattern)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: ThemeContext compiles without errors
    Tool: Bash
    Preconditions: src/context/theme.tsx and src/themes.ts exist
    Steps:
      1. Run `bunx tsc --noEmit`
      2. Check exit code is 0
    Expected Result: No type errors
    Failure Indicators: Any tsc error referencing theme.tsx
    Evidence: .sisyphus/evidence/task-3-tsc-check.txt

  Scenario: Context exports match expected shape
    Tool: Bash
    Preconditions: src/context/theme.tsx exists
    Steps:
      1. Run `bun -e "import { useTheme, ThemeProvider } from './src/context/theme'; console.log(typeof useTheme, typeof ThemeProvider)"`
      2. Verify output shows both are functions
    Expected Result: `function function`
    Failure Indicators: Import error, undefined exports
    Evidence: .sisyphus/evidence/task-3-exports.txt
  ```

  **Commit**: YES
  - Message: `feat(theme): add ThemeContext using createSimpleContext`
  - Files: `src/context/theme.tsx`
  - Pre-commit: `bunx tsc --noEmit`

- [x] 4. Wire theme into app.tsx and index.tsx (CLI flag, config loading, provider tree)

  **What to do**:
  - **src/index.tsx**: Add `--theme <name>` CLI flag parsing alongside existing arg parsing
    - Resolution order: `--theme` CLI flag > config file > `DEFAULT_THEME_ID`
    - Call `readConfig()` from `src/config.ts` to get persisted theme
    - If `--theme` is provided, validate against `THEMES` keys — if invalid, ignore and use next in priority
    - Pass resolved theme ID to `tui(traces, themeId)` — update its signature
    - For `generateHtml(traces)`: **do NOT change the call signature here** — pass the resolved `themeId` only after Task 11 has updated `generateHtml`'s signature. Until Task 11 is done, Task 4 leaves the `generateHtml` call unchanged. Task 11 owns the `generateHtml` signature change AND the call-site update in index.tsx.
  - **src/app.tsx**: 
    - Add `ThemeProvider` to the provider nesting: `RouteProvider > TracesProvider > ThemeProvider > FilterProvider`
    - Create a `ThemeLoader` component (like `TracesLoader`) that receives the theme ID prop and calls `themeCtx.setTheme(id)` on mount
    - Move the root `backgroundColor` from hardcoded `"#1a1b26"` to `useTheme().colors.bg`
    - Move the title bar hardcoded colors (`fg="#7aa2f7"`, `fg="#565f89"`) to use theme colors (`accent`, `fgDim`)
    - Add `<Show when={theme.showThemePicker}>{/* ThemePicker placeholder — wired in Task 10 */}</Show>` alongside the existing ServiceFilter conditional render (ThemePicker component import and render come in Task 10)
    - Update `tui()` function signature to accept `themeId` parameter and pass it to `ThemeLoader`
  - **Mutual exclusion**: When theme picker opens, close service filter. Add this logic:
    - In the theme context's `openThemePicker()`: also call `filter.closeServiceFilter()` — BUT this creates a circular dependency. Instead, handle mutual exclusion in the component that opens the picker (the keyboard handlers in Task 10). For now, just add the ThemeProvider and ThemeLoader.

  **Must NOT do**:
  - Do not change any component behavior — only wire providers and update signatures
  - Do not import ThemePicker component yet (it doesn't exist until Task 9) — just add the `<Show>` wrapper with a comment placeholder
  - Do not update the `generateHtml` call signature in index.tsx — that belongs to Task 11
  - Do not add persistence logic to index.tsx — config is read-only here

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Touches 2 critical files (entry point + root component), requires careful provider nesting and signature changes
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO — this is the integration point for Wave 1 outputs
  - **Parallel Group**: Wave 2 (start of wave, other tasks depend on this)
  - **Blocks**: Tasks 5, 6, 7, 8, 9, 10, 11
  - **Blocked By**: Tasks 1, 2, 3

  **References**:

  **Pattern References**:
  - `src/app.tsx` — Current provider nesting order, AppContent layout, how overlays are conditionally rendered with `<Show>`, TracesLoader component pattern
  - `src/index.tsx` — CLI argument parsing (currently parses `--web` flag and file path), `tui()` and `generateHtml()` call sites
  - `src/context/traces.tsx` — TracesLoader pattern (component that calls context method on mount to inject data)

  **API/Type References**:
  - `src/themes.ts` (Task 1) — THEMES record, DEFAULT_THEME_ID
  - `src/config.ts` (Task 2) — readConfig()
  - `src/context/theme.tsx` (Task 3) — ThemeProvider, useTheme

  **WHY Each Reference Matters**:
  - `app.tsx` is the root — ThemeProvider MUST be inserted at the correct nesting level
  - `index.tsx` is where CLI args are parsed and tui()/generateHtml() are called — signature changes happen here
  - TracesLoader shows the established pattern for data injection into contexts

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: App compiles after provider wiring
    Tool: Bash
    Preconditions: Tasks 1-3 complete
    Steps:
      1. Run `bunx tsc --noEmit`
      2. Check exit code is 0
    Expected Result: No type errors
    Failure Indicators: Any tsc error in app.tsx or index.tsx
    Evidence: .sisyphus/evidence/task-4-tsc-check.txt

  Scenario: App launches with --theme flag
    Tool: interactive_bash (tmux)
    Preconditions: A sample .jsonl trace file exists
    Steps:
      1. Find or create a minimal test trace file
      2. `tmux new-session -d -s tawny-t4a -x 220 -y 50`
      3. `tmux send-keys -t tawny-t4a "bun run src/index.tsx --theme dracula <trace-file> 2>/tmp/tawny-t4a-err.txt" Enter`
      4. Wait 2 seconds
      5. `tmux kill-session -t tawny-t4a`
      6. Run `cat /tmp/tawny-t4a-err.txt`
      7. Verify no stack traces, "not found", or crash messages in stderr
    Expected Result: App starts without error
    Failure Indicators: Error messages, stack traces, "not found" errors in stderr
    Evidence: .sisyphus/evidence/task-4-launch-theme-flag.txt

  Scenario: App launches with invalid --theme flag (fallback)
    Tool: interactive_bash (tmux)
    Preconditions: A sample .jsonl trace file exists
    Steps:
      1. `tmux new-session -d -s tawny-t4b -x 220 -y 50`
      2. `tmux send-keys -t tawny-t4b "bun run src/index.tsx --theme nonexistent <trace-file> 2>/tmp/tawny-t4b-err.txt" Enter`
      3. Wait 2 seconds
      4. `tmux kill-session -t tawny-t4b`
      5. Run `cat /tmp/tawny-t4b-err.txt`
      6. Verify no crash — should fall back to Tokyo Night
    Expected Result: App starts without error
    Failure Indicators: Error messages, stack traces
    Evidence: .sisyphus/evidence/task-4-launch-invalid-theme.txt

  Scenario: No hardcoded hex colors remain in app.tsx
    Tool: Bash
    Steps:
      1. Run `grep -n '#1a1b26\|#7aa2f7\|#565f89' src/app.tsx`
      2. Verify 0 matches
    Expected Result: No hardcoded hex colors in app.tsx
    Failure Indicators: Any grep matches
    Evidence: .sisyphus/evidence/task-4-no-hardcoded-colors.txt
  ```

  **Commit**: YES
  - Message: `feat(theme): wire theme into CLI args, config loading, and provider tree`
  - Files: `src/index.tsx`, `src/app.tsx`
  - Pre-commit: `bunx tsc --noEmit`

- [x] 5. Migrate trace-list.tsx and service-filter.tsx to useTheme()

  **What to do**:
  - **src/component/trace-list.tsx**:
    - Remove the local `const theme = { ... }` object (lines ~5-17)
    - Import `useTheme` from `../context/theme`
    - Create a local mapping from the 15 canonical tokens to the component's local key names:
      ```
      const t = useTheme()
      // Map canonical tokens to component usage:
      // selected → t.colors.bgHighlight, normal → t.colors.bg, header → t.colors.border,
      // headerFg → t.colors.headerFg, traceId → t.colors.accent2, service → t.colors.accent3,
      // duration → t.colors.accent, spanCount → t.colors.fgDim, error → t.colors.error,
      // ok → t.colors.success, unset → t.colors.fgDim, dim → t.colors.fgDim,
      // searchBg → t.colors.bgHighlight, searchFg → t.colors.fg
      ```
    - Replace all `theme.xxx` usages with the mapped `t.colors.xxx` equivalents
    - Update any inline hardcoded colors if present
  - **src/component/service-filter.tsx**:
    - Remove the local `const theme = { ... }` object
    - Import `useTheme` from `../context/theme`
    - Map canonical tokens:
      ```
      // bg → t.colors.bgAlt, border → t.colors.border, header → t.colors.fg,
      // selected → t.colors.bgHighlight, normal → t.colors.bg, service → t.colors.accent3,
      // check → t.colors.success, uncheck → t.colors.fgDim, dim → t.colors.fgDim
      ```
    - Replace all `theme.xxx` usages

  **Must NOT do**:
  - Do not change any component behavior or layout
  - Do not add keyboard guard for theme picker yet (that's Task 10)
  - Do not rename variables beyond replacing theme references

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Mechanical find-and-replace of theme references, 2 files
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 8, 9)
  - **Blocks**: Task 10
  - **Blocked By**: Tasks 3, 4

  **References**:

  **Pattern References**:
  - `src/component/trace-list.tsx` — Full file, especially local theme object and all `theme.xxx` usages
  - `src/component/service-filter.tsx` — Full file, local theme object and all usages

  **API/Type References**:
  - `src/context/theme.tsx` (Task 3) — useTheme() hook returning `{ colors, servicePalette, id, ... }`
  - `src/themes.ts` (Task 1) — ThemeColors interface for token names

  **WHY Each Reference Matters**:
  - Must read the full components to find every `theme.xxx` reference and map it to the correct canonical token

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Both components compile after migration
    Tool: Bash
    Steps:
      1. Run `bunx tsc --noEmit`
      2. Check exit code is 0
    Expected Result: No type errors
    Failure Indicators: Any tsc error in trace-list.tsx or service-filter.tsx
    Evidence: .sisyphus/evidence/task-5-tsc-check.txt

  Scenario: No hardcoded hex colors in migrated files
    Tool: Bash
    Steps:
      1. Run `grep -n '#[0-9a-fA-F]\{6\}' src/component/trace-list.tsx src/component/service-filter.tsx`
      2. Verify 0 matches
    Expected Result: Zero hardcoded hex colors
    Failure Indicators: Any grep matches
    Evidence: .sisyphus/evidence/task-5-no-hardcoded.txt

  Scenario: No remaining local theme object
    Tool: Bash
    Steps:
      1. Run `grep -n 'const theme' src/component/trace-list.tsx src/component/service-filter.tsx`
      2. Verify 0 matches (the old local theme objects are removed)
    Expected Result: No local theme constants
    Failure Indicators: Any match for `const theme`
    Evidence: .sisyphus/evidence/task-5-no-local-theme.txt
  ```

  **Commit**: NO (groups with Tasks 6, 7, 8)

- [x] 6. Migrate trace-detail.tsx and trace-flamegraph.tsx to useTheme()

  **What to do**:
  - **src/component/trace-detail.tsx**:
    - Remove the local `const theme = { ... }` object
    - Import `useTheme` from `../context/theme`
    - Map canonical tokens:
      ```
      // selected → bgHighlight, normal → bg, header → border, headerFg → headerFg,
      // spanName → fg, duration → accent, error → error, ok → success,
      // unset → fgDim, dim → fgDim, tree → fgDim, rulerFg → fgDim,
      // barBg → barFill, divider → border, collapseIndicator → accent
      ```
    - Replace all `theme.xxx` usages
    - ALSO migrate inline hardcoded colors:
      - Search bar `backgroundColor="#24283b"` → `bgAlt`
      - Search bar `backgroundColor="#292e42"` → `bgHighlight`
      - Search bar `fg="#c0caf5"` → `fg`
      - Column header `backgroundColor="#24283b"` → `bgAlt`
    - Update `serviceColorMap` call to pass theme's servicePalette (see Task 8 — if Task 8 is not yet complete, leave a TODO comment)
  - **src/component/trace-flamegraph.tsx**:
    - Remove the local `const theme = { ... }` object
    - Import `useTheme` from `../context/theme`
    - Map canonical tokens:
      ```
      // normal → bg, selected → bgHighlight, header → border, headerFg → headerFg,
      // dim → fgDim, rulerBg → bgAlt, rulerFg → fgDim, fill → barFill,
      // error → error, duration → accent, zoom → warning
      ```
    - Replace all `theme.xxx` usages
    - Update `serviceColorMap` call similarly

  **Must NOT do**:
  - Do not change layout, waterfall drawing logic, or flamegraph rendering
  - Do not alter serviceColorMap behavior (Task 8 handles that)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Mechanical theme migration, 2 files
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 7, 8, 9)
  - **Blocks**: Task 10
  - **Blocked By**: Tasks 3, 4

  **References**:

  **Pattern References**:
  - `src/component/trace-detail.tsx` — Full file, local theme + inline hardcoded hex colors in search bar and column headers
  - `src/component/trace-flamegraph.tsx` — Full file, local theme object

  **API/Type References**:
  - `src/context/theme.tsx` (Task 3) — useTheme()
  - `src/themes.ts` (Task 1) — ThemeColors token names

  **WHY Each Reference Matters**:
  - trace-detail has BOTH a theme object AND inline hardcoded colors — must catch all of them
  - trace-flamegraph maps `zoom` to `warning` which is a non-obvious mapping

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Both components compile after migration
    Tool: Bash
    Steps:
      1. Run `bunx tsc --noEmit`
    Expected Result: No type errors
    Failure Indicators: Any tsc error
    Evidence: .sisyphus/evidence/task-6-tsc-check.txt

  Scenario: No hardcoded hex colors in migrated files
    Tool: Bash
    Steps:
      1. Run `grep -n '#[0-9a-fA-F]\{6\}' src/component/trace-detail.tsx src/component/trace-flamegraph.tsx`
      2. Verify 0 matches
    Expected Result: Zero hardcoded hex colors
    Failure Indicators: Any grep matches
    Evidence: .sisyphus/evidence/task-6-no-hardcoded.txt
  ```

  **Commit**: NO (groups with Tasks 5, 7, 8)

- [x] 7. Migrate span-detail.tsx, status-bar.tsx, and app.tsx inline colors to useTheme()

  **What to do**:
  - **src/component/span-detail.tsx**:
    - Remove the local `const theme = { ... }` object
    - Import `useTheme` from `../context/theme`
    - Map canonical tokens:
      ```
      // header → border, headerFg → headerFg, label → accent, value → fg,
      // dim → fgDim, error → error, ok → success, unset → fgDim,
      // attrKey → accent2, attrVal → success, sectionBg → bgAlt,
      // normal → bg, selected → bgHighlight
      ```
    - Replace all `theme.xxx` usages
  - **src/component/status-bar.tsx**:
    - Remove the local `const theme = { key, desc, sep }` object
    - Remove the hardcoded `backgroundColor="#1a1b26"`
    - Import `useTheme` from `../context/theme`
    - Map: `key → accent`, `desc → fgDim`, `sep → border`, `backgroundColor → bg`
    - Replace all usages
    - Add `t` keyboard hint to the hints list for the appropriate routes (all routes should show it): add `["t", "theme"]` to the hints array
  - **src/app.tsx** (inline colors only — provider wiring done in Task 4):
    - Verify all inline hex colors in AppContent are now using `useTheme()` (Task 4 should have handled the root `backgroundColor` and title bar colors)
    - If any remain, migrate them now

  **Must NOT do**:
  - Do not change layout or component behavior
  - Do not add theme picker keyboard handling (Task 10)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Mechanical theme migration, 3 files with small changes each
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 8, 9)
  - **Blocks**: Task 10
  - **Blocked By**: Tasks 3, 4

  **References**:

  **Pattern References**:
  - `src/component/span-detail.tsx` — Full file, local theme object with many keys
  - `src/component/status-bar.tsx` — Full file, local theme + inline backgroundColor, hints array structure
  - `src/app.tsx` — Check for any remaining inline hex values after Task 4

  **API/Type References**:
  - `src/context/theme.tsx` (Task 3) — useTheme()

  **WHY Each Reference Matters**:
  - span-detail has the most theme keys (~13) — must map all correctly
  - status-bar needs the `["t", "theme"]` hint added — check where route-based hints are defined
  - app.tsx may still have inline colors if Task 4 missed any

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: All 3 files compile after migration
    Tool: Bash
    Steps:
      1. Run `bunx tsc --noEmit`
    Expected Result: No type errors
    Failure Indicators: Any tsc error
    Evidence: .sisyphus/evidence/task-7-tsc-check.txt

  Scenario: No hardcoded hex colors in migrated files
    Tool: Bash
    Steps:
      1. Run `grep -n '#[0-9a-fA-F]\{6\}' src/component/span-detail.tsx src/component/status-bar.tsx src/app.tsx`
      2. Verify 0 matches
    Expected Result: Zero hardcoded hex colors
    Failure Indicators: Any grep matches
    Evidence: .sisyphus/evidence/task-7-no-hardcoded.txt

  Scenario: Theme hint 't' appears in status bar hints
    Tool: Bash
    Steps:
      1. Run `grep -n '"t".*theme\|theme.*"t"' src/component/status-bar.tsx`
      2. Verify at least 1 match
    Expected Result: Theme hint is present
    Failure Indicators: No match found
    Evidence: .sisyphus/evidence/task-7-theme-hint.txt
  ```

  **Commit**: NO (groups with Tasks 5, 6, 8)

- [x] 8. Update serviceColorMap to accept theme palette

  **What to do**:
  - **src/util/format.ts**:
    - Change `serviceColorMap(services: string[])` signature to `serviceColorMap(services: string[], palette?: string[])`
    - If `palette` is provided, use it instead of the hardcoded `SERVICE_COLORS` array
    - Keep `SERVICE_COLORS` as a fallback default for backward compatibility during migration
    - The function body stays the same — it just uses `palette ?? SERVICE_COLORS` as the color source
  - **Update callers** (trace-detail.tsx, trace-flamegraph.tsx — if Tasks 5-6 left TODOs):
    - Pass `theme.servicePalette` as the second argument: `serviceColorMap(trace.services, theme.servicePalette)`
    - If trace-detail and flamegraph are already migrated (Tasks 5-6), update their `serviceColorMap` calls now
  - Eventually `SERVICE_COLORS` can be removed from format.ts once all callers pass the palette, but keep it for now as the default

  **Must NOT do**:
  - Do not remove SERVICE_COLORS yet — keep as default fallback
  - Do not change the mapping algorithm (hash-based assignment)
  - Do not change any formatting functions beyond serviceColorMap

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small signature change + caller updates
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 7, 9)
  - **Blocks**: Tasks 6 (if not yet done), 11
  - **Blocked By**: Tasks 1, 4

  **References**:

  **Pattern References**:
  - `src/util/format.ts:53-64` — Current SERVICE_COLORS array definition
  - `src/util/format.ts` — `serviceColorMap()` function, full implementation
  - `src/component/trace-detail.tsx` — Caller of serviceColorMap (look for `serviceColorMap(` call)
  - `src/component/trace-flamegraph.tsx` — Caller of serviceColorMap

  **WHY Each Reference Matters**:
  - format.ts contains the function to modify — must understand its algorithm
  - The callers must be updated to pass the theme's palette

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: serviceColorMap accepts optional palette
    Tool: Bash
    Steps:
      1. Run `bunx tsc --noEmit`
    Expected Result: No type errors
    Failure Indicators: Any tsc error
    Evidence: .sisyphus/evidence/task-8-tsc-check.txt

  Scenario: serviceColorMap produces correct output with custom palette
    Tool: Bash
    Steps:
      1. Run `bun -e "import { serviceColorMap } from './src/util/format'; const m = serviceColorMap(['svc-a', 'svc-b'], ['#ff0000', '#00ff00']); console.log(m.get('svc-a'), m.get('svc-b'))"`
      2. Verify output shows colors from the custom palette, not SERVICE_COLORS
    Expected Result: Colors are from the provided palette
    Failure Indicators: Colors from SERVICE_COLORS instead
    Evidence: .sisyphus/evidence/task-8-custom-palette.txt
  ```

  **Commit**: YES (groups Tasks 5, 6, 7, 8 together)
  - Message: `refactor(theme): migrate all components to centralized theme context`
  - Files: `src/component/trace-list.tsx`, `src/component/service-filter.tsx`, `src/component/trace-detail.tsx`, `src/component/trace-flamegraph.tsx`, `src/component/span-detail.tsx`, `src/component/status-bar.tsx`, `src/util/format.ts`
  - Pre-commit: `bunx tsc --noEmit`

- [x] 9. Build ThemePicker overlay component

  **What to do**:
  - Create `src/component/theme-picker.tsx` modeled after `src/component/service-filter.tsx`
  - Component renders a modal overlay listing all 5 themes
  - **Layout**:
    - `position="absolute"`, centered (similar to ServiceFilter's left/top positioning)
    - `borderStyle="rounded"`, `border`, `borderColor` from theme
    - Title: "Theme" or "Select Theme"
    - Width ~40, height ~12 (enough for 5 themes + header)
  - **Each row**: Show theme name, with a checkmark (✓) or indicator for the currently active theme
  - **Keyboard handling** (via `useKeyboard`):
    - Guard: `if (!theme.showThemePicker) return` — early return if picker not visible
    - `j`/`k`/`down`/`up` — move cursor through theme list
    - `Enter` — confirm selection: call `theme.setTheme(selectedId)`, call `writeConfig({ theme: selectedId })` from `src/config.ts`, call `theme.closeThemePicker()`
    - `Escape` — cancel: revert to previous theme (restore the theme that was active when picker opened), call `theme.closeThemePicker()`
    - `g` — jump to top, `G` (shift+g) — jump to bottom
  - **Live preview**: On cursor movement, call `theme.setTheme(hoveredThemeId)` so the entire UI updates in real-time. Store the "original" theme ID when the picker opens so Escape can revert.
  - **State**: Use `createSignal` for cursor position and `originalThemeId` (set when picker opens)
  - Import `useTheme` from `../context/theme`, `writeConfig` from `../config`, `useKeyboard` from `@opentui/solid`

  **Must NOT do**:
  - Do not add mouse input handling
  - Do not add color swatch previews (just theme names — the live preview IS the preview)
  - Do not extract a shared modal component — copy ServiceFilter's layout approach directly
  - Do not add transition animations

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: New component with keyboard handling, live preview state management, and config persistence
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 7, 8)
  - **Blocks**: Task 10
  - **Blocked By**: Tasks 1, 3, 4

  **References**:

  **Pattern References**:
  - `src/component/service-filter.tsx` — **PRIMARY reference**: Copy the EXACT layout pattern (position absolute, border, borderColor, left/top centering), keyboard handler structure (useKeyboard with guard, j/k/up/down, g/G, Enter, Escape), cursor state management, and row rendering with selected highlight
  - `src/component/trace-list.tsx` — Shows how search mode is toggled and keyboard keys are captured — useful for understanding the keyboard guard pattern

  **API/Type References**:
  - `src/context/theme.tsx` (Task 3) — useTheme() with showThemePicker, closeThemePicker, setTheme, allThemes, id, colors
  - `src/config.ts` (Task 2) — writeConfig({ theme: id })
  - `src/themes.ts` (Task 1) — Theme type

  **WHY Each Reference Matters**:
  - ServiceFilter is the EXACT modal pattern to follow — don't deviate from it
  - config.ts provides the persistence function to call on Enter

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: ThemePicker compiles without errors
    Tool: Bash
    Steps:
      1. Run `bunx tsc --noEmit`
    Expected Result: No type errors
    Failure Indicators: Any tsc error referencing theme-picker.tsx
    Evidence: .sisyphus/evidence/task-9-tsc-check.txt

  Scenario: ThemePicker component is a valid SolidJS component
    Tool: Bash
    Steps:
      1. Run `bun -e "import { ThemePicker } from './src/component/theme-picker'; console.log(typeof ThemePicker)"`
      2. Verify output is "function"
    Expected Result: Component exports correctly
    Failure Indicators: Import error, not a function
    Evidence: .sisyphus/evidence/task-9-exports.txt

  Scenario: ThemePicker uses useKeyboard with guard
    Tool: Bash
    Steps:
      1. Run `grep -n 'showThemePicker' src/component/theme-picker.tsx`
      2. Verify guard pattern exists (early return when picker not shown)
    Expected Result: Guard pattern present
    Failure Indicators: No guard found
    Evidence: .sisyphus/evidence/task-9-keyboard-guard.txt

  Scenario: ThemePicker has all required key handlers (grep only — TUI interaction verified in Task 10)
    Tool: Bash
    Steps:
      1. Run `grep -n 'Enter\|Escape\|originalThemeId\|writeConfig\|closeThemePicker' src/component/theme-picker.tsx`
      2. Verify all 5 identifiers appear — confirming Enter, Escape, originalThemeId, writeConfig, and closeThemePicker are all present in the component
    Expected Result: All 5 identifiers found
    Failure Indicators: Any missing identifier
    Evidence: .sisyphus/evidence/task-9-key-handlers.txt
  ```

  **Commit**: YES
  - Message: `feat(theme): add theme picker overlay component`
  - Files: `src/component/theme-picker.tsx`
  - Pre-commit: `bunx tsc --noEmit`

- [x] 10. Add keyboard guards and wire theme picker into all views

  **What to do**:
  - Add `showThemePicker` guard to ALL 5 `useKeyboard` handlers:
    - `src/component/trace-list.tsx`
    - `src/component/trace-detail.tsx`
    - `src/component/span-detail.tsx`
    - `src/component/trace-flamegraph.tsx`
    - `src/component/service-filter.tsx`
  - For each handler, add at the TOP (before all other guards):
    ```typescript
    if (theme.showThemePicker) return
    ```
    Where `theme = useTheme()` is called outside the keyboard handler.
  - Add `t` key binding in the handlers for ALL 4 view components (trace-list, trace-detail, span-detail, trace-flamegraph):
    ```typescript
    if (key.name === "t") { filter.closeServiceFilter(); theme.openThemePicker(); return }
    ```
    Import `useFilter` where it is not already imported.
  - **CRITICAL — guard ordering in trace-list.tsx**: The existing handler has an early return when `filter.showServiceFilter` is true (the service filter guard). The `t` binding MUST be placed BEFORE this service filter guard, not after. This allows pressing `t` while the service filter is open to close it and open the theme picker. The order must be:
    ```typescript
    useKeyboard((key) => {
      if (theme.showThemePicker) return          // 1. theme picker guard (blocks all keys when picker open)
      if (key.name === "t") { filter.closeServiceFilter(); theme.openThemePicker(); return }  // 2. 't' BEFORE service filter guard
      if (filter.showServiceFilter) return       // 3. service filter guard (after 't' check)
      // ... rest of trace-list key bindings
    })
    ```
    The same ordering applies in trace-detail, span-detail, and trace-flamegraph: `showThemePicker` guard first, then `t` binding, then any other route guards.
  - Do NOT add `t` to the service-filter handler — it only handles its own overlay keys.
  - In `src/app.tsx`: replace the `<Show>` placeholder comment from Task 4 with the real import and render:
    ```tsx
    import { ThemePicker } from "./component/theme-picker"
    // ...
    <Show when={theme.showThemePicker}><ThemePicker /></Show>
    ```

  **Must NOT do**:
  - Do not change any existing key bindings
  - Do not refactor the keyboard guard architecture into a centralized dispatcher
  - Do not add 't' key to the service-filter component's own keyboard handler

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Touches all 5 keyboard handlers precisely; easy to miss one or introduce a subtle guard-ordering bug
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 11)
  - **Parallel Group**: Wave 3
  - **Blocks**: F1-F4 (final verification)
  - **Blocked By**: Tasks 2, 5, 6, 7, 9

  **References**:

  **Pattern References**:
  - `src/component/service-filter.tsx` — Shows the EXACT guard pattern: `if (!filter.showServiceFilter) return` at top of useKeyboard handler — replicate for theme picker
  - `src/component/trace-list.tsx` — Shows how `filter.toggleServiceFilter()` is called on 'f' key; same pattern for theme picker 't' key
  - `src/app.tsx` — Where the `<Show when={theme.showThemePicker}>` wrapper lives (added in Task 4 as placeholder)

  **API/Type References**:
  - `src/context/theme.tsx` (Task 3) — useTheme(), showThemePicker, openThemePicker
  - `src/context/filter.tsx` — useFilter(), closeServiceFilter()
  - `src/component/theme-picker.tsx` (Task 9) — ThemePicker component

  **WHY Each Reference Matters**:
  - The guard pattern MUST be consistent — service-filter.tsx is the canonical example
  - trace-list.tsx shows how an overlay is opened from a keyboard handler (exact pattern to replicate)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: All 5 keyboard handlers have the theme picker guard
    Tool: Bash
    Steps:
      1. Run `grep -l 'showThemePicker' src/component/trace-list.tsx src/component/trace-detail.tsx src/component/span-detail.tsx src/component/trace-flamegraph.tsx src/component/service-filter.tsx`
      2. Verify all 5 filenames are printed
    Expected Result: All 5 files listed
    Failure Indicators: Fewer than 5 files
    Evidence: .sisyphus/evidence/task-10-guards-all-handlers.txt

  Scenario: All 4 view components have the 't' key binding
    Tool: Bash
    Steps:
      1. Run `grep -l 'openThemePicker' src/component/trace-list.tsx src/component/trace-detail.tsx src/component/span-detail.tsx src/component/trace-flamegraph.tsx`
      2. Verify all 4 filenames are printed
    Expected Result: All 4 files listed
    Failure Indicators: Fewer than 4 files
    Evidence: .sisyphus/evidence/task-10-t-key-bindings.txt

  Scenario: Codebase compiles after keyboard wiring
    Tool: Bash
    Steps:
      1. Run `bunx tsc --noEmit`
    Expected Result: Exit code 0, no type errors
    Failure Indicators: Any tsc error output
    Evidence: .sisyphus/evidence/task-10-tsc-check.txt

  Scenario: Theme picker opens with 't' from trace-list (interactive)
    Tool: interactive_bash (tmux)
    Preconditions: A sample .jsonl trace file exists
    Steps:
      1. `tmux new-session -d -s tawny-qa1 -x 220 -y 50`
      2. `tmux send-keys -t tawny-qa1 "bun run src/index.tsx <trace-file>" Enter`
      3. Wait 2 seconds for TUI to render
      4. `tmux send-keys -t tawny-qa1 "t" ""`
      5. Wait 0.5 seconds
      6. `tmux capture-pane -t tawny-qa1 -p`
      7. Verify output contains "Theme" or "Select Theme" header text
      8. `tmux send-keys -t tawny-qa1 "Escape" ""`
      9. Wait 0.3 seconds; capture pane again, verify "Theme" overlay is gone
      10. `tmux kill-session -t tawny-qa1`
    Expected Result: Theme picker visible after 't'; dismissed with Escape
    Failure Indicators: No "Theme" text in capture, picker stays open after Escape
    Evidence: .sisyphus/evidence/task-10-picker-from-list.txt

  Scenario: Live preview updates on cursor movement (interactive)
    Tool: interactive_bash (tmux)
    Preconditions: App running in tmux, theme picker open (see scenario above)
    Steps:
      1. `tmux new-session -d -s tawny-preview -x 220 -y 50`
      2. `tmux send-keys -t tawny-preview "bun run src/index.tsx <trace-file>" Enter`
      3. Wait 2s; send 't' to open picker
      4. `tmux capture-pane -t tawny-preview -p` → save as baseline
      5. `tmux send-keys -t tawny-preview "j" ""`
      6. Wait 0.3 seconds; `tmux capture-pane -t tawny-preview -p` → save as after-j
      7. Verify pane content changed between baseline and after-j (different theme name highlighted OR visible background color difference in the text)
      8. `tmux send-keys -t tawny-preview "Escape" ""`
      9. Wait 0.3 seconds; `tmux capture-pane -t tawny-preview -p` → verify original theme name is active again (Tokyo Night row no longer highlighted, or the overall color scheme reverted)
      10. `tmux kill-session -t tawny-preview`
    Expected Result: UI content changes after 'j'; Escape restores the original theme row as active
    Failure Indicators: Pane content identical before and after 'j', or Escape does not revert theme
    Evidence: .sisyphus/evidence/task-10-live-preview.txt

  Scenario: App launches cleanly with all wiring in place
    Tool: interactive_bash (tmux)
    Preconditions: A sample .jsonl trace file exists (create a minimal one if needed)
    Steps:
      1. `tmux new-session -d -s tawny-t10 -x 220 -y 50`
      2. `tmux send-keys -t tawny-t10 "bun run src/index.tsx <trace-file> 2>/tmp/tawny-t10-err.txt" Enter`
      3. Wait 2 seconds
      4. `tmux kill-session -t tawny-t10`
      5. Run `cat /tmp/tawny-t10-err.txt`
      6. Verify no stack traces, import errors, or "Cannot find module" messages
    Expected Result: Clean launch, no JS/TS errors
    Failure Indicators: Stack traces, import errors, "Cannot find module"
    Evidence: .sisyphus/evidence/task-10-app-launch.txt

  Scenario: Theme picker accessible from trace-detail view (interactive)
    Tool: interactive_bash (tmux)
    Preconditions: A sample .jsonl trace file with at least one trace exists
    Steps:
      1. `tmux new-session -d -s tawny-qa2 -x 220 -y 50`
      2. `tmux send-keys -t tawny-qa2 "bun run src/index.tsx <trace-file>" Enter`
      3. Wait 2s; send Enter to open first trace detail
      4. Wait 1s; send 't' key
      5. Wait 0.5s; capture pane: `tmux capture-pane -t tawny-qa2 -p`
      6. Verify "Theme" or "Select Theme" text appears in capture
      7. Send Escape, kill session
    Expected Result: Picker opens from trace-detail route
    Failure Indicators: No picker text visible
    Evidence: .sisyphus/evidence/task-10-picker-from-detail.txt

  Scenario: Theme picker and service filter are mutually exclusive (interactive)
    Tool: interactive_bash (tmux)
    Preconditions: Same as above (trace-list view)
    Steps:
      1. Launch app in tmux
      2. Open service filter with 'f'
      3. Capture pane, verify service filter visible
      4. Send 't' to open theme picker
      5. Capture pane: verify theme picker appears AND service filter is no longer visible
      6. Kill session
    Expected Result: Opening theme picker closes service filter
    Failure Indicators: Both overlays visible at same time, or theme picker does not open
    Evidence: .sisyphus/evidence/task-10-mutual-exclusion.txt

  Scenario: Enter confirms theme and persists to config (interactive)
    Tool: interactive_bash (tmux) + Bash
    Preconditions: Clean config state; set `XDG_CONFIG_HOME=/tmp/tawny-qa-config-$$`
    Steps:
      1. `tmux new-session -d -s tawny-qa3 -x 220 -y 50`
      2. `tmux send-keys -t tawny-qa3 "XDG_CONFIG_HOME=/tmp/tawny-qa-config-$$ bun run src/index.tsx <trace-file>" Enter`
      3. Wait 2s; send 't' to open picker
      4. Send 'j' twice (cursor on third theme, e.g., Dracula)
      5. Send Enter
      6. Wait 0.5s; kill the app: `tmux kill-session -t tawny-qa3`
      7. Run `cat /tmp/tawny-qa-config-$$/tawny/config.json`
      8. Verify content is `{"theme":"dracula"}` (or whichever theme was selected)
      9. Cleanup: `rm -rf /tmp/tawny-qa-config-$$`
    Expected Result: Config file exists with correct theme ID after Enter
    Failure Indicators: File missing, wrong theme ID, app crashes on Enter
    Evidence: .sisyphus/evidence/task-10-enter-persists.txt
  ```

  **Commit**: YES
  - Message: `feat(theme): add keyboard guards and wire picker into all views`
  - Files: `src/component/trace-list.tsx`, `src/component/trace-detail.tsx`, `src/component/span-detail.tsx`, `src/component/trace-flamegraph.tsx`, `src/component/service-filter.tsx`, `src/app.tsx`
  - Pre-commit: `bunx tsc --noEmit`

- [x] 11. Update web.ts for theme support

  **What to do**:
  - **src/web.ts**:
    - Change function signature: `generateHtml(traces: TraceSummary[])` → `generateHtml(traces: TraceSummary[], themeId?: string)`
    - Import `THEMES`, `DEFAULT_THEME_ID` from `./themes` at the top of the file
    - Resolve theme at the start of the function:
      ```typescript
      const theme = THEMES[themeId ?? DEFAULT_THEME_ID] ?? THEMES[DEFAULT_THEME_ID]
      ```
    - Replace the hardcoded CSS `:root { ... }` block values with interpolated theme tokens:
      ```css
      :root {
        --bg: ${theme.colors.bg};
        --surface: ${theme.colors.bgAlt};
        --border: ${theme.colors.border};
        --text: ${theme.colors.fg};
        --text-dim: ${theme.colors.fgDim};
        --accent: ${theme.colors.accent};
        --error: ${theme.colors.error};
        --ok: ${theme.colors.success};
        --warn: ${theme.colors.warning};
        --hover: ${theme.colors.bgHighlight};
        --selected: ${theme.colors.bgHighlight};
        --text-bright: ${theme.colors.fg};
      }
      ```
    - Replace the hardcoded `SERVICE_COLORS` JS array literal inside the embedded `<script>` block with the theme's palette:
      ```javascript
      const SERVICE_COLORS = ${JSON.stringify(theme.servicePalette)};
      ```
    - Remove the old duplicate `SERVICE_COLORS` hardcoded array from the embedded JS
  - **src/index.tsx**: Update the `generateHtml(traces)` call to pass the resolved theme ID: `generateHtml(traces, resolvedThemeId)`. **This call-site change in index.tsx is owned by Task 11** — Task 4 intentionally left it as `generateHtml(traces)` to avoid cross-task tsc failures.

  **Must NOT do**:
  - Do not add an interactive theme switcher to the HTML report — static injection only
  - Do not restructure web.ts beyond the `:root` and SERVICE_COLORS substitutions
  - Do not add new CSS variables that don't already exist

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Template string substitution in a single isolated file + one call-site update
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 10)
  - **Parallel Group**: Wave 3
  - **Blocks**: F1-F4 (final verification)
  - **Blocked By**: Tasks 1, 4, 8

  **References**:

  **Pattern References**:
  - `src/web.ts` — Read the full file. Find the `:root {` CSS block and the embedded `<script>` section containing `SERVICE_COLORS`. These are the two substitution targets.
  - `src/index.tsx` — Find the `generateHtml(traces)` call in the `--web` branch; add the resolved theme ID argument here

  **API/Type References**:
  - `src/themes.ts` (Task 1) — THEMES, DEFAULT_THEME_ID, ThemeColors token names
  - `src/types.ts` — TraceSummary (for the updated function signature)

  **WHY Each Reference Matters**:
  - web.ts is ~726 lines; must locate the exact `:root` CSS block and the JS SERVICE_COLORS array — don't guess, read the file

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: web.ts compiles without errors
    Tool: Bash
    Steps:
      1. Run `bunx tsc --noEmit`
    Expected Result: Exit code 0
    Failure Indicators: Any tsc error referencing web.ts
    Evidence: .sisyphus/evidence/task-11-tsc-check.txt

  Scenario: Web report contains Nord background color when --theme nord
    Tool: Bash
    Preconditions: A sample .jsonl trace file exists
    Steps:
      1. Run `bun run src/index.tsx --web --theme nord <trace-file> > /tmp/tawny-nord-test.html 2>&1`
      2. Run `grep '#2e3440' /tmp/tawny-nord-test.html`
      3. Verify at least 1 match (Nord's bg color in :root)
      4. Clean up: `rm /tmp/tawny-nord-test.html`
    Expected Result: Nord's #2e3440 background appears in CSS :root
    Failure Indicators: No match, or Tokyo Night colors (#1a1b26) appear instead
    Evidence: .sisyphus/evidence/task-11-nord-web-colors.txt

  Scenario: Web report SERVICE_COLORS matches theme palette for Catppuccin
    Tool: Bash
    Preconditions: A sample .jsonl trace file exists
    Steps:
      1. Run `bun run src/index.tsx --web --theme catppuccin-mocha <trace-file> > /tmp/tawny-ctp-test.html 2>&1`
      2. Run `grep 'SERVICE_COLORS' /tmp/tawny-ctp-test.html`
      3. Verify the array contains Catppuccin Mocha palette colors (NOT the old Tokyo Night SERVICE_COLORS)
      4. Clean up: `rm /tmp/tawny-ctp-test.html`
    Expected Result: Catppuccin service palette injected
    Failure Indicators: Old hardcoded Tokyo Night palette colors present
    Evidence: .sisyphus/evidence/task-11-catppuccin-service-colors.txt

  Scenario: No hardcoded hex colors in :root block of web.ts
    Tool: Bash
    Steps:
      1. Run `grep -A 20 ':root {' src/web.ts | grep -E '#[0-9a-fA-F]{6}'`
      2. Verify 0 matches (all :root values are now template expressions)
    Expected Result: Zero hardcoded hex values in :root block
    Failure Indicators: Any hardcoded hex color found
    Evidence: .sisyphus/evidence/task-11-no-hardcoded-root.txt
  ```

  **Commit**: YES
  - Message: `feat(theme): add theme support to web HTML report`
  - Files: `src/web.ts`, `src/index.tsx`
  - Pre-commit: `bunx tsc --noEmit`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `bunx tsc --noEmit`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names. Verify no semicolons in TS source (project convention).
  Output: `Build [PASS/FAIL] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence to `.sisyphus/evidence/final-qa/`. For interactive TUI scenarios use `interactive_bash` (tmux) with the exact keystrokes specified. For CLI scenarios use Bash. Specifically verify these cross-task integration cases:
  - Open theme picker with 't' from ALL 4 routes (trace-list, trace-detail, span-detail, trace-flamegraph)
  - Live preview: cursor movement on 'j'/'k' changes visible colors in real-time
  - Enter confirms selection AND writes `~/.config/tawny/config.json` (verify file content)
  - Escape reverts to the theme that was active before picker opened (verify visually via tmux)
  - Service filter + theme picker mutual exclusion: opening one closes the other
  - Theme persistence round-trip: select Dracula, restart app without --theme, verify Dracula loads
  - Web report theme injection: run with --theme nord, verify Nord hex in HTML output
  - Missing config file: delete config, verify app starts with Tokyo Night default
  - Malformed config: write `{broken}` to config, verify app starts with Tokyo Night default
  - Invalid --theme flag: `--theme nonexistent` falls back to default, no crash
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT: APPROVE/REJECT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff. Verify 1:1 — everything in spec was built, nothing beyond spec. Check "Must NOT do" compliance. Detect cross-task contamination. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| After Task(s) | Commit Message | Key Files |
|--------------|---------------|-----------|
| 1 | `feat(theme): add theme interface and 5 built-in theme definitions` | src/themes.ts |
| 2 | `feat(config): add config read/write utility` | src/config.ts |
| 3 | `feat(theme): add ThemeContext using createSimpleContext` | src/context/theme.tsx |
| 4 | `feat(theme): wire theme into CLI args, config loading, and provider tree` | src/index.tsx, src/app.tsx |
| 5-8 | `refactor(theme): migrate all components to centralized theme context` | src/component/*.tsx, src/util/format.ts |
| 9 | `feat(theme): add theme picker overlay component` | src/component/theme-picker.tsx |
| 10 | `feat(theme): add keyboard guards and wire picker into all views` | src/component/*.tsx |
| 11 | `feat(theme): add theme support to web HTML report` | src/web.ts |

---

## Success Criteria

### Verification Commands
```bash
bunx tsc --noEmit                          # Expected: 0 errors
bun run src/index.tsx --theme dracula test.jsonl  # Expected: launches with Dracula colors
bun run src/index.tsx --theme bogus test.jsonl    # Expected: launches with Tokyo Night (fallback)
bun run src/index.tsx --web --theme nord test.jsonl | grep '#2e3440'  # Expected: Nord bg color found
cat ~/.config/tawny/config.json             # Expected: {"theme":"<selected>"}
grep -rn '#1a1b26' src/component/ src/app.tsx  # Expected: 0 matches
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] `bunx tsc --noEmit` passes
- [ ] All 5 themes render without crashes
- [ ] Theme picker accessible from all 4 routes
- [ ] Config persistence works (write on Enter, read on startup)
- [ ] Web report embeds correct theme colors
- [ ] Zero hardcoded hex colors in component files
