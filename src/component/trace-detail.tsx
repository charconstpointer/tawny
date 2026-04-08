import { createSignal, createMemo, For } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { useRoute } from "../context/route"
import { useTraces } from "../context/traces"
import { useFilter } from "../context/filter"
import {
  shortId,
  formatDuration,
  truncate,
  serviceColorMap,
  formatTimeRuler,
} from "../util/format"
import type { ParsedSpan } from "../types"

const theme = {
  selected: "#292e42",
  normal: "#1a1b26",
  header: "#3b4261",
  headerFg: "#c0caf5",
  spanName: "#c0caf5",
  duration: "#7aa2f7",
  error: "#f7768e",
  ok: "#9ece6a",
  unset: "#565f89",
  dim: "#565f89",
  tree: "#565f89",
  rulerFg: "#565f89",
  barBg: "#24283b",
  divider: "#3b4261",
  collapseIndicator: "#7aa2f7",
}

/** Max chars we'd ever repeat for fill text — well beyond any terminal width */
const FILL = 500

interface FlatSpan {
  span: ParsedSpan
  depth: number
  hasChildren: boolean
  isCollapsed: boolean
  /** Number of hidden descendants when collapsed */
  hiddenCount: number
}

function countDescendants(span: ParsedSpan): number {
  let count = 0
  for (const child of span.children) {
    count += 1 + countDescendants(child)
  }
  return count
}

function flattenTree(roots: ParsedSpan[], collapsed: Set<string>): FlatSpan[] {
  const result: FlatSpan[] = []
  function walk(spans: ParsedSpan[], depth: number) {
    for (const s of spans) {
      const hasChildren = s.children.length > 0
      const isCollapsed = collapsed.has(s.spanId)
      const hiddenCount = hasChildren && isCollapsed ? countDescendants(s) : 0
      result.push({ span: s, depth, hasChildren, isCollapsed, hiddenCount })
      if (hasChildren && !isCollapsed) {
        walk(s.children, depth + 1)
      }
    }
  }
  walk(roots, 0)
  return result
}

