# AGENTS.md — Tawny (OpenTUI Traces)

Terminal-based OpenTelemetry JSONL trace viewer built with **Bun**, **SolidJS**, and **@opentui/solid** (TUI framework).

## Build & Run Commands

```bash
# Install dependencies
bun install

# Run the app (dev or start are identical)
bun run dev              # runs: bun run src/index.tsx
bun run start            # runs: bun run src/index.tsx

# Run with a trace file
bun run src/index.tsx <path/to/traces.jsonl>

# Type-check (no emit — tsconfig has noEmit: true)
bunx tsc --noEmit
```

There is **no test runner, linter, or formatter** configured in this project. There are no test files.
If you add tests, use `bun test` (Bun's built-in test runner). Place test files alongside
source as `*.test.ts` or `*.test.tsx`.

## Project Structure

```
src/
  index.tsx          Entry point — CLI arg parsing, file reading, launches TUI
  app.tsx            Root SolidJS component — routing, providers, layout shell
  parser.ts          OTLP JSONL parser — converts raw JSON lines into TraceSummary[]
  types.ts           All TypeScript types and const enum-like objects
  component/         UI components (SolidJS + @opentui/solid JSX)
    trace-list.tsx   Trace list view with search/filter
    trace-detail.tsx Trace waterfall view with collapsible span tree
    span-detail.tsx  Single span detail view with attributes/events
    service-filter.tsx  Service filter modal overlay
    status-bar.tsx   Bottom status bar with keyboard hints
  context/           SolidJS context providers (app state)
    helper.tsx       Generic createSimpleContext() factory
    route.tsx        Navigation state (trace-list / trace-detail / span-detail)
    traces.tsx       Loaded trace data store with lookup indexes
    filter.tsx       Search query + service filter state
  util/
    format.ts        Formatting helpers (duration, timestamps, truncation, waterfall)
```

## Tech Stack

- **Runtime**: Bun (required — uses Bun-specific preload via `bunfig.toml`)
- **Language**: TypeScript (strict mode, ESNext target, bundler module resolution)
- **UI framework**: SolidJS with `@opentui/solid` for terminal rendering
- **JSX**: `jsxImportSource: "@opentui/solid"` — uses `<box>`, `<text>` primitives
- **State**: SolidJS signals (`createSignal`), stores (`createStore`), memos (`createMemo`)
- **Path alias**: `@/*` maps to `./src/*`

## Code Style Guidelines

### Formatting

- **Indentation**: 2 spaces
- **Quotes**: Double quotes for strings
- **Semicolons**: None (no semicolons)
- **Trailing commas**: Yes, in multi-line constructs
- **Line length**: No hard limit, but keep reasonable (~120 chars)
- **Parentheses**: Arrow functions with single params omit parens in callbacks

### Imports

- Order: Node built-ins first, then external packages, then internal modules
- Use named imports: `import { createSignal, For } from "solid-js"`
- Use `type` keyword for type-only imports: `import type { TraceSummary } from "./types"`
- Relative paths for internal imports: `"./context/route"`, `"../util/format"`
- No index re-exports — import directly from the source file

### TypeScript & Types

- Strict mode enabled — do not use `any` unless truly necessary (e.g., `catch (err: any)`)
- Prefer `interface` for object shapes, `type` for unions/intersections
- Use `const` objects as enum replacements (see `SpanKind`, `StatusCode` in `types.ts`)
- Use `bigint` for nanosecond timestamps, `number` for millisecond durations
- Use `Map<K, V>` for key-value data (attributes), not plain objects
- Derive types from const objects: `type StatusCodeName = (typeof StatusCode)[keyof typeof StatusCode]`
- Union types for route/navigation state with discriminated `type` field

### Naming Conventions

- **Files**: `kebab-case.ts` / `kebab-case.tsx`
- **Components**: `PascalCase` function components (`TraceDetail`, `ServiceFilter`)
- **Hooks/context**: `camelCase` — `useRoute()`, `useTraces()`, `useFilter()`
- **Variables/functions**: `camelCase` — `flatSpans`, `formatDuration`, `clampCursor`
- **Constants**: `camelCase` for theme objects, `UPPER_SNAKE_CASE` for module-level numeric/string constants (`FILL`, `SERVICE_COLORS`)
- **Types/Interfaces**: `PascalCase` — `ParsedSpan`, `TraceSummary`, `OtlpAttribute`
- **Context providers**: Named exports `{ use: useX, provider: XProvider }` from `createSimpleContext()`

### Component Patterns

- Components are plain functions, not arrow functions: `export function TraceList() { ... }`
- Theme objects are `const` at module scope, not inside components
- Use `createMemo` for derived/computed values, `createSignal` for local state
- Keyboard handling via `useKeyboard()` from `@opentui/solid`
- Use SolidJS control flow: `<For>`, `<Show>`, `<Switch>`/`<Match>` — not `.map()` for reactive lists
  (exception: `.map()` is OK for static/non-reactive arrays like keyboard hints)
- JSX uses `<box>` and `<text>` primitives from @opentui/solid, not HTML elements
- Layout via flexbox props: `flexDirection`, `flexGrow`, `width`, `height`
- Colors as hex strings in theme objects

### Context / State Management

- Use `createSimpleContext()` helper from `src/context/helper.tsx` for all new contexts
- Context shape: getter properties for reactive reads, methods for mutations
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
- For JSON parse failures in loops, silently `continue` (see `parseJsonl`)
- Validate data before processing (null checks, array checks)
- Use `??` for defaults, `?.` for optional chaining
- Non-null assertions (`!`) are acceptable when the value is guaranteed by prior logic

### Things to Avoid

- Do not add a bundler — Bun runs TypeScript directly
- Do not use HTML elements — this is a TUI app, use `<box>` and `<text>`
- Do not add `prettier` or `eslint` config — match the existing style manually
- Do not use `React` APIs — this is SolidJS (no `useState`, `useEffect`, etc.)
- Do not use `require()` — this is an ESM project (`"type": "module"`)
