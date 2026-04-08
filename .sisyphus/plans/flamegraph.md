# Flamegraph Support for Tawny

## TL;DR

> **Quick Summary**: Add a two-mode flamegraph visualization (icicle + aggregated) accessible from the trace-detail waterfall view, in both TUI and web report (`--web`) modes. Colored by service name, with keyboard-driven zoom/navigation.
> 
> **Deliverables**:
> - New TUI component: `src/component/trace-flamegraph.tsx` with icicle and aggregated modes
> - Route wiring: new route variant, keybinding in trace-detail, back navigation
> - Web report flamegraph: tab/toggle alongside existing waterfall in HTML output
> - Zoom interaction: Enter to focus on subtree, Esc to zoom out / go back
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES — 3 waves
> **Critical Path**: Task 1 (types/route) → Task 2 (TUI icicle) → Task 4 (aggregated mode) → Task 5 (zoom) → Final Verification

---

## Context

### Original Request
Add flamegraph support to Tawny — both an icicle graph (time-based, spans positioned by actual start/end time) and a traditional aggregated flamegraph (spans grouped by name, width = total duration), with a toggle between the two modes.

### Interview Summary
**Key Discussions**:
- **Two modes**: Icicle (time-based, x=time, y=depth) and aggregated (stacks merged by serviceName+name, width=total duration). User wants both with a toggle.
- **Entry point**: Press `f` from trace-detail (waterfall) view to switch to flamegraph.
- **Color scheme**: By service name, consistent with existing waterfall. Errors in red.
- **Web mode**: Include flamegraph in HTML report alongside existing waterfall.
- **No test infrastructure**: Verification via agent-executed QA scenarios only.

**Research Findings**:
- Route system: discriminated union in `types.ts`, `Switch/Match` in `app.tsx` — add new variant
- `trace-detail.tsx` is the reference: flattenTree, block-character rendering (█/─), virtual scrolling via cursor+scrollOffset, useKeyboard for vim-style nav
- `ParsedSpan` has all needed fields: `startTimeNano`, `endTimeNano`, `durationMs`, `children[]`, `serviceName`, `status`
- `web.ts` (726 lines) uses HTML divs with percentage-based positioning — no SVG/Canvas
- `format.ts`: `serviceColorMap`, `formatDuration`, `formatTimeRuler`, `durationBar` all reusable
- TUI flamegraph precedent: `flamegraph-textual` (Python) — one depth per terminal row, proportional widths, zoom in/out

### Metis Review
**Identified Gaps** (addressed):
- **Rendering model**: True 2D layout (one row per depth level, multiple blocks per row) — not a list. Confirmed as intended icicle design.
- **Aggregation semantics**: Aggregate by `serviceName + name`, preserving stack path. Width = total duration of all matching spans.
- **Keyboard conflict**: `f` enters flamegraph from trace-detail (bare `f` is currently unbound). Inside flamegraph, `m` toggles mode. No conflict with `Ctrl+f` (page-down).
- **Navigation back**: `back()` in route.tsx needs new branch: `trace-flamegraph` → `trace-detail`. No span-detail navigation from flamegraph in v1.
- **Zero-duration spans**: Clamp to minimum 1 char (TUI) / 0.3% (web).
- **web.ts line budget**: Keep additions under ~200 lines. Self-contained `renderFlamegraph()` function. No structural refactors.
- **Multi-root traces**: Render each root as a separate icicle section.
- **Overlapping siblings**: Render in natural position — overlaps are valid in OTel (concurrent operations).

---

## Work Objectives

### Core Objective
Add a flamegraph visualization that lets users see trace timing (icicle mode) or aggregated time distribution (aggregated mode) from both the terminal UI and the web HTML report.

### Concrete Deliverables
- `src/component/trace-flamegraph.tsx` — new TUI component with both visualization modes
- Modified `src/types.ts` — new route variant `trace-flamegraph`
- Modified `src/context/route.tsx` — back navigation for flamegraph
- Modified `src/app.tsx` — new Match for flamegraph route
- Modified `src/component/trace-detail.tsx` — `f` keybinding to enter flamegraph
- Modified `src/component/status-bar.tsx` — flamegraph-specific keyboard hints (if applicable)
- Modified `src/web.ts` — flamegraph tab/renderer in HTML report

### Definition of Done
- [ ] Press `f` in trace-detail → flamegraph view renders with colored blocks by depth
- [ ] Press `m` in flamegraph → toggles between icicle and aggregated modes
- [ ] Press `Enter` on a span → zooms into that subtree (full width)
- [ ] Press `Esc` → zooms out one level, or returns to trace-detail if at root
- [ ] `bunx tsc --noEmit` passes with zero errors
- [ ] `bun run src/index.tsx --web <file> > report.html` produces HTML with flamegraph tab

### Must Have
- Icicle mode: spans positioned by actual time, width = duration, depth = nesting level
- Aggregated mode: spans grouped by `serviceName + name`, width = total duration, sorted alphabetically
- Service-based coloring (consistent with waterfall), ERROR spans in red
- Keyboard navigation: `j/k` cursor between spans, `h/l` or arrow keys, `Enter` zoom in, `Esc` zoom out/back
- Time ruler header showing time range
- Virtual scrolling for deep traces (10+ depth levels)
- Web report: flamegraph as a toggle/tab alongside waterfall
- Zero-duration spans render as minimum-width blocks (not invisible)
- Multiple root spans handled (render all roots)

### Must NOT Have (Guardrails)
- No search/filter in flamegraph view (use existing filter before entering)
- No span-detail navigation from flamegraph (v1 — read-only visualization)
- No service filter modal in flamegraph view
- No new context providers — use `useRoute` and `useTraces` only
- No new external dependencies
- No SVG/Canvas in web report — use HTML divs consistent with waterfall
- No minimap, overview panel, or secondary navigation chrome
- No color legends or axis labels beyond the time ruler
- No configuration options (color schemes, flame height, etc.)
- No tooltips/animations in web report — static HTML
- No refactoring of `web.ts` structure or existing waterfall code
- No navigation stack refactor for route.tsx — use existing hard-coded `back()` pattern
- Do not use `.map()` for reactive lists in SolidJS — use `<For>` instead

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO
- **Automated tests**: None
- **Framework**: N/A (no test runner configured per AGENTS.md)