export function TraceDetail() {
  const route = useRoute()
  const traces = useTraces()
  const filter = useFilter()
  const [cursor, setCursor] = createSignal(0)
  const [scrollOffset, setScrollOffset] = createSignal(0)
  const [collapsed, setCollapsed] = createSignal(new Set<string>())
  // Terminal height minus chrome: app title(1) + trace title(1) + column headers(1) + footer(1) + statusbar(1) + search(1) = 6
  const visibleHeight = () => Math.max(5, (process.stdout.rows ?? 30) - 6)

  const toggleCollapse = (spanId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(spanId)) {
        next.delete(spanId)
      } else {
        next.add(spanId)
      }
      return next
    })
  }

  const trace = createMemo(() => {
    if (route.data.type !== "trace-detail") return undefined
    return traces.byId(route.data.traceId)
  })

  const flatSpans = createMemo(() => {
    const t = trace()
    if (!t) return []
    let list = flattenTree(t.tree, collapsed())
    const q = filter.searchQuery.toLowerCase()
    if (q) {
      list = list.filter(
        (f) =>
          f.span.name.toLowerCase().includes(q) ||
          f.span.serviceName.toLowerCase().includes(q) ||
          f.span.spanId.toLowerCase().includes(q)
      )
    }
    return list
  })

  const clampCursor = (c: number) => Math.max(0, Math.min(c, flatSpans().length - 1))

  // Build a color map for all services in this trace
  const svcColors = createMemo(() => {
    const t = trace()
    if (!t) return new Map<string, string>()
    return serviceColorMap(t.services)
  })

  // Ruler width — use process.stdout.columns as a best-effort hint.
  // The ruler is just labels; the actual bar fill uses percentage layout.
  const rulerWidth = createMemo(() => {
    const cols = process.stdout.columns ?? 120
    const leftCols = 56 // name(30) + service(14) + duration(10) + divider(1) + paddingLeft(1)
    return Math.max(20, cols - leftCols)
  })

  useKeyboard((key) => {
    if (route.data.type !== "trace-detail") return
    if (filter.showSearch) {
      if (key.name === "escape") {
        filter.closeSearch()
      } else if (key.name === "backspace") {
        filter.setSearchQuery(filter.searchQuery.slice(0, -1))
        setCursor(0)
        setScrollOffset(0)
      } else if (key.name === "return") {
        filter.closeSearch()
      } else if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
        filter.setSearchQuery(filter.searchQuery + key.sequence)
        setCursor(0)
        setScrollOffset(0)
      }
      return
    }

    // j/k — single step down/up
    if (key.name === "j" || key.name === "down") {
      const next = clampCursor(cursor() + 1)
      setCursor(next)
      if (next >= scrollOffset() + visibleHeight() - 1) {
        setScrollOffset(next - visibleHeight() + 2)
      }
    }
    if (key.name === "k" || key.name === "up") {
      const next = clampCursor(cursor() - 1)
      setCursor(next)
      if (next < scrollOffset()) {
        setScrollOffset(next)
      }
    }
    // g / G — go to top / bottom
    if (key.shift && key.name === "g") {
      const last = Math.max(0, flatSpans().length - 1)
      setCursor(last)
      setScrollOffset(Math.max(0, last - visibleHeight() + 2))
    } else if (key.name === "g") {
      setCursor(0)
      setScrollOffset(0)
    }
    // Ctrl+d / Ctrl+u — half page down / up
    if (key.ctrl && key.name === "d") {
      const half = Math.floor(visibleHeight() / 2)
      const maxScroll = Math.max(0, flatSpans().length - visibleHeight())
      setCursor(clampCursor(cursor() + half))
      setScrollOffset(Math.min(scrollOffset() + half, maxScroll))
    }
    if (key.ctrl && key.name === "u") {
      const half = Math.floor(visibleHeight() / 2)
      setCursor(clampCursor(cursor() - half))
      setScrollOffset(Math.max(0, scrollOffset() - half))
    }
    // Ctrl+f / Ctrl+b — full page down / up
    if (key.ctrl && key.name === "f") {
      const page = visibleHeight() - 2
      const maxScroll = Math.max(0, flatSpans().length - visibleHeight())
      const nextScroll = Math.min(scrollOffset() + page, maxScroll)
      setScrollOffset(nextScroll)
      setCursor(clampCursor(nextScroll))
    }
    if (key.ctrl && key.name === "b") {
      const page = visibleHeight() - 2
      const nextScroll = Math.max(0, scrollOffset() - page)
      setScrollOffset(nextScroll)
      setCursor(clampCursor(nextScroll + visibleHeight() - 2))
    }
    // H / M / L — cursor to top / middle / bottom of visible area
    if (key.shift && key.name === "h") {
      setCursor(clampCursor(scrollOffset()))
    }
    if (key.shift && key.name === "m") {
      setCursor(clampCursor(scrollOffset() + Math.floor(visibleHeight() / 2)))
    }
    if (key.shift && key.name === "l") {
      setCursor(clampCursor(Math.min(scrollOffset() + visibleHeight() - 2, flatSpans().length - 1)))
    }
    // l / Enter — open span detail
    if (!key.shift && !key.ctrl && key.name === "l") {
      const item = flatSpans()[cursor()]
      if (item && route.data.type === "trace-detail") {
        route.navigate({
          type: "span-detail",
          traceId: route.data.traceId,
          spanId: item.span.spanId,
        })
      }
    }
    if (key.name === "return") {
      const item = flatSpans()[cursor()]
      if (item && route.data.type === "trace-detail") {
        route.navigate({
          type: "span-detail",
          traceId: route.data.traceId,
          spanId: item.span.spanId,
        })
      }
    }
    if (key.name === "space" || key.name === "tab") {
      const item = flatSpans()[cursor()]
      if (item && item.hasChildren) {
        toggleCollapse(item.span.spanId)
      }
    }
    // h / Esc — go back
    if (key.name === "escape" || (!key.shift && !key.ctrl && key.name === "h")) {
      route.back()
    }
    if (key.name === "slash" || (key.name === "/" as string)) {
      filter.openSearch()
    }
    if (!key.shift && !key.ctrl && key.name === "f") {
      if (route.data.type === "trace-detail") {
        route.navigate({ type: "trace-flamegraph", traceId: route.data.traceId })
      }
    }
    if (key.name === "q") {
      process.exit(0)
    }
  })

  const visibleSpans = createMemo(() => {
    const f = flatSpans()
    const start = scrollOffset()
    const end = start + visibleHeight()
    return f.slice(start, end)
  })

  const traceDurationMs = createMemo(() => trace()?.durationMs ?? 1)

  const barColor = (span: ParsedSpan) => {
    if (span.status === "ERROR") return theme.error
    return svcColors().get(span.serviceName) ?? theme.duration
  }

  const treePrefix = (depth: number, hasChildren: boolean, isCollapsed: boolean) => {
    const indent = "  ".repeat(depth)
    if (hasChildren) {
      return indent + (isCollapsed ? "\u25B6 " : "\u25BC ")
    }
    if (depth > 0) {
      return indent + "\u251C\u2500"
    }
    return ""
  }

  // Column widths for the left panel
  const nameWidth = 30
  const serviceWidth = 14
  const durationWidth = 10

  return (
    <box flexDirection="column" flexGrow={1} width="100%">
      {/* Title bar */}
      <box
        width="100%"
        height={1}
        backgroundColor={theme.header}
        flexDirection="row"
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={theme.headerFg}>
          Trace {trace() ? shortId(trace()!.traceId, 16) : "?"} - {trace()?.spanCount ?? 0} spans - {formatDuration(trace()?.durationMs ?? 0)}
          {trace()?.errorCount ? ` - ${trace()!.errorCount} errors` : ""}
        </text>
      </box>

      {/* Column headers + time ruler */}
      <box
        width="100%"
        height={1}
        flexDirection="row"
        backgroundColor="#24283b"
        paddingLeft={1}
      >
        <box width={nameWidth}>
          <text fg={theme.dim}>SPAN NAME</text>
        </box>
        <box width={serviceWidth}>
          <text fg={theme.dim}>SERVICE</text>
        </box>
        <box width={durationWidth}>
          <text fg={theme.dim}>DURATION</text>
        </box>
        <box width={1}>
          <text fg={theme.divider}>{"\u2502"}</text>
        </box>
        {/* Time ruler — best-effort label placement */}
        <box flexGrow={1}>
          <text fg={theme.rulerFg}>
            {formatTimeRuler(traceDurationMs(), rulerWidth())}
          </text>
        </box>
      </box>

      {/* Span rows with waterfall */}
      <box flexDirection="column" flexGrow={1} width="100%">
        <For each={visibleSpans()}>
          {(item, i) => {
            const idx = () => scrollOffset() + i()
            const isSelected = () => idx() === cursor()
            const prefix = treePrefix(item.depth, item.hasChildren, item.isCollapsed)
            const t = trace()
            const durationMs = t?.durationMs ?? 1

            const offsetFrac = t && durationMs > 0
              ? Number(item.span.startTimeNano - t.startTimeNano) / 1_000_000 / durationMs
              : 0
            const durationFrac = durationMs > 0
              ? item.span.durationMs / durationMs
              : 0

            // Character-level positioning for precise waterfall bars
            const ww = rulerWidth()
            const startCol = Math.min(ww - 1, Math.floor(offsetFrac * ww))
            const barLen = Math.max(1, Math.min(Math.round(durationFrac * ww), ww - startCol))

            const color = barColor(item.span)
            const svcColor = svcColors().get(item.span.serviceName) ?? theme.dim

            // For collapsed spans, show hidden count after the name
            const collapsedSuffix = item.isCollapsed && item.hiddenCount > 0
              ? ` (+${item.hiddenCount})`
              : ""
            const nameAvail = nameWidth - prefix.length
            const nameStr = item.isCollapsed && item.hiddenCount > 0
              ? truncate(item.span.name, nameAvail - collapsedSuffix.length) + collapsedSuffix
              : truncate(item.span.name, nameAvail)

            return (
              <box
                width="100%"
                height={1}
                flexDirection="row"
                backgroundColor={isSelected() ? theme.selected : theme.normal}
                paddingLeft={1}
              >
                {/* Span name with tree prefix */}
                <box width={nameWidth} flexDirection="row">
                  {prefix.length > 0 && (
                    <box width={prefix.length}>
                      <text fg={item.hasChildren ? theme.collapseIndicator : theme.tree}>{prefix}</text>
                    </box>
                  )}
                  <box flexGrow={1}>
                    <text fg={isSelected() ? "#c0caf5" : theme.spanName}>
                      {nameStr}
                    </text>
                  </box>
                </box>

                {/* Service name (colored by service) */}
                <box width={serviceWidth}>
                  <text fg={svcColor}>
                    {truncate(item.span.serviceName, serviceWidth - 1)}
                  </text>
                </box>

                {/* Duration */}
                <box width={durationWidth}>
                  <text fg={theme.duration}>
                    {formatDuration(item.span.durationMs).padStart(durationWidth - 2)}
                  </text>
                </box>

                {/* Divider */}
                <box width={1}>
                  <text fg={theme.divider}>{"\u2502"}</text>
                </box>

                {/* Waterfall bar — character-level positioning for precision */}
                <box flexGrow={1} flexDirection="row">
                  {/* Space before the bar */}
                  {startCol > 0 && (
                    <box width={startCol}>
                      <text fg={theme.barBg}>{"\u2500".repeat(FILL)}</text>
                    </box>
                  )}
                  {/* The bar itself */}
                  <box width={barLen}>
                    <text fg={color}>{"\u2588".repeat(FILL)}</text>
                  </box>
                  {/* Remaining space after the bar */}
                  <box flexGrow={1}>
                    <text fg={theme.barBg}>{"\u2500".repeat(FILL)}</text>
                  </box>
                </box>
              </box>
            )
          }}
        </For>
      </box>

      {/* Footer */}
      <box width="100%" height={1} backgroundColor={theme.header} paddingLeft={1} flexDirection="row">
        <text fg={theme.dim}>
          {flatSpans().length} spans
          {filter.searchQuery ? ` (search: "${filter.searchQuery}")` : ""}
          {flatSpans().length > 0 ? ` | ${cursor() + 1}/${flatSpans().length}` : ""}
        </text>
      </box>

      {/* Search bar */}
      {filter.showSearch && (
        <box width="100%" height={1} backgroundColor="#292e42" flexDirection="row" paddingLeft={1}>
          <text fg={theme.duration}>/ </text>
          <text fg="#c0caf5">{filter.searchQuery}</text>
          <text fg={theme.duration}>_</text>
        </box>
      )}
    </box>
  )
}
