import { createSignal, createMemo, For } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { useRoute } from "../context/route"
import { useTraces } from "../context/traces"
import { formatDuration, formatTimestamp, shortId } from "../util/format"

const theme = {
  header: "#3b4261",
  headerFg: "#c0caf5",
  label: "#7aa2f7",
  value: "#c0caf5",
  dim: "#565f89",
  error: "#f7768e",
  ok: "#9ece6a",
  unset: "#565f89",
  attrKey: "#bb9af7",
  attrVal: "#9ece6a",
  sectionBg: "#24283b",
  normal: "#1a1b26",
  selected: "#292e42",
}

interface DetailRow {
  type: "section" | "field" | "attr"
  label: string
  value: string
}

export function SpanDetail() {
  const route = useRoute()
  const traces = useTraces()
  const [scrollOffset, setScrollOffset] = createSignal(0)
  const visibleHeight = 30

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

  useKeyboard((key) => {
    if (route.data.type !== "span-detail") return

    if (key.name === "j" || key.name === "down") {
      setScrollOffset((o) => Math.min(o + 1, Math.max(0, rows().length - visibleHeight)))
    }
    if (key.name === "k" || key.name === "up") {
      setScrollOffset((o) => Math.max(0, o - 1))
    }
    if (key.name === "escape") {
      route.back()
    }
    if (key.name === "q") {
      process.exit(0)
    }
  })

  const visibleRows = createMemo(() => {
    return rows().slice(scrollOffset(), scrollOffset() + visibleHeight)
  })

  const statusColor = () => {
    const s = span()
    if (!s) return theme.dim
    if (s.status === "ERROR") return theme.error
    if (s.status === "OK") return theme.ok
    return theme.unset
  }

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
        <text fg={statusColor()}>
          {span()?.status === "ERROR" ? "\u25CF " : span()?.status === "OK" ? "\u25CF " : "\u25CB "}
        </text>
        <text fg={theme.headerFg}>
          {span()?.name ?? "Span Detail"} ({shortId(span()?.spanId ?? "", 8)})
        </text>
      </box>

      {/* Detail rows */}
      <box flexDirection="column" flexGrow={1} width="100%" paddingLeft={1} paddingRight={1}>
        <For each={visibleRows()}>
          {(row) => {
            if (row.type === "section") {
              return (
                <box width="100%" height={1} backgroundColor={theme.sectionBg} paddingLeft={1}>
                  <text fg={theme.headerFg}>{`\u2500\u2500 ${row.label} \u2500\u2500`}</text>
                </box>
              )
            }

            const labelColor = row.type === "attr" ? theme.attrKey : theme.label
            const valueColor = row.type === "attr" ? theme.attrVal : theme.value

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
      <box width="100%" height={1} backgroundColor={theme.header} paddingLeft={1}>
        <text fg={theme.dim}>
          {rows().length > visibleHeight
            ? `Scroll: ${scrollOffset() + 1}-${Math.min(scrollOffset() + visibleHeight, rows().length)}/${rows().length}`
            : `${rows().length} fields`}
        </text>
      </box>
    </box>
  )
}