### QA Policy
Every task includes agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **TUI**: Use `interactive_bash` (tmux) — run `bun run src/index.tsx <trace-file>`, send keystrokes, validate output
- **Web**: Use Playwright — open generated HTML report, click elements, assert DOM, screenshot
- **Types**: Use Bash — `bunx tsc --noEmit`, assert zero errors

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — start immediately):
├── Task 1: Route wiring (types.ts, route.tsx, app.tsx, trace-detail.tsx keybinding) [quick]
├── Task 2: TUI flamegraph component — icicle mode [deep]
└── Task 3: Web flamegraph renderer — icicle mode [unspecified-high]

Wave 2 (After Wave 1 — enhancements):
├── Task 4: Aggregated mode + toggle (TUI + web) [unspecified-high]
├── Task 5: Zoom interaction (TUI + web) [unspecified-high]
└── Task 6: Edge case hardening + status bar hints [quick]

Wave 3 (After Wave 2 — verification):
├── Task 7: Type check + integration QA [quick]

Wave FINAL (After ALL tasks — 4 parallel reviews, then user okay):
├── F1: Plan compliance audit (oracle)
├── F2: Code quality review (unspecified-high)
├── F3: Real manual QA (unspecified-high)
└── F4: Scope fidelity check (deep)
→ Present results → Get explicit user okay
```

> Note: Task 1 is a prerequisite for Tasks 2 and 3. Tasks 2 and 3 can run in parallel.
> Tasks 4, 5, 6 depend on Tasks 2 and 3 completing. Task 7 depends on all prior tasks.
> Critical Path: Task 1 → Task 2 → Task 4 → Task 5 → Task 7 → F1-F4 → user okay

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| 1 | — | 2, 3 |
| 2 | 1 | 4, 5, 6, 7 |
| 3 | 1 | 4, 5, 6, 7 |
| 4 | 2, 3 | 7 |
| 5 | 2, 3 | 7 |
| 6 | 2, 3 | 7 |
| 7 | 4, 5, 6 | F1-F4 |
| F1-F4 | 7 | — |

### Agent Dispatch Summary

- **Wave 1**: 3 tasks — T1 → `quick`, T2 → `deep`, T3 → `unspecified-high`
- **Wave 2**: 3 tasks — T4 → `unspecified-high`, T5 → `unspecified-high`, T6 → `quick`
- **Wave 3**: 1 task — T7 → `quick`
- **FINAL**: 4 tasks — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [x] 1. Route Wiring + Entry Keybinding

  **What to do**:
  - Add route variant `{ type: "trace-flamegraph"; traceId: string }` to the `Route` union type in `src/types.ts`
  - Update `back()` in `src/context/route.tsx` to handle `"trace-flamegraph"` → navigate to `{ type: "trace-detail", traceId: store.traceId }`
  - Add `<Match when={route.data.type === "trace-flamegraph"}>` in `src/app.tsx` rendering a placeholder `<TraceFlamegraph />` (import from `./component/trace-flamegraph`)
  - Add `f` keybinding in `src/component/trace-detail.tsx`'s `useKeyboard` handler: `route.navigate({ type: "trace-flamegraph", traceId: route.data.traceId })`
  - The placeholder component should be a minimal export: `export function TraceFlamegraph() { return <box><text>Flamegraph placeholder</text></box> }` — enough to verify routing works

  **Must NOT do**:
  - Do not refactor the `back()` function into a navigation stack — add another `case` to the existing pattern
  - Do not add flamegraph logic to this task — it's just wiring

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small, precise edits across 4 files. All changes are mechanical additions following existing patterns.
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `git-master`: Not needed — simple edits, no complex git operations

  **Parallelization**:
  - **Can Run In Parallel**: NO (must complete first — all other tasks depend on this)
  - **Parallel Group**: Wave 1 (starts first, blocks Tasks 2, 3)
  - **Blocks**: Tasks 2, 3, 4, 5, 6, 7
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References** (existing code to follow):
  - `src/types.ts:133-136` — Route union type. Add the new variant following the exact same pattern as existing variants (`trace-detail` has `traceId: string`, follow that).
  - `src/context/route.tsx:17-23` — `back()` function with hard-coded state machine. Add `"trace-flamegraph"` case that returns to `trace-detail` with the same `traceId`.
  - `src/app.tsx:38-48` — `<Switch>/<Match>` block for view rendering. Add a new `<Match>` following the exact same import and rendering pattern.
  - `src/component/trace-detail.tsx:130-246` — keyboard handler via `useKeyboard`. The `f` key is currently unbound. Add the keybinding in the same section where `l`/`Enter` navigates to span-detail (around line 233-236).

  **API/Type References**:
  - `src/context/route.tsx:8-10` — `useRoute()` returns `{ data, navigate, back }`. Use `route.navigate()` for the keybinding.

  **WHY Each Reference Matters**:
  - `types.ts` Route union: The new variant must match the discriminated union pattern exactly or TypeScript will error on Switch/Match exhaustiveness.
  - `route.tsx back()`: Without this, pressing Esc in flamegraph would go to trace-list instead of back to trace-detail.
  - `app.tsx Switch/Match`: Without the Match, navigating to flamegraph route would render nothing.
  - `trace-detail.tsx keyboard`: This is where the user enters the flamegraph — `f` is the entry point.

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Route wiring compiles
    Tool: Bash
    Preconditions: All 4 files edited
    Steps:
      1. Run `bunx tsc --noEmit`
      2. Assert exit code 0
    Expected Result: Zero type errors
    Failure Indicators: Any error mentioning Route, trace-flamegraph, or TraceFlamegraph
    Evidence: .sisyphus/evidence/task-1-typecheck.txt

  Scenario: 'f' key navigates to flamegraph view
    Tool: interactive_bash (tmux)
    Preconditions: A test JSONL trace file exists with at least one trace
    Steps:
      1. Start app: `bun run src/index.tsx <trace-file>`
      2. Press Enter to select first trace (enters trace-detail)
      3. Press `f`
      4. Assert screen contains "Flamegraph" or the placeholder text
    Expected Result: View switches to flamegraph placeholder component
    Failure Indicators: Screen still shows waterfall, or app crashes
    Evidence: .sisyphus/evidence/task-1-f-key-nav.txt

  Scenario: Esc from flamegraph returns to trace-detail
    Tool: interactive_bash (tmux)
    Preconditions: Already in flamegraph view (from previous scenario)
    Steps:
      1. Press Escape
      2. Assert screen shows waterfall view (trace-detail)
    Expected Result: Returns to trace-detail, not trace-list
    Failure Indicators: Goes to trace-list, or app crashes
    Evidence: .sisyphus/evidence/task-1-esc-back.txt

  Scenario: Ctrl+f still works for page-down in trace-detail
    Tool: interactive_bash (tmux)
    Preconditions: In trace-detail view with enough spans to scroll
    Steps:
      1. Press Ctrl+f
      2. Assert cursor moves down by page (not navigating to flamegraph)
    Expected Result: Page scrolls down, bare 'f' is separate from Ctrl+f
    Failure Indicators: Navigates to flamegraph instead of scrolling
    Evidence: .sisyphus/evidence/task-1-ctrlf-no-conflict.txt
  ```

  **Commit**: YES
  - Message: `feat(route): add flamegraph route variant and keybinding`
  - Files: `src/types.ts`, `src/context/route.tsx`, `src/app.tsx`, `src/component/trace-detail.tsx`, `src/component/trace-flamegraph.tsx`
  - Pre-commit: `bunx tsc --noEmit`

