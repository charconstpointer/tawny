import path from "node:path"
import { Switch, Match, Show } from "solid-js"
import { render, useKeyboard } from "@opentui/solid"
import { RouteProvider, useRoute } from "./context/route"
import { TracesProvider, useTraces } from "./context/traces"
import { FilterProvider, useFilter } from "./context/filter"
import { ThemeProvider, useTheme } from "./context/theme"
import { TraceList } from "./component/trace-list"
import { Insights } from "./component/insights"
import { TraceDetail } from "./component/trace-detail"
import { SpanDetail } from "./component/span-detail"
import { TraceFlamegraph } from "./component/trace-flamegraph"
import { ServiceFilter } from "./component/service-filter"
import { HelpOverlay } from "./component/help-overlay"
import { ThemePicker } from "./component/theme-picker"
import { StatusBar } from "./component/status-bar"
import type { TraceSummary } from "./types"

function AppContent() {
  const route = useRoute()
  const filter = useFilter()
  const theme = useTheme()
  const filename = process.argv.find(a => a.endsWith(".jsonl") || a.endsWith(".json"))
  const basename = filename ? path.basename(filename) : ""

  useKeyboard((key) => {
    if (filter.showHelp) return
    if (filter.showServiceFilter || theme.showThemePicker) return

    if (key.name === "?") {
      filter.toggleHelp()
    }
  })

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={theme.colors.bg}
    >
      {/* Title */}
      <box
        width="100%"
        height={1}
        backgroundColor={theme.colors.bg}
        flexDirection="row"
        paddingLeft={1}
      >
        <text fg={theme.colors.accent}>OpenTUI Traces{basename ? ` — ${basename}` : ""}</text>
        <text fg={theme.colors.fgDim}> - OpenTelemetry Trace Viewer</text>
      </box>

      {/* Main content */}
      <box flexGrow={1} width="100%" flexDirection="column">
        <Switch>
          <Match when={route.data.type === "trace-list"}>
            <TraceList />
          </Match>
          <Match when={route.data.type === "insights"}>
            <Insights />
          </Match>
          <Match when={route.data.type === "trace-detail"}>
            <TraceDetail />
          </Match>
          <Match when={route.data.type === "span-detail"}>
            <SpanDetail />
          </Match>
          <Match when={route.data.type === "trace-flamegraph"}>
            <TraceFlamegraph />
          </Match>
        </Switch>
      </box>

      {/* Status bar */}
      <StatusBar />

      {/* Overlays */}
      <Show when={filter.showServiceFilter}>
        <ServiceFilter />
      </Show>
      <Show when={theme.showThemePicker}>
        <ThemePicker />
      </Show>
      <Show when={filter.showHelp}>
        <HelpOverlay />
      </Show>
    </box>
  )
}

/** Helper component that loads trace data into context on mount */
function TracesLoader(props: { traces: TraceSummary[] }) {
  const tracesCtx = useTraces()
  tracesCtx.load(props.traces)
  return <></>
}

/** Helper component that sets the active theme on mount */
function ThemeLoader(props: { themeId: string }) {
  const themeCtx = useTheme()
  themeCtx.setTheme(props.themeId)
  return <></>
}

export function tui(traces: TraceSummary[], themeId = "tokyo-night") {
  render(
    () => (
      <RouteProvider>
        <TracesProvider>
          <ThemeProvider>
            <FilterProvider>
              <TracesLoader traces={traces} />
              <ThemeLoader themeId={themeId} />
              <AppContent />
            </FilterProvider>
          </ThemeProvider>
        </TracesProvider>
      </RouteProvider>
    ),
    { exitOnCtrlC: true },
  )
}
