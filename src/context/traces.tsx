import { createSimpleContext } from "./helper"
import type { TraceSummary, ParsedSpan } from "../types"

export const { use: useTraces, provider: TracesProvider } = createSimpleContext({
  name: "Traces",
  init: () => {
    let _traces: TraceSummary[] = []
    const _byId = new Map<string, TraceSummary>()
    const _spanIndex = new Map<string, ParsedSpan>() // "traceId:spanId" -> span

    return {
      load(traces: TraceSummary[]) {
        _traces = traces
        _byId.clear()
        _spanIndex.clear()
        for (const t of traces) {
          _byId.set(t.traceId, t)
          for (const s of t.spans) {
            _spanIndex.set(`${t.traceId}:${s.spanId}`, s)
          }
        }
      },
      get all() {
        return _traces
      },
      get allServices(): string[] {
        const set = new Set<string>()
        for (const t of _traces) {
          for (const svc of t.services) set.add(svc)
        }
        return Array.from(set).sort()
      },
      byId(traceId: string): TraceSummary | undefined {
        return _byId.get(traceId)
      },
      span(traceId: string, spanId: string): ParsedSpan | undefined {
        return _spanIndex.get(`${traceId}:${spanId}`)
      },
    }
  },
})