- [x] 2. TUI Flamegraph Component — Icicle Mode

  **What to do**:
  - Replace the placeholder in `src/component/trace-flamegraph.tsx` with a full icicle flamegraph component
  - **Data preparation**: Build a layout model from `TraceSummary.tree`:
    - Walk the span tree depth-first, computing each span's `depth`, `startOffset` (fraction of trace duration), `widthFraction` (span duration / trace duration)
    - Produce an array of `LayoutRow` objects — one per depth level — each containing an array of span blocks with their character positions
    - Clamp minimum width to 1 character for zero-duration spans
    - Handle multiple root spans: render each root and its subtree
  - **Rendering**: One terminal row per depth level:
    - Each row is a full-width line of `<text>` elements
    - Each span block rendered as repeated `█` characters at its calculated position, with `─` fill between blocks
    - Color: `serviceColorMap(trace.services)` for service colors, ERROR spans in red (follow `trace-detail.tsx:257-260` barColor pattern)
    - Selected span highlighted (inverse/bold or distinct background)
  - **Time ruler**: At the top, render a time ruler showing the trace time range using `formatTimeRuler` from `format.ts`
  - **Virtual scrolling**: Track `cursor` (selected span index), `scrollOffset` (first visible depth row), `visibleHeight` (terminal rows minus chrome). Only render depth rows within the visible window.
  - **Keyboard navigation**:
    - `j/k` or `↓/↑`: Move cursor to next/previous span (in reading order: left-to-right within a row, then next row)
    - `h/l` or `←/→`: Move cursor left/right within the same depth level
    - `g/G`: Jump to first/last span
    - `Escape`: Go back to trace-detail (`route.back()`)
    - `q`: Exit app (`process.exit(0)`)
  - **Info line**: At the bottom, show selected span's name, service, duration, and start time

  **Must NOT do**:
  - Do not add aggregated mode (Task 4)
  - Do not add zoom (Task 5)
  - Do not add search/filter functionality
  - Do not navigate to span-detail from flamegraph
  - Do not create new context providers
  - Do not add new dependencies
  - Do not use `.map()` for reactive lists — use `<For>`

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Core component with 2D layout algorithm, virtual scrolling, keyboard navigation — requires careful implementation matching existing patterns.
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `playwright`: Not needed — this is TUI, not browser

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 3, after Task 1)
  - **Parallel Group**: Wave 1 (with Task 3)
  - **Blocks**: Tasks 4, 5, 6, 7
  - **Blocked By**: Task 1

  **References**:

  **Pattern References** (existing code to follow):
  - `src/component/trace-detail.tsx:55-90` — `flattenTree()` function that walks the span tree and produces a flat list. The flamegraph needs a similar traversal but organized by depth level instead of flat list. Study the recursion and `depth` tracking.
  - `src/component/trace-detail.tsx:74-78` — Virtual scrolling signals: `cursor`, `scrollOffset`, `visibleHeight`. Copy this exact pattern.
  - `src/component/trace-detail.tsx:130-246` — Keyboard handler structure. Follow the same `useKeyboard((key) => { ... })` pattern with identical key conventions (j/k, g/G, Ctrl+d/u, etc.).
  - `src/component/trace-detail.tsx:330-355` — Bar rendering: `offsetFrac`, `durationFrac`, `startCol`, `barLen` calculation. This is the core positioning math to reuse for flamegraph blocks.
  - `src/component/trace-detail.tsx:257-260` — `barColor` logic: ERROR → red, else → service color from `svcColors` map.
  - `src/component/trace-detail.tsx:115-120` — How to build `svcColors` from `serviceColorMap(trace.services)`.
  - `src/component/trace-detail.tsx:264-290` — How the header/ruler row is rendered.

  **API/Type References**:
  - `src/types.ts:80-120` — `ParsedSpan` type: `startTimeNano` (bigint), `endTimeNano` (bigint), `durationMs` (number), `durationNano` (bigint), `children` (ParsedSpan[]), `serviceName`, `name`, `status`, `spanId`.
  - `src/types.ts:125-132` — `TraceSummary` type: `tree` (root ParsedSpan[]), `startTimeNano`, `durationMs`, `services`, `spans` (flat list).
  - `src/context/traces.tsx` — `useTraces()`: `traces.byId(traceId)` returns `TraceSummary | undefined`.
  - `src/context/route.tsx` — `useRoute()`: `route.data.traceId` for current trace.

  **Utility References**:
  - `src/util/format.ts` — `serviceColorMap(services)`: returns `Map<string, string>`. `formatDuration(ms)`: formats ms to human-readable. `formatTimeRuler(durationMs, width)`: returns time ruler labels. `formatTimeShort(nano)`: compact timestamp.

  **WHY Each Reference Matters**:
  - `flattenTree()` shows how to recursively walk the span tree with depth tracking — the flamegraph needs the same traversal but grouped by depth level.
  - Virtual scrolling signals are the proven pattern for TUI performance — directly copy the signal setup and clamping logic.
  - Keyboard handler structure ensures UX consistency — same vim keys as other views.
  - Bar positioning math (`offsetFrac/durationFrac/startCol/barLen`) is literally the same calculation the flamegraph needs for each span block.
  - `barColor` logic ensures consistent color treatment of ERROR spans.
  - `TraceSummary.tree` is the entry point for the span tree — multiple roots possible (array).

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Icicle flamegraph renders with colored blocks
    Tool: interactive_bash (tmux)
    Preconditions: Task 1 complete. Test trace file with multi-service, multi-depth spans.
    Steps:
      1. Start app: `bun run src/index.tsx <trace-file>`
      2. Press Enter to select a trace with 3+ services
      3. Press `f` to enter flamegraph
      4. Capture screen output
      5. Assert: screen contains block characters (█)
      6. Assert: different colored blocks visible (service colors)
      7. Assert: time ruler visible at top
      8. Assert: info line visible at bottom with span name/duration
    Expected Result: Multi-colored icicle chart with blocks at different depth levels
    Failure Indicators: Blank screen, single color, no blocks, crash
    Evidence: .sisyphus/evidence/task-2-icicle-render.txt

  Scenario: Keyboard navigation moves between spans
    Tool: interactive_bash (tmux)
    Preconditions: In flamegraph view
    Steps:
      1. Press `j` — cursor moves to next span
      2. Verify info line updates to show new span's name/duration
      3. Press `k` — cursor moves back to previous span
      4. Press `l` — cursor moves right within same depth
      5. Press `h` — cursor moves left within same depth
      6. Press `G` — cursor jumps to last span
      7. Press `g` — cursor jumps to first span
    Expected Result: Each keypress updates the selected span and info line
    Failure Indicators: Cursor doesn't move, info line doesn't update, app crashes
    Evidence: .sisyphus/evidence/task-2-keyboard-nav.txt

  Scenario: Error spans render in red
    Tool: interactive_bash (tmux)
    Preconditions: Trace file containing at least one span with ERROR status
    Steps:
      1. Navigate to flamegraph for a trace with error spans
      2. Capture screen with ANSI colors
      3. Assert: at least one block rendered with red/error color
    Expected Result: ERROR span blocks visually distinct (red) from normal service-colored blocks
    Failure Indicators: All blocks same color family, error spans not distinguishable
    Evidence: .sisyphus/evidence/task-2-error-spans.txt

  Scenario: Deep trace scrolls vertically
    Tool: interactive_bash (tmux)
    Preconditions: Trace file with 10+ depth levels (more than terminal height)
    Steps:
      1. Open flamegraph for the deep trace
      2. Press `j` repeatedly to navigate deeper
      3. Assert: view scrolls to show deeper depth levels
      4. Press `k` to go back up
      5. Assert: view scrolls back
    Expected Result: Vertical scrolling works, all depth levels reachable
    Failure Indicators: Can't reach deep spans, view doesn't scroll, crash
    Evidence: .sisyphus/evidence/task-2-deep-scroll.txt
  ```

  **Commit**: YES
  - Message: `feat(flamegraph): add TUI icicle flamegraph component`
  - Files: `src/component/trace-flamegraph.tsx`
  - Pre-commit: `bunx tsc --noEmit`

- [x] 3. Web Flamegraph Renderer — Icicle Mode

  **What to do**:
  - Add a flamegraph tab/toggle to the web report's trace detail view in `src/web.ts`
  - **Tab UI**: Add a "Waterfall | Flamegraph" toggle pair in the trace detail header. Default to waterfall (existing behavior). Clicking "Flamegraph" shows the flamegraph, clicking "Waterfall" shows the existing waterfall. Use simple CSS class toggling (`.active` class to show/hide).
  - **Flamegraph renderer**: Add a `renderFlamegraph(trace, svcColors)` function that:
    - Walks the span tree (from `convertTrace()` output — `WebSpan` has `startTimeMs`, `endTimeMs`, `durationMs`, `children[]`)
    - Creates one container row per depth level
    - Each span is a `<div>` with `position: absolute`, `left` and `width` as percentages (following the waterfall's existing pattern at lines ~556-569)
    - Background color from `svcColors` map (service name → color), ERROR spans in red
    - Each bar shows truncated span name as text content
    - Minimum width: `0.3%` for zero-duration spans
  - **CSS**: Add minimal flamegraph styles (`.fg-container`, `.fg-row`, `.fg-bar`) following existing CSS naming conventions in `web.ts`
  - **Interactivity**: Click a bar to show span info in the existing detail panel (if present), or at minimum show span name + duration in a tooltip-like display
  - Keep total additions under ~200 lines

  **Must NOT do**:
  - Do not use SVG or Canvas — HTML divs with CSS only (consistent with waterfall)
  - Do not add animations or transitions
  - Do not refactor existing waterfall code or web.ts structure
  - Do not add aggregated mode (Task 4)
  - Do not add zoom (Task 5)
  - Do not add new dependencies

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Significant addition to a large file (web.ts, 726 lines). Requires understanding the existing template literal structure, CSS conventions, and vanilla JS patterns. Not visual-engineering because it's inline HTML/CSS/JS in a template, not a component framework.
  - **Skills**: [`playwright`]
    - `playwright`: Needed for QA — opening the generated HTML file and asserting DOM structure.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Not applicable — this is embedded vanilla JS/CSS in a template literal, not a component framework.

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 2, after Task 1)
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Tasks 4, 5, 6, 7
  - **Blocked By**: Task 1

  **References**:

  **Pattern References** (existing code to follow):
  - `src/web.ts:1-50` — `convertSpan()` / `convertTrace()` functions that convert `ParsedSpan` → `WebSpan` (serializable). The flamegraph renderer will consume this same data structure.
  - `src/web.ts:515-600` — `renderTraceDetail()` or equivalent function that builds the waterfall HTML. Study where to insert the tab toggle and where the flamegraph container should go.
  - `src/web.ts:556-569` — Waterfall bar positioning: percentage-based `left` and `width` styles on `<div>` elements. Follow this exact approach for flamegraph bars.
  - `src/web.ts:50-200` — CSS block. Study existing class naming conventions and style patterns to maintain consistency.

  **API/Type References**:
  - `WebSpan` type (defined inline in web.ts) — has `startTimeMs`, `endTimeMs`, `durationMs`, `children[]`, `serviceName`, `name`, `status`.
  - `WebTrace` type — has `durationMs`, `startTimeMs`, `services[]`.

  **WHY Each Reference Matters**:
  - `convertSpan/convertTrace` provides the data shape — no need to re-process from `ParsedSpan`.
  - Waterfall rendering shows the exact HTML/CSS pattern to follow — percentage positioning with absolute layout.
  - CSS block shows naming conventions to maintain visual consistency.
  - The flamegraph is literally the same positioning algorithm as the waterfall, just organized by depth rows instead of a flat span list.

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: HTML report includes flamegraph tab
    Tool: Bash + Playwright
    Preconditions: Test trace file exists
    Steps:
      1. Run `bun run src/index.tsx --web <trace-file> > /tmp/flamegraph-test.html`
      2. Assert: file generated, non-empty
      3. Open in Playwright: navigate to `file:///tmp/flamegraph-test.html`
      4. Click a trace row to open trace detail
      5. Assert: element with text "Flamegraph" exists (tab toggle)
      6. Assert: element with text "Waterfall" exists (tab toggle)
    Expected Result: Both tabs visible in trace detail view
    Failure Indicators: No tab elements, page errors, empty HTML
    Evidence: .sisyphus/evidence/task-3-web-tabs.png

  Scenario: Clicking Flamegraph tab shows icicle chart
    Tool: Playwright
    Preconditions: In trace detail view (from previous scenario)
    Steps:
      1. Click the "Flamegraph" tab/toggle
      2. Assert: `.fg-container` element is visible
      3. Assert: at least one `.fg-bar` element exists
      4. Assert: `.fg-bar` elements have `background-color` style set (not empty/default)
      5. Assert: `.fg-bar` elements have `left` and `width` percentage styles
      6. Take screenshot
    Expected Result: Colored flamegraph bars visible, positioned correctly
    Failure Indicators: No bars, all bars same color, bars not positioned
    Evidence: .sisyphus/evidence/task-3-web-flamegraph.png

  Scenario: Error spans have red color in web flamegraph
    Tool: Playwright
    Preconditions: Trace file with ERROR spans, flamegraph tab active
    Steps:
      1. Query all `.fg-bar` elements
      2. Find bars whose corresponding span has ERROR status
      3. Assert: their background-color is red/error color (distinct from service colors)
    Expected Result: ERROR span bars are visually red
    Failure Indicators: ERROR bars have service color instead of red
    Evidence: .sisyphus/evidence/task-3-web-error-spans.png

  Scenario: Waterfall tab still works
    Tool: Playwright
    Preconditions: Flamegraph tab currently active
    Steps:
      1. Click the "Waterfall" tab/toggle
      2. Assert: waterfall view is visible (`.waterfall` or equivalent container)
      3. Assert: flamegraph container is hidden
    Expected Result: Switching back to waterfall works, nothing broken
    Failure Indicators: Waterfall broken, both views visible simultaneously
    Evidence: .sisyphus/evidence/task-3-web-waterfall-toggle.png
  ```

  **Commit**: YES
  - Message: `feat(web): add flamegraph renderer to HTML report`
  - Files: `src/web.ts`
  - Pre-commit: `bunx tsc --noEmit`

- [x] 4. Aggregated Mode + Toggle (TUI + Web)

  **What to do**:
  - Add a second visualization mode to the flamegraph: **aggregated flamegraph**
  - **Data aggregation algorithm**:
    - Walk the span tree and build aggregated stacks: each unique path from root to leaf (by `serviceName + ":" + name` at each depth) forms a stack
    - At each depth level, group spans by their full stack path (from root to current depth)
    - Width = sum of `durationMs` for all spans matching that stack path at that depth
    - Sort siblings alphabetically by `serviceName + ":" + name`
    - This preserves the call hierarchy — "HTTP GET" under service A is separate from "HTTP GET" under service B
  - **TUI toggle**: Press `m` in flamegraph view to switch between icicle and aggregated modes
    - Add a `mode` signal: `createSignal<"icicle" | "aggregated">("icicle")`
    - When mode changes, recompute the layout from the span tree
    - Show current mode in the info line (e.g., "Mode: Icicle" or "Mode: Aggregated")
    - Reset cursor to first span on mode switch
  - **Web toggle**: Add an "Icicle | Aggregated" sub-toggle within the flamegraph tab
    - Clicking switches between the two rendering approaches
    - Use CSS class toggling to show/hide the appropriate container
  - **Rendering differences**:
    - Icicle: x-axis = time, bars positioned by start time
    - Aggregated: x-axis = proportional duration, bars positioned by alphabetical order, width = total aggregated duration

  **Must NOT do**:
  - Do not add zoom (Task 5)
  - Do not add filtering or search
  - Do not modify the icicle mode implementation from Task 2/3 — add the aggregated mode alongside it

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Requires implementing a stack aggregation algorithm and wiring mode toggle state in both TUI (SolidJS signals) and web (vanilla JS). Moderate complexity, touches two files.
  - **Skills**: [`playwright`]
    - `playwright`: QA for web mode verification.

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 5 and 6)
  - **Parallel Group**: Wave 2 (with Tasks 5, 6)
  - **Blocks**: Task 7
  - **Blocked By**: Tasks 2, 3

  **References**:

  **Pattern References**:
  - `src/component/trace-flamegraph.tsx` (from Task 2) — The icicle layout logic. The aggregated mode needs a parallel layout function that uses aggregated data instead of absolute timing.
  - `src/component/trace-detail.tsx:257-260` — barColor pattern: reuse the same ERROR → red, else → service color logic.
  - `src/web.ts` (from Task 3) — The web icicle renderer. Add a parallel aggregated renderer following the same HTML/CSS patterns.

  **External References**:
  - Brendan Gregg's flamegraph algorithm: stacks are sorted alphabetically, siblings are placed left-to-right by name, width = count (or duration in our case). This is the canonical approach.

  **WHY Each Reference Matters**:
  - The icicle layout from Task 2 shows the rendering pattern — aggregated mode uses the same block rendering but with different positioning data.
  - The web renderer from Task 3 shows how to add a second rendering mode to the HTML.

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: TUI mode toggle between icicle and aggregated
    Tool: interactive_bash (tmux)
    Preconditions: In flamegraph view (icicle mode, the default)
    Steps:
      1. Capture screen (icicle mode) — note span layout
      2. Press `m`
      3. Capture screen (aggregated mode) — layout should differ
      4. Assert: info line shows "Aggregated" mode indicator
      5. Press `m` again
      6. Assert: back to icicle mode, info line shows "Icicle"
    Expected Result: Two distinct visualizations toggled by `m`
    Failure Indicators: Layout doesn't change, mode indicator missing
    Evidence: .sisyphus/evidence/task-4-tui-toggle.txt

  Scenario: Aggregated mode groups spans by name
    Tool: interactive_bash (tmux)
    Preconditions: Trace with multiple spans of the same name (e.g., repeated "HTTP GET" calls)
    Steps:
      1. Enter flamegraph, switch to aggregated mode (`m`)
      2. Navigate through spans
      3. Assert: spans with same serviceName+name are merged (single wider bar vs multiple small bars in icicle mode)
    Expected Result: Aggregated bars are wider than individual icicle bars for repeated operations
    Failure Indicators: Same layout as icicle mode, no aggregation visible
    Evidence: .sisyphus/evidence/task-4-aggregation.txt

  Scenario: Web flamegraph has icicle/aggregated sub-toggle
    Tool: Playwright
    Preconditions: HTML report generated, flamegraph tab active
    Steps:
      1. Assert: "Icicle" and "Aggregated" sub-toggle elements exist
      2. Click "Aggregated"
      3. Assert: flamegraph re-renders with different layout
      4. Click "Icicle"
      5. Assert: original icicle layout restored
    Expected Result: Web sub-toggle switches between modes
    Failure Indicators: No sub-toggle, same layout for both modes
    Evidence: .sisyphus/evidence/task-4-web-toggle.png
  ```

  **Commit**: YES
  - Message: `feat(flamegraph): add aggregated mode with toggle`
  - Files: `src/component/trace-flamegraph.tsx`, `src/web.ts`
  - Pre-commit: `bunx tsc --noEmit`

