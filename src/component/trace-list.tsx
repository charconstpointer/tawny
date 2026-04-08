import { createSignal, createMemo, For } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { useRoute } from "../context/route"
import { useTraces } from "../context/traces"
import { useFilter } from "../context/filter"
import { useTheme } from "../context/theme"
import { shortId, formatDuration, formatTimeShort, truncate } from "../util/format"
import type { TraceSummary } from "../types"

export function TraceList() {
  const route = useRoute()
  const traces = useTraces()
  const filter = useFilter()
  const t = useTheme()
  const [cursor, setCursor] = createSignal(0)
  const [scrollOffset, setScrollOffset] = createSignal(0)
  // Terminal height minus chrome: title(1) + header(1) + footer(1) + statusbar(1) + search(1) = 5
  const visibleHeight = () => Math.max(5, (process.stdout.rows ?? 30) - 5)
  // Fixed column widths: traceId(10) + spans(8) + duration(12) + time(14) + status(8) + padding(2) = 54
  const FIXED_COLS = 54
  // ROOT SPAN gets ~60% of the flexible space, SERVICES gets the rest
  const rootSpanWidth = () => {
    const flex = Math.max(0, (process.stdout.columns ?? 120) - FIXED_COLS)
    return Math.max(16, Math.floor(flex * 0.6))
  }
  const servicesWidth = () => {
    const cols = process.stdout.columns ?? 120
    return Math.max(8, cols - FIXED_COLS - rootSpanWidth())
  }

  const filtered = createMemo(() => {
    let list = traces.all
    const min = filter.minSpans
    if (min > 0) {
      list = list.filter((t) => t.spanCount >= min)
    }
    const services = filter.selectedServices
    if (services.size > 0) {
      list = list.filter((t) => t.services.some((s) => services.has(s)))
    }
    const q = filter.searchQuery.toLowerCase()
    if (q) {
      list = list.filter(
        (t) =>
          t.traceId.toLowerCase().includes(q) ||
          t.services.some((s) => s.toLowerCase().includes(q)) ||
          t.spans.some((s) => s.name.toLowerCase().includes(q))
      )
    }
    return list.slice().sort((a, b) => b.spanCount - a.spanCount)
  })

  const clampCursor = (c: number) => Math.max(0, Math.min(c, filtered().length - 1))

  useKeyboard((key) => {
    if (route.data.type !== "trace-list") return
    if (t.showThemePicker) return
    if (key.name === "t") { filter.closeServiceFilter(); t.openThemePicker(); return }
    if (filter.showServiceFilter) return

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
      const last = Math.max(0, filtered().length - 1)
      setCursor(last)
      setScrollOffset(Math.max(0, last - visibleHeight() + 2))
    } else if (key.name === "g") {
      setCursor(0)
      setScrollOffset(0)
    }
    // Ctrl+d / Ctrl+u — half page down / up
    if (key.ctrl && key.name === "d") {
      const half = Math.floor(visibleHeight() / 2)
      const maxScroll = Math.max(0, filtered().length - visibleHeight())
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
      const maxScroll = Math.max(0, filtered().length - visibleHeight())
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
      setCursor(clampCursor(Math.min(scrollOffset() + visibleHeight() - 2, filtered().length - 1)))
    }
    // l / Enter — open trace
    if (!key.shift && !key.ctrl && key.name === "l") {
      const item = filtered()[cursor()]
      if (item) {
        route.navigate({ type: "trace-detail", traceId: item.traceId })
      }
    }
    if (key.name === "return") {
      const item = filtered()[cursor()]
      if (item) {
        route.navigate({ type: "trace-detail", traceId: item.traceId })
      }
    }
    if (key.name === "slash" || (key.name === "/" as string)) {
      filter.openSearch()
    }
    if (!key.ctrl && key.name === "f") {
      filter.toggleServiceFilter()
    }
    if (key.name === "n") {
      filter.cycleMinSpans()
      setCursor(0)
      setScrollOffset(0)
    }
    if (key.name === "q") {
      process.exit(0)
    }
  })

  const visibleTraces = createMemo(() => {
    const f = filtered()
    const start = scrollOffset()
    const end = start + visibleHeight()
    return f.slice(start, end)
  })

  const statusColor = (trace: TraceSummary) => {
    if (trace.errorCount > 0) return t.colors.error
    return t.colors.success
  }

  return (
    <box flexDirection="column" flexGrow={1} width="100%">
      {/* Header */}
      <box
        width="100%"
        height={1}
        flexDirection="row"
        backgroundColor={t.colors.border}
        paddingLeft={1}
        paddingRight={1}
      >
        <box width={10}>
          <text fg={t.colors.headerFg}>TRACE ID</text>
        </box>
        <box width={rootSpanWidth()}>
          <text fg={t.colors.headerFg}>ROOT SPAN</text>
        </box>
        <box width={8}>
          <text fg={t.colors.headerFg}>SPANS</text>
        </box>
        <box width={12}>
          <text fg={t.colors.headerFg}>DURATION</text>
        </box>
        <box width={14}>
          <text fg={t.colors.headerFg}>TIME</text>
        </box>
        <box width={8}>
          <text fg={t.colors.headerFg}>STATUS</text>
        </box>
        <box flexGrow={1}>
          <text fg={t.colors.headerFg}>SERVICES</text>
        </box>
      </box>

      {/* List */}
      <box flexDirection="column" flexGrow={1} width="100%">
        <For each={visibleTraces()}>
          {(trace, i) => {
            const idx = () => scrollOffset() + i()
            const isSelected = () => idx() === cursor()

            return (
              <box
                width="100%"
                height={1}
                flexDirection="row"
                backgroundColor={isSelected() ? t.colors.bgHighlight : t.colors.bg}
                paddingLeft={1}
                paddingRight={1}
              >
                <box width={10}>
                  <text fg={t.colors.accent2}>{shortId(trace.traceId)}</text>
                </box>
                <box width={rootSpanWidth()}>
                  <text fg={t.colors.headerFg}>{truncate(trace.rootSpan?.name ?? "(no root)", rootSpanWidth() - 1)}</text>
                </box>
                <box width={8}>
                  <text fg={t.colors.fgDim}>{String(trace.spanCount).padStart(5)}</text>
                </box>
                <box width={12}>
                  <text fg={t.colors.accent}>{formatDuration(trace.durationMs).padStart(9)}</text>
                </box>
                <box width={14}>
                  <text fg={t.colors.fgDim}>{formatTimeShort(trace.startTimeNano)}</text>
                </box>
                <box width={8}>
                  <text fg={statusColor(trace)}>
                    {trace.errorCount > 0 ? `ERR(${trace.errorCount})` : "OK"}
                  </text>
                </box>
                <box flexGrow={1}>
                  <text fg={t.colors.accent3}>{truncate(trace.services.join(", "), servicesWidth() - 1)}</text>
                </box>
              </box>
            )
          }}
        </For>
      </box>

      {/* Footer info */}
      <box width="100%" height={1} flexDirection="row" backgroundColor={t.colors.border} paddingLeft={1}>
        <text fg={t.colors.fgDim}>
          {filtered().length} traces
          {filter.minSpans > 0 ? ` (min ${filter.minSpans} spans)` : ""}
          {filter.selectedServices.size > 0 ? ` (filtered by ${filter.selectedServices.size} services)` : ""}
          {filter.searchQuery ? ` (search: "${filter.searchQuery}")` : ""}
          {filtered().length > 0 ? ` | ${cursor() + 1}/${filtered().length}` : ""}
        </text>
      </box>

      {/* Search bar */}
      {filter.showSearch && (
        <box
          width="100%"
          height={1}
          backgroundColor={t.colors.bgHighlight}
          flexDirection="row"
          paddingLeft={1}
        >
          <text fg={t.colors.accent}>/ </text>
          <text fg={t.colors.fg}>{filter.searchQuery}</text>
          <text fg={t.colors.accent}>_</text>
        </box>
      )}
    </box>
  )
}
