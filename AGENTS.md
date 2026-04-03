# AGENTS.md — Tawny (OpenTUI Traces)

Terminal-based OpenTelemetry JSONL trace viewer built with **Bun**, **SolidJS**, and **@opentui/solid** (TUI framework). Also supports generating a self-contained HTML report via `--web`.

## Build & Run Commands

```bash
bun install                              # Install dependencies
bun run dev                              # Run app (TUI mode): bun run src/index.tsx
bun run start                            # Same as dev
bun run src/index.tsx <traces.jsonl>     # Open a specific trace file in TUI
bun run src/index.tsx --web <traces.jsonl> > report.html  # Generate HTML report
bunx tsc --noEmit                        # Type-check (no emit — tsconfig has noEmit: true)
```

There is **no test runner, linter, or formatter** configured. There are no test files.
If you add tests, use `bun test` (Bun's built-in runner). Place test files alongside
source as `*.test.ts` or `*.test.tsx`. Run a single test with `bun test path/to/file.test.ts`.

## Project Structure

```
bin/
  cli.ts             CLI shebang entry point — imports preload, delegates to src/index.tsx
src/
  index.tsx          Entry point — CLI arg parsing, file reading, dispatches to TUI or web mode
  app.tsx            Root SolidJS component — provider nesting, layout shell, route switching
  parser.ts          OTLP JSONL parser — converts raw JSON lines into TraceSummary[]
  types.ts           All TypeScript types and const enum-like objects
  web.ts             Self-contained HTML report generator (~726 lines of embedded CSS + vanilla JS)
  component/
    trace-list.tsx   Trace list view with search/filter and virtual scrolling
    trace-detail.tsx Trace waterfall view with collapsible span tree
    span-detail.tsx  Single span detail view with attributes/events
    service-filter.tsx  Service filter modal overlay
    status-bar.tsx   Bottom status bar with keyboard hints
  context/
    helper.tsx       Generic createSimpleContext() factory
    route.tsx        Navigation state (trace-list / trace-detail / span-detail)
    traces.tsx       Loaded trace data store with Map-based lookup indexes
    filter.tsx       Search query + service filter + min-spans threshold state
  util/
    format.ts        Formatting helpers (duration, timestamps, truncation, waterfall, colors)
```

## Tech Stack

- **Runtime**: Bun (required — uses Bun-specific preload via `bunfig.toml`)
- **Language**: TypeScript (strict mode, ESNext target, bundler module resolution)
- **UI framework**: SolidJS with `@opentui/solid` for terminal rendering
- **JSX**: `jsxImportSource: "@opentui/solid"` — uses `<box>`, `<text>` primitives
- **State**: SolidJS signals (`createSignal`), stores (`createStore`), memos (`createMemo`)
- **Path alias**: `@/*` maps to `./src/*` (defined in tsconfig, but source uses relative paths)
- **Dual-mode**: TUI mode (default, SolidJS) and web mode (`--web`, vanilla JS HTML output)

## Code Style Guidelines

### Formatting

- **Indentation**: 2 spaces
- **Quotes**: Double quotes for all strings
- **Semicolons**: None in TypeScript source (semicolons only in embedded vanilla JS inside `web.ts`)
- **Trailing commas**: Yes, in multi-line constructs
- **Line length**: No hard limit, keep reasonable (~120 chars)
- **Arrow parens**: Single-parameter arrow functions in callbacks omit parens: `l => l.trim()`

### Imports

- Order: Node built-ins first, then external packages, then internal modules
- Named imports: `import { createSignal, For } from "solid-js"`
- Type-only imports: `import type { TraceSummary } from "./types"`
- Relative paths for internal imports: `"./context/route"`, `"../util/format"`
- No index re-exports — import directly from the source file
- No `@/*` alias in source — always use relative paths

### TypeScript & Types

- Strict mode enabled — do not use `any` unless truly necessary (e.g., `catch (err: any)`)
- Prefer `interface` for object shapes, `type` for unions/intersections
- Use `const` objects as enum replacements (see `SpanKind`, `StatusCode` in `types.ts`)
- Use `bigint` for nanosecond timestamps, `number` for millisecond durations
- Convert via `Number(nano / 1_000_000n)`
- Use `Map<K, V>` for key-value data (attributes), not plain objects
- Derive types from const objects: `type StatusCodeName = (typeof StatusCode)[keyof typeof StatusCode]`
- Union types for route state with discriminated `type` field

### Naming Conventions

- **Files**: `kebab-case.ts` / `kebab-case.tsx`
- **Components**: `PascalCase` function declarations: `export function TraceDetail() { ... }`
- **Hooks/context**: `camelCase` — `useRoute()`, `useTraces()`, `useFilter()`
- **Variables/functions**: `camelCase` — `flatSpans`, `formatDuration`, `clampCursor`
- **Constants**: `UPPER_SNAKE_CASE` for module-level values (`FILL`, `SERVICE_COLORS`, `MIN_SPANS_THRESHOLDS`)
- **Theme objects**: `camelCase` keys (`headerFg`, `spanName`, `collapseIndicator`)
- **Types/Interfaces**: `PascalCase` — `ParsedSpan`, `TraceSummary`, `FlatSpan`, `DetailRow`
- **Context exports**: `{ use: useX, provider: XProvider }` from `createSimpleContext()`

### Component Patterns

- Components are **plain function declarations**, not arrow functions
- Theme objects are `const` at module scope, not inside components
- Use `createMemo` for derived/computed values, `createSignal` for local state
- Keyboard handling via `useKeyboard((key) => { ... })` from `@opentui/solid`
- Use SolidJS control flow: `<For>`, `<Show>`, `<Switch>`/`<Match>` for reactive rendering
  (exception: `.map()` is OK for static/non-reactive arrays like keyboard hints)
- JSX uses `<box>` and `<text>` primitives — not HTML elements
- Layout via flexbox props: `flexDirection`, `flexGrow`, `width`, `height`
- Colors as hex strings in theme objects
- Virtual scrolling via manual `cursor` + `scrollOffset` + `visibleHeight` signals

### Context / State Management

- Use `createSimpleContext()` helper from `src/context/helper.tsx` for all new contexts
- Context shape: getter properties for reactive reads, methods for mutations
- Provider nesting order in `app.tsx`: `RouteProvider > TracesProvider > FilterProvider`
- Example pattern:
  ```tsx
  export const { use: useFoo, provider: FooProvider } = createSimpleContext({
    name: "Foo",
    init: () => {
      const [value, setValue] = createSignal(initialValue)
      return {
        get value() { return value() },
        update(v: NewType) { setValue(v) },
      }
    },
  })
  ```

### Error Handling

- Use try/catch for I/O operations (file reading, JSON parsing)
- Catch with `err: any` and access `.message` for error output
- Use `process.exit(1)` for fatal errors with a descriptive `console.error()` message
- For JSON parse failures in loops, silently `continue` (see `parseJsonl` in `parser.ts`)
- Validate data before processing (null checks, array checks)
- Use `??` for defaults, `?.` for optional chaining
- Non-null assertions (`!`) are acceptable when the value is guaranteed by prior logic
- Context hooks throw if used outside their provider

### Things to Avoid

- Do not add a bundler — Bun runs TypeScript directly
- Do not use HTML elements in components — this is a TUI app, use `<box>` and `<text>`
- Do not add `prettier` or `eslint` config — match the existing style manually
- Do not use React APIs — this is SolidJS (no `useState`, `useEffect`, etc.)
- Do not use `require()` — this is an ESM project (`"type": "module"`)
- Do not use `.map()` for reactive lists — use `<For>` instead