- [x] 5. Zoom Interaction (TUI + Web)

  **What to do**:
  - Add zoom in/out functionality to the flamegraph in both TUI and web modes
  - **TUI zoom**:
    - Add a `zoomSpanId` signal: `createSignal<string | null>(null)` (null = full trace, non-null = zoomed into subtree)
    - Press `Enter` on a selected span → set `zoomSpanId` to that span's ID
    - When zoomed: the zoomed span's subtree becomes the full width of the view. Recalculate all positioning fractions relative to the zoomed span's start/end time (icicle) or total duration (aggregated). Only render spans within the zoomed subtree.
    - Update the time ruler to show the zoomed span's time range
    - Press `Esc`: if zoomed, zoom out one level (set `zoomSpanId` to zoomed span's parent, or null if zoomed span is a root). If not zoomed, `route.back()` to trace-detail.
    - Show zoom breadcrumb in the info line: e.g., "Zoomed: root > serviceA:HTTP GET > serviceB:DB query"
  - **Web zoom**:
    - Click a bar to zoom into its subtree (same rescaling logic)
    - Add a breadcrumb trail at the top of the flamegraph showing the zoom path
    - Click any breadcrumb item to zoom to that level
    - Click the trace-level breadcrumb (first item) to zoom out completely
  - **Works in both modes**: Zoom applies to whichever mode (icicle/aggregated) is active

  **Must NOT do**:
  - Do not add smooth animations for zoom transitions
  - Do not add minimap showing full trace while zoomed
  - Do not add mouse-based pan/drag in web mode

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Zoom requires re-anchoring the layout algorithm, managing zoom state stack, and implementing breadcrumbs — moderate complexity across TUI and web.
  - **Skills**: [`playwright`]
    - `playwright`: QA for web zoom verification.

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 4 and 6)
  - **Parallel Group**: Wave 2 (with Tasks 4, 6)
  - **Blocks**: Task 7
  - **Blocked By**: Tasks 2, 3

  **References**:

  **Pattern References**:
  - `src/component/trace-flamegraph.tsx` (from Task 2) — Layout computation functions. Zoom modifies the reference frame: instead of using `trace.startTimeNano` and `trace.durationMs`, use the zoomed span's values.
  - `src/component/trace-detail.tsx:233-236` — Navigation pattern: `route.navigate()` for entry, `route.back()` for exit. Zoom adds a layer: Esc zooms out first, then exits.

  **External References**:
  - `flamegraph-textual` reference: uses `Enter` to zoom in, `Esc` to zoom out — proven TUI pattern.

  **WHY Each Reference Matters**:
  - The layout computation from Task 2 is the foundation — zoom just changes the "root" reference for all offset/width calculations.
  - The Enter/Esc pattern from trace-detail shows the navigation convention users already know.

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: TUI zoom in on a span subtree
    Tool: interactive_bash (tmux)
    Preconditions: In flamegraph view, cursor on a span with children
    Steps:
      1. Note current span's name and the overall time ruler range
      2. Press Enter
      3. Assert: view rescales to show only the selected span's subtree
      4. Assert: time ruler updates to zoomed span's time range
      5. Assert: info line shows zoom breadcrumb
    Expected Result: Zoomed view showing subtree at full width
    Failure Indicators: View doesn't change, ruler unchanged, no breadcrumb
    Evidence: .sisyphus/evidence/task-5-tui-zoom-in.txt

  Scenario: TUI zoom out and exit
    Tool: interactive_bash (tmux)
    Preconditions: Zoomed into a span (from previous scenario)
    Steps:
      1. Press Esc — zoom out one level (to parent or full trace)
      2. Assert: view expands to show more of the trace
      3. If still zoomed, press Esc again until at root level
      4. Press Esc at root level
      5. Assert: returns to trace-detail (waterfall) view
    Expected Result: Esc progressively zooms out, then exits flamegraph
    Failure Indicators: Esc immediately exits (skips zoom-out), or never exits
    Evidence: .sisyphus/evidence/task-5-tui-zoom-out.txt

  Scenario: Web zoom via click and breadcrumbs
    Tool: Playwright
    Preconditions: HTML report open, flamegraph tab active
    Steps:
      1. Click a `.fg-bar` element
      2. Assert: flamegraph re-renders showing only that bar's subtree
      3. Assert: breadcrumb trail appears at top
      4. Assert: breadcrumb contains at least 2 items (root + current)
      5. Click the first breadcrumb item
      6. Assert: zooms out to full trace
    Expected Result: Click-to-zoom with breadcrumb navigation works
    Failure Indicators: Nothing happens on click, no breadcrumbs, can't zoom out
    Evidence: .sisyphus/evidence/task-5-web-zoom.png
  ```

  **Commit**: YES
  - Message: `feat(flamegraph): add zoom interaction`
  - Files: `src/component/trace-flamegraph.tsx`, `src/web.ts`
  - Pre-commit: `bunx tsc --noEmit`

- [x] 6. Edge Case Hardening + Status Bar Hints

  **What to do**:
  - **Zero-duration spans**: Verify the minimum-width clamping (1 char TUI, 0.3% web) works. If a span has `durationMs === 0`, it should render as a 1-character block, not be invisible.
  - **Multiple root spans**: If `TraceSummary.tree` has multiple roots, render each root and its subtree. All roots should appear at depth 0, with their children below.
  - **Empty trace**: If a trace has zero spans, show a "No spans" message instead of a blank flamegraph.
  - **Single-span trace**: A trace with one span should render a single full-width bar at depth 0.
  - **Very wide traces with tiny spans**: When a span's duration is <1% of trace duration, it gets 1 char minimum. Many such spans at the same depth should not overlap — if positioning forces overlap, let them overlap (valid in OTel for concurrent operations).
  - **Status bar hints**: Update `src/component/status-bar.tsx` to show flamegraph-specific keyboard hints when in flamegraph view:
    - `m: mode` `Enter: zoom` `Esc: back` `j/k: nav` `h/l: left/right` `g/G: top/bottom`
    - Follow the same pattern used for trace-detail and trace-list hints.
  - **Overlapping sibling handling**: In icicle mode, concurrent sibling spans at the same depth may overlap. Render them in their natural time position — this is expected behavior. Add a subtle visual indicator (e.g., slightly different shade or thin border) if blocks overlap. In aggregated mode, no overlap is possible (sorted alphabetically, non-overlapping).

  **Must NOT do**:
  - Do not add complex overlap resolution algorithms
  - Do not add responsive resize handling beyond what `visibleHeight()` provides
  - Do not add empty state illustrations or fancy messages

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small targeted fixes and one UI addition (status bar). Each edge case is a clamp or guard condition, not architectural work.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 4 and 5)
  - **Parallel Group**: Wave 2 (with Tasks 4, 5)
  - **Blocks**: Task 7
  - **Blocked By**: Tasks 2, 3

  **References**:

  **Pattern References**:
  - `src/component/status-bar.tsx` — Existing status bar component. Study how it conditionally renders different hints based on the current route/view. Add a flamegraph-specific section.
  - `src/component/trace-flamegraph.tsx` (from Task 2) — Where to add edge case guards (clamping, empty checks).
  - `src/component/trace-detail.tsx:340-343` — `barLen` calculation with `Math.max(1, ...)` clamping for minimum width. Follow this pattern.

  **WHY Each Reference Matters**:
  - Status bar shows the conditional rendering pattern for route-specific hints.
  - The barLen clamping in trace-detail is the exact pattern to replicate for zero-duration span handling.

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Zero-duration span renders visibly
    Tool: interactive_bash (tmux)
    Preconditions: Trace file with at least one span where durationMs === 0 or durationNano === 0n
    Steps:
      1. Open flamegraph for the trace
      2. Navigate to the zero-duration span
      3. Assert: span is visible as a 1-character block (not invisible)
      4. Assert: info line shows the span's name and "0ms" or "0ns" duration
    Expected Result: Zero-duration span is visible and selectable
    Failure Indicators: Span invisible, can't select it, crashes on zero division
    Evidence: .sisyphus/evidence/task-6-zero-duration.txt

  Scenario: Multiple root spans render
    Tool: interactive_bash (tmux)
    Preconditions: Trace with 2+ root spans (no single rootSpan)
    Steps:
      1. Open flamegraph
      2. Assert: multiple blocks visible at depth 0
      3. Navigate between them
    Expected Result: All root spans rendered at depth 0, navigable
    Failure Indicators: Only first root shown, crash on undefined rootSpan
    Evidence: .sisyphus/evidence/task-6-multi-root.txt

  Scenario: Status bar shows flamegraph hints
    Tool: interactive_bash (tmux)
    Preconditions: In flamegraph view
    Steps:
      1. Look at the bottom status bar row
      2. Assert: contains "m: mode" hint
      3. Assert: contains "Enter: zoom" hint
      4. Assert: contains "Esc: back" hint
    Expected Result: Flamegraph-specific keyboard hints visible
    Failure Indicators: Shows trace-detail hints, or no hints, or blank
    Evidence: .sisyphus/evidence/task-6-status-bar.txt

  Scenario: Empty trace shows message
    Tool: interactive_bash (tmux)
    Preconditions: Trace file with a trace entry that has zero spans (edge case)
    Steps:
      1. Navigate to flamegraph for empty trace
      2. Assert: "No spans" or equivalent message shown
      3. Assert: no crash
    Expected Result: Graceful empty state message
    Failure Indicators: Blank screen, crash, infinite loop
    Evidence: .sisyphus/evidence/task-6-empty-trace.txt
  ```

  **Commit**: YES
  - Message: `fix(flamegraph): edge case hardening and status bar hints`
  - Files: `src/component/trace-flamegraph.tsx`, `src/component/status-bar.tsx`, `src/web.ts`
  - Pre-commit: `bunx tsc --noEmit`

