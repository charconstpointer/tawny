import { Switch, Match, Show } from "solid-js"
import { render, useKeyboard } from "@opentui/solid"
import { RouteProvider, useRoute } from "./context/route"
import { TracesProvider, useTraces } from "./context/traces"
import { FilterProvider, useFilter } from "./context/filter"
import { TraceList } from "./component/trace-list"
import { TraceDetail } from "./component/trace-detail"
import { SpanDetail } from "./component/span-detail"
import { ServiceFilter } from "./component/service-filter"
import { StatusBar } from "./component/status-bar"
import type { TraceSummary } from "./types"

function AppContent() {
  const route = useRoute()
  const filter = useFilter()

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor="#1a1b26"
    >
      {/* Title */}
      <box
        width="100%"
        height={1}
        backgroundColor="#1a1b26"
        flexDirection="row"
        paddingLeft={1}
      >
        <text fg="#7aa2f7">OpenTUI Traces</text>
        <text fg="#565f89"> - OpenTelemetry Trace Viewer</text>
      </box>

      {/* Main content */}
      <box flexGrow={1} width="100%" flexDirection="column">
        <Switch>
          <Match when={route.data.type === "trace-list"}>
            <TraceList />
          </Match>
          <Match when={route.data.type === "trace-detail"}>
            <TraceDetail />
          </Match>
          <Match when={route.data.type === "span-detail"}>
            <SpanDetail />
          </Match>
        </Switch>
      </box>

      {/* Status bar */}
      <StatusBar />

      {/* Overlays */}
      <Show when={filter.showServiceFilter}>
        <ServiceFilter />
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

export function tui(traces: TraceSummary[]) {
  render(
    () => (
      <RouteProvider>
        <TracesProvider>
          <FilterProvider>
            <TracesLoader traces={traces} />
            <AppContent />
          </FilterProvider>
        </TracesProvider>
      </RouteProvider>
    ),
    { exitOnCtrlC: true },
  )
}
