import type { TraceSummary } from "./types"

export interface InsightOverview {
  traceCount: number
  totalSpans: number
  totalErrors: number
  errorTraceCount: number
  serviceCount: number
  avgTraceDurationMs: number
  p95TraceDurationMs: number
  windowStartMs: number
  windowEndMs: number
}

export interface SlowTraceInsight {
  traceId: string
  rootSpanName: string
  durationMs: number
  spanCount: number
  errorCount: number
  services: string[]
  startTimeMs: number
}

export interface RootOperationInsight {
  serviceName: string
  spanName: string
  count: number
  errorCount: number
  avgDurationMs: number
  maxDurationMs: number
  totalDurationMs: number
  slowestTraceId: string
  slowestTraceDurationMs: number
}

export interface ServiceHealthInsight {
  serviceName: string
  traceCount: number
  spanCount: number
  errorCount: number
  avgTraceDurationMs: number
  maxTraceDurationMs: number
  slowestTraceId: string | null
}

export interface TraceInsights {
  overview: InsightOverview
  slowestTraces: SlowTraceInsight[]
  hottestOperations: RootOperationInsight[]
  serviceHealth: ServiceHealthInsight[]
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = values.slice().sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))
  return sorted[idx] ?? 0
}

export function summarizeTraces(
  traces: TraceSummary[],
  limits: {
    slowestTraces?: number
    hottestOperations?: number
    serviceHealth?: number
  } = {},
): TraceInsights {
  const slowTraceLimit = limits.slowestTraces ?? 8
  const operationLimit = limits.hottestOperations ?? 8
  const serviceLimit = limits.serviceHealth ?? 8

  const totalSpans = traces.reduce((sum, trace) => sum + trace.spanCount, 0)
  const totalErrors = traces.reduce((sum, trace) => sum + trace.errorCount, 0)
  const errorTraceCount = traces.filter(trace => trace.errorCount > 0).length
  const durations = traces.map(trace => trace.durationMs)

  let windowStartMs = 0
  let windowEndMs = 0
  if (traces.length > 0) {
    windowStartMs = Number(traces[0]!.startTimeNano / 1_000_000n)
    windowEndMs = Number(traces[0]!.endTimeNano / 1_000_000n)
    for (const trace of traces) {
      const startMs = Number(trace.startTimeNano / 1_000_000n)
      const endMs = Number(trace.endTimeNano / 1_000_000n)
      if (startMs < windowStartMs) windowStartMs = startMs
      if (endMs > windowEndMs) windowEndMs = endMs
    }
  }

  const serviceNames = new Set<string>()
  const operations = new Map<string, {
    serviceName: string
    spanName: string
    count: number
    errorCount: number
    totalDurationMs: number
    maxDurationMs: number
    slowestTraceId: string
    slowestTraceDurationMs: number
  }>()
  const services = new Map<string, {
    traceCount: number
    spanCount: number
    errorCount: number
    totalTraceDurationMs: number
    maxTraceDurationMs: number
    slowestTraceId: string | null
  }>()

  for (const trace of traces) {
    for (const service of trace.services) {
      serviceNames.add(service)
    }

    const roots = trace.rootSpan ? [trace.rootSpan] : trace.tree
    for (const root of roots) {
      const key = `${root.serviceName}:${root.name}`
      const current = operations.get(key)
      if (current) {
        current.count += 1
        current.totalDurationMs += root.durationMs
        if (root.status === "ERROR" || trace.errorCount > 0) {
          current.errorCount += 1
        }
        if (root.durationMs > current.maxDurationMs) {
          current.maxDurationMs = root.durationMs
          current.slowestTraceId = trace.traceId
          current.slowestTraceDurationMs = root.durationMs
        }
      } else {
        operations.set(key, {
          serviceName: root.serviceName,
          spanName: root.name,
          count: 1,
          errorCount: root.status === "ERROR" || trace.errorCount > 0 ? 1 : 0,
          totalDurationMs: root.durationMs,
          maxDurationMs: root.durationMs,
          slowestTraceId: trace.traceId,
          slowestTraceDurationMs: root.durationMs,
        })
      }
    }

    const seenServices = new Set<string>()
    for (const span of trace.spans) {
      const serviceName = span.serviceName || "(unknown)"
      const current = services.get(serviceName)
      if (current) {
        current.spanCount += 1
        if (span.status === "ERROR") {
          current.errorCount += 1
        }
      } else {
        services.set(serviceName, {
          traceCount: 0,
          spanCount: 1,
          errorCount: span.status === "ERROR" ? 1 : 0,
          totalTraceDurationMs: 0,
          maxTraceDurationMs: 0,
          slowestTraceId: null,
        })
      }

      if (!seenServices.has(serviceName)) {
        const entry = services.get(serviceName)!
        entry.traceCount += 1
        entry.totalTraceDurationMs += trace.durationMs
        if (trace.durationMs > entry.maxTraceDurationMs) {
          entry.maxTraceDurationMs = trace.durationMs
          entry.slowestTraceId = trace.traceId
        }
        seenServices.add(serviceName)
      }
    }
  }

  return {
    overview: {
      traceCount: traces.length,
      totalSpans,
      totalErrors,
      errorTraceCount,
      serviceCount: serviceNames.size,
      avgTraceDurationMs: traces.length > 0 ? durations.reduce((sum, value) => sum + value, 0) / traces.length : 0,
      p95TraceDurationMs: percentile(durations, 0.95),
      windowStartMs,
      windowEndMs,
    },
    slowestTraces: traces
      .slice()
      .sort((a, b) => b.durationMs - a.durationMs || b.errorCount - a.errorCount)
      .slice(0, slowTraceLimit)
      .map(trace => ({
        traceId: trace.traceId,
        rootSpanName: trace.rootSpan?.name ?? "(multiple roots)",
        durationMs: trace.durationMs,
        spanCount: trace.spanCount,
        errorCount: trace.errorCount,
        services: trace.services,
        startTimeMs: Number(trace.startTimeNano / 1_000_000n),
      })),
    hottestOperations: Array.from(operations.values())
      .sort((a, b) => b.totalDurationMs - a.totalDurationMs || b.count - a.count || b.maxDurationMs - a.maxDurationMs)
      .slice(0, operationLimit)
      .map(operation => ({
        serviceName: operation.serviceName,
        spanName: operation.spanName,
        count: operation.count,
        errorCount: operation.errorCount,
        avgDurationMs: operation.totalDurationMs / operation.count,
        maxDurationMs: operation.maxDurationMs,
        totalDurationMs: operation.totalDurationMs,
        slowestTraceId: operation.slowestTraceId,
        slowestTraceDurationMs: operation.slowestTraceDurationMs,
      })),
    serviceHealth: Array.from(services.entries())
      .map(([serviceName, service]) => ({
        serviceName,
        traceCount: service.traceCount,
        spanCount: service.spanCount,
        errorCount: service.errorCount,
        avgTraceDurationMs: service.traceCount > 0 ? service.totalTraceDurationMs / service.traceCount : 0,
        maxTraceDurationMs: service.maxTraceDurationMs,
        slowestTraceId: service.slowestTraceId,
      }))
      .sort((a, b) => b.errorCount - a.errorCount || b.traceCount - a.traceCount || b.spanCount - a.spanCount)
      .slice(0, serviceLimit),
  }
}
