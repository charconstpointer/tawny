import { createSignal, createMemo, For } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { useRoute } from "../context/route"
import { useTraces } from "../context/traces"
import { useFilter } from "../context/filter"
import { useTheme } from "../context/theme"
import { formatDuration, formatTimestamp, shortId } from "../util/format"

interface DetailRow {
  type: "section" | "field" | "attr"
  label: string
  value: string
}

export function SpanDetail() {
  const route = useRoute()
  const traces = useTraces()
  const filter = useFilter()
  const t = useTheme()
  const [scrollOffset, setScrollOffset] = createSignal(0)
  const visibleHeight = () => Math.max(5, (process.stdout.rows ?? 30) - 5)

  const span = createMemo(() => {
    if (route.data.type !== "span-detail") return undefined
    return traces.span(route.data.traceId, route.data.spanId)
  })

  const rows = createMemo((): DetailRow[] => {
    const s = span()
    if (!s) return []

    const r: DetailRow[] = []

    r.push({ type: "section", label: "Span Info", value: "" })
    r.push({ type: "field", label: "Name", value: s.name })
    r.push({ type: "field", label: "Span ID", value: s.spanId })
    r.push({ type: "field", label: "Trace ID", value: s.traceId })
    r.push({ type: "field", label: "Parent Span ID", value: s.parentSpanId ?? "(none)" })
    r.push({ type: "field", label: "Kind", value: s.kind })
    r.push({ type: "field", label: "Status", value: s.status })
    if (s.statusMessage) {
      r.push({ type: "field", label: "Status Message", value: s.statusMessage })
    }

    r.push({ type: "section", label: "Timing", value: "" })
    r.push({ type: "field", label: "Start", value: formatTimestamp(s.startTimeNano) })
    r.push({ type: "field", label: "End", value: formatTimestamp(s.endTimeNano) })
    r.push({ type: "field", label: "Duration", value: formatDuration(s.durationMs) })

    r.push({ type: "section", label: "Service", value: "" })
    r.push({ type: "field", label: "Service Name", value: s.serviceName || "(unknown)" })
    r.push({ type: "field", label: "Service Version", value: s.serviceVersion || "(unknown)" })
    r.push({ type: "field", label: "Scope", value: s.scopeName || "(unknown)" })
    if (s.scopeVersion) {
      r.push({ type: "field", label: "Scope Version", value: s.scopeVersion })
    }

    if (s.attributes.size > 0) {
      r.push({ type: "section", label: `Attributes (${s.attributes.size})`, value: "" })
      for (const [k, v] of s.attributes) {
        r.push({ type: "attr", label: k, value: v })
      }
    }

    if (s.events.length > 0) {
      r.push({ type: "section", label: `Events (${s.events.length})`, value: "" })
      for (const e of s.events) {
        r.push({ type: "field", label: "Event", value: `${e.name} @ ${formatTimestamp(e.timeNano)}` })
        for (const [k, v] of e.attributes) {
          r.push({ type: "attr", label: `  ${k}`, value: v })
        }
      }
    }

    return r
  })

  const maxScroll = () => Math.max(0, rows().length - visibleHeight())

  useKeyboard((key) => {
    if (route.data.type !== "span-detail") return
    if (t.showThemePicker) return
    if (key.name === "t") { filter.closeServiceFilter(); t.openThemePicker(); return }

    // j/k — scroll down/up
    if (key.name === "j" || key.name === "down") {
      setScrollOffset((o) => Math.min(o + 1, maxScroll()))
    }
    if (key.name === "k" || key.name === "up") {
      setScrollOffset((o) => Math.max(0, o - 1))
    }
    // g / G — scroll to top / bottom
    if (key.shift && key.name === "g") {
      setScrollOffset(maxScroll())
    } else if (key.name === "g") {
      setScrollOffset(0)
    }
    // Ctrl+d / Ctrl+u — half page down / up
    if (key.ctrl && key.name === "d") {
      const half = Math.floor(visibleHeight() / 2)
      setScrollOffset((o) => Math.min(o + half, maxScroll()))
    }
    if (key.ctrl && key.name === "u") {
      const half = Math.floor(visibleHeight() / 2)
      setScrollOffset((o) => Math.max(0, o - half))
    }
    // Ctrl+f / Ctrl+b — full page down / up
    if (key.ctrl && key.name === "f") {
      const page = visibleHeight() - 2
      setScrollOffset((o) => Math.min(o + page, maxScroll()))
    }
    if (key.ctrl && key.name === "b") {
      const page = visibleHeight() - 2
      setScrollOffset((o) => Math.max(0, o - page))
    }
    // h / Esc — go back
    if (key.name === "escape" || (!key.shift && !key.ctrl && key.name === "h")) {
      route.back()
    }
    if (key.name === "q") {
      process.exit(0)
    }
  })

  const visibleRows = createMemo(() => {
    return rows().slice(scrollOffset(), scrollOffset() + visibleHeight())
  })

  const statusColor = () => {
    const s = span()
    if (!s) return t.colors.fgDim
    if (s.status === "ERROR") return t.colors.error
    if (s.status === "OK") return t.colors.success
    return t.colors.fgDim
  }

  return (
    <box flexDirection="column" flexGrow={1} width="100%">
      {/* Title bar */}
      <box
        width="100%"
        height={1}
        backgroundColor={t.colors.border}
        flexDirection="row"
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={statusColor()}>
          {span()?.status === "ERROR" ? "\u25CF " : span()?.status === "OK" ? "\u25CF " : "\u25CB "}
        </text>
        <text fg={t.colors.headerFg}>
          {span()?.name ?? "Span Detail"} ({shortId(span()?.spanId ?? "", 8)})
        </text>
      </box>

      {/* Detail rows */}
      <box flexDirection="column" flexGrow={1} width="100%" paddingLeft={1} paddingRight={1}>
        <For each={visibleRows()}>
          {(row) => {
            if (row.type === "section") {
              return (
                <box width="100%" height={1} backgroundColor={t.colors.bgAlt} paddingLeft={1}>
                  <text fg={t.colors.headerFg}>{`\u2500\u2500 ${row.label} \u2500\u2500`}</text>
                </box>
              )
            }

            const labelColor = row.type === "attr" ? t.colors.accent2 : t.colors.accent
            const valueColor = row.type === "attr" ? t.colors.success : t.colors.fg

            return (
              <box width="100%" height={1} flexDirection="row" paddingLeft={2}>
                <box width={20}>
                  <text fg={labelColor}>{row.label}</text>
                </box>
                <text fg={valueColor}>{row.value}</text>
              </box>
            )
          }}
        </For>
      </box>

      {/* Footer */}
      <box width="100%" height={1} backgroundColor={t.colors.border} paddingLeft={1}>
        <text fg={t.colors.fgDim}>
          {rows().length > visibleHeight()
            ? `Scroll: ${scrollOffset() + 1}-${Math.min(scrollOffset() + visibleHeight(), rows().length)}/${rows().length}`
            : `${rows().length} fields`}
        </text>
      </box>
    </box>
  )
}
