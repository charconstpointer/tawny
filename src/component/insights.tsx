import { createMemo, createSignal, For } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { useRoute } from "../context/route"
import { useTraces } from "../context/traces"
import { useFilter } from "../context/filter"
import { useTheme } from "../context/theme"
import { summarizeTraces } from "../insights"
import { formatDuration, formatTimeShort, shortId, truncate } from "../util/format"

type InsightSection = "overview" | "slow" | "ops" | "services"

const SECTION_TITLES: Record<InsightSection, string> = {
  overview: "Overview",
  slow: "Slowest Traces",
  ops: "Root Operations",
  services: "Service Health",
}

export function Insights() {
  const route = useRoute()
  const traces = useTraces()
  const filter = useFilter()
  const theme = useTheme()
  const [cursor, setCursor] = createSignal(0)
  const [section, setSection] = createSignal<InsightSection>("overview")

  const sections: InsightSection[] = ["overview", "slow", "ops", "services"]
  const visibleHeight = () => Math.max(5, (process.stdout.rows ?? 30) - 7)

  const summary = createMemo(() => summarizeTraces(traces.all))

  const rows = createMemo(() => {
    const data = summary()

    if (section() === "overview") {
      return [
        {
          title: "Trace volume",
          detail: `${data.overview.traceCount} traces · ${data.overview.totalSpans} spans · ${data.overview.serviceCount} services`,
          traceId: null,
        },
        {
          title: "Failures",
          detail: `${data.overview.errorTraceCount} traces with errors · ${data.overview.totalErrors} error spans`,
          traceId: null,
        },
        {
          title: "Latency",
          detail: `avg ${formatDuration(data.overview.avgTraceDurationMs)} · p95 ${formatDuration(data.overview.p95TraceDurationMs)}`,
          traceId: null,
        },
        {
          title: "Capture window",
          detail: `${formatTimeShort(BigInt(Math.round(data.overview.windowStartMs * 1_000_000)))} → ${formatTimeShort(BigInt(Math.round(data.overview.windowEndMs * 1_000_000)))}`,
          traceId: null,
        },
      ]
    }

    if (section() === "slow") {
      return data.slowestTraces.map(trace => ({
        title: `${formatDuration(trace.durationMs)} · ${trace.rootSpanName}`,
        detail: `${trace.spanCount} spans · ${trace.errorCount} errors · ${trace.services.join(", ") || "(unknown service)"}`,
        traceId: trace.traceId,
      }))
    }

    if (section() === "ops") {
      return data.hottestOperations.map(op => ({
        title: `${op.serviceName || "(unknown)"} · ${op.spanName}`,
        detail: `${op.count} traces · avg ${formatDuration(op.avgDurationMs)} · max ${formatDuration(op.maxDurationMs)} · ${op.errorCount} failing traces`,
        traceId: op.slowestTraceId,
      }))
    }

    return data.serviceHealth.map(service => ({
      title: service.serviceName,
      detail: `${service.traceCount} traces · ${service.spanCount} spans · ${service.errorCount} errors · avg ${formatDuration(service.avgTraceDurationMs)}`,
      traceId: service.slowestTraceId,
    }))
  })

  const clampCursor = (next: number) => Math.max(0, Math.min(next, rows().length - 1))

  const selectedRow = createMemo(() => rows()[clampCursor(cursor())])

  useKeyboard((key) => {
    if (route.data.type !== "insights") return
    if (theme.showThemePicker) return
    if (key.name === "t") { filter.closeServiceFilter(); theme.openThemePicker(); return }

    if (key.name === "j" || key.name === "down") {
      setCursor(clampCursor(cursor() + 1))
    }
    if (key.name === "k" || key.name === "up") {
      setCursor(clampCursor(cursor() - 1))
    }
    if (key.shift && key.name === "g") {
      setCursor(Math.max(0, rows().length - 1))
    } else if (key.name === "g") {
      setCursor(0)
    }
    if (!key.ctrl && !key.shift && key.name === "l") {
      const idx = sections.indexOf(section())
      const next = sections[Math.min(sections.length - 1, idx + 1)]
      if (next) {
        setSection(next)
        setCursor(0)
      }
    }
    if (!key.ctrl && !key.shift && key.name === "h") {
      const idx = sections.indexOf(section())
      if (idx > 0) {
        setSection(sections[idx - 1]!)
        setCursor(0)
        return
      }
      route.back()
      return
    }
    if (key.name === "return") {
      const selected = selectedRow()
      if (selected?.traceId) {
        route.navigate({ type: "trace-detail", traceId: selected.traceId })
      }
    }
    if (key.name === "escape") {
      route.back()
    }
    if (key.name === "q") {
      process.exit(0)
    }
  })

  const visibleRows = createMemo(() => rows().slice(0, visibleHeight()))

  const tabWidth = () => Math.max(12, Math.floor(((process.stdout.columns ?? 120) - 2) / sections.length))

  return (
    <box flexDirection="column" flexGrow={1} width="100%">
      <box width="100%" height={1} backgroundColor={theme.colors.border} flexDirection="row" paddingLeft={1} paddingRight={1}>
        <text fg={theme.colors.headerFg}>
          Insights - {summary().overview.traceCount} traces - p95 {formatDuration(summary().overview.p95TraceDurationMs)}
        </text>
      </box>

      <box width="100%" height={1} backgroundColor={theme.colors.bgAlt} flexDirection="row" paddingLeft={1}>
        <For each={sections}>
          {(item) => {
            const active = () => section() === item
            return (
              <box width={tabWidth()}>
                <text fg={active() ? theme.colors.accent : theme.colors.fgDim}>
                  {truncate(SECTION_TITLES[item], tabWidth() - 1)}
                </text>
              </box>
            )
          }}
        </For>
      </box>

      <box flexDirection="column" flexGrow={1} width="100%">
        <For each={visibleRows()}>
          {(row, i) => {
            const isSelected = () => i() === clampCursor(cursor())
            return (
              <box
                width="100%"
                height={1}
                flexDirection="row"
                backgroundColor={isSelected() ? theme.colors.bgHighlight : theme.colors.bg}
                paddingLeft={1}
                paddingRight={1}
              >
                <box width={40}>
                  <text fg={theme.colors.fg}>{truncate(row.title, 39)}</text>
                </box>
                <box flexGrow={1}>
                  <text fg={row.traceId ? theme.colors.accent3 : theme.colors.fgDim}>{truncate(row.detail, Math.max(10, (process.stdout.columns ?? 120) - 44))}</text>
                </box>
                <box width={10}>
                  <text fg={row.traceId ? theme.colors.accent2 : theme.colors.fgDim}>{row.traceId ? shortId(row.traceId) : ""}</text>
                </box>
              </box>
            )
          }}
        </For>
      </box>

      <box width="100%" height={1} backgroundColor={theme.colors.border} paddingLeft={1}>
        <text fg={theme.colors.fgDim}>
          {SECTION_TITLES[section()]} · {rows().length} rows{selectedRow()?.traceId ? " · Enter: open trace" : ""}
        </text>
      </box>
    </box>
  )
}