- [x] 7. Type Check + Integration QA

  **What to do**:
  - Run `bunx tsc --noEmit` and fix any type errors across all modified files
  - Use `ast_grep_search` to find all `route.data.type` comparisons and verify the new `"trace-flamegraph"` variant is handled everywhere (not just app.tsx and route.tsx — check status-bar.tsx and any other consumers)
  - Run the full app end-to-end: trace-list → select trace → trace-detail → `f` → flamegraph (icicle) → `m` → aggregated → `m` → icicle → `Enter` → zoom → `Esc` → zoom out → `Esc` → trace-detail → `Esc` → trace-list
  - Generate web report and verify the complete flow: open report → click trace → waterfall → flamegraph tab → icicle → aggregated → zoom → breadcrumb → waterfall tab
  - Verify no regressions: trace-detail waterfall still works, span-detail still works, search/filter still works, `Ctrl+f` page-down in trace-detail still works

  **Must NOT do**:
  - Do not add new features
  - Do not refactor existing code
  - Only fix issues found during QA

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Verification pass — run commands, check output, fix minor issues. No architectural work.
  - **Skills**: [`playwright`]
    - `playwright`: Web report integration QA.

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on all prior tasks)
  - **Parallel Group**: Wave 3 (sequential — after Wave 2)
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 4, 5, 6

  **References**:

  **Pattern References**:
  - All modified files from Tasks 1-6
  - `src/component/status-bar.tsx` — verify flamegraph hints integrated
  - `src/component/trace-detail.tsx` — verify `f` key doesn't break existing behavior

  **WHY Each Reference Matters**:
  - Integration QA must touch every modified file to catch cross-task issues.

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Full type check passes
    Tool: Bash
    Steps:
      1. Run `bunx tsc --noEmit`
      2. Assert exit code 0, zero errors
    Expected Result: Clean type check
    Failure Indicators: Any TypeScript error
    Evidence: .sisyphus/evidence/task-7-typecheck.txt

  Scenario: Full TUI flow end-to-end
    Tool: interactive_bash (tmux)
    Steps:
      1. `bun run src/index.tsx <trace-file>`
      2. Enter → select trace → trace-detail
      3. `f` → flamegraph (icicle mode)
      4. `m` → aggregated mode
      5. `m` → back to icicle
      6. `j/k` → navigate spans
      7. `Enter` → zoom into span
      8. `Esc` → zoom out
      9. `Esc` → back to trace-detail
      10. Verify waterfall renders correctly
      11. `Esc` → back to trace-list
      12. `q` → exit
    Expected Result: Complete flow works without crashes or visual glitches
    Failure Indicators: Any crash, wrong view, broken navigation
    Evidence: .sisyphus/evidence/task-7-tui-e2e.txt

  Scenario: Full web flow end-to-end
    Tool: Playwright
    Steps:
      1. Generate report: `bun run src/index.tsx --web <trace-file> > /tmp/e2e-test.html`
      2. Open in browser
      3. Click trace → trace detail
      4. Assert waterfall visible
      5. Click "Flamegraph" tab
      6. Assert icicle chart visible
      7. Click "Aggregated" sub-toggle
      8. Assert aggregated chart visible
      9. Click a bar → zoom in
      10. Assert breadcrumb visible
      11. Click root breadcrumb → zoom out
      12. Click "Waterfall" tab
      13. Assert waterfall visible, no regression
    Expected Result: Complete web flow works
    Failure Indicators: Any tab/toggle broken, zoom broken, regression in waterfall
    Evidence: .sisyphus/evidence/task-7-web-e2e.png

  Scenario: No regression — Ctrl+f in trace-detail
    Tool: interactive_bash (tmux)
    Preconditions: In trace-detail with enough spans to scroll
    Steps:
      1. Press Ctrl+f
      2. Assert: page scrolls down (not entering flamegraph)
    Expected Result: Ctrl+f still works as page-down
    Evidence: .sisyphus/evidence/task-7-no-regression-ctrlf.txt

  Scenario: No regression — search in trace-detail
    Tool: interactive_bash (tmux)
    Steps:
      1. In trace-detail, press `/`
      2. Type a span name
      3. Assert: filter activates, matching spans shown
    Expected Result: Search still works normally
    Evidence: .sisyphus/evidence/task-7-no-regression-search.txt
  ```

  **Commit**: YES (only if fixes needed)
  - Message: `fix(flamegraph): integration fixes from QA`
  - Pre-commit: `bunx tsc --noEmit`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
>
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `bunx tsc --noEmit`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp). Verify SolidJS patterns: `<For>` not `.map()` for reactive lists, `createMemo` for derived values, no React patterns.
  Output: `Build [PASS/FAIL] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill for web)
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (flamegraph mode toggle + zoom + back navigation). Test edge cases: empty trace, single-span trace, 50+ depth trace, zero-duration spans. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (`git diff`). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| After Task | Commit Message | Files | Pre-commit |
|------------|---------------|-------|------------|
| 1 | `feat(route): add flamegraph route variant and keybinding` | types.ts, route.tsx, app.tsx, trace-detail.tsx | `bunx tsc --noEmit` |
| 2 | `feat(flamegraph): add TUI icicle flamegraph component` | trace-flamegraph.tsx | `bunx tsc --noEmit` |
| 3 | `feat(web): add flamegraph renderer to HTML report` | web.ts | `bunx tsc --noEmit` |
| 4 | `feat(flamegraph): add aggregated mode with toggle` | trace-flamegraph.tsx, web.ts | `bunx tsc --noEmit` |
| 5 | `feat(flamegraph): add zoom interaction` | trace-flamegraph.tsx, web.ts | `bunx tsc --noEmit` |
| 6 | `fix(flamegraph): edge case hardening and status bar hints` | trace-flamegraph.tsx, status-bar.tsx | `bunx tsc --noEmit` |

---

## Success Criteria

### Verification Commands
```bash
bunx tsc --noEmit                                    # Expected: zero errors
bun run src/index.tsx --web traces.jsonl > /tmp/report.html  # Expected: HTML with flamegraph tab
```

### Final Checklist
- [ ] All "Must Have" items present and functional
- [ ] All "Must NOT Have" items absent from codebase
- [ ] `bunx tsc --noEmit` passes
- [ ] TUI: f → flamegraph → m toggles mode → Enter zooms → Esc returns
- [ ] Web: flamegraph tab visible → shows colored blocks → mode toggle works
- [ ] Zero-duration spans render visibly
- [ ] Multi-root traces render all roots
- [ ] Deep traces (10+ levels) scroll without crash
