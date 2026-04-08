import type {
  OtlpExportRequest,
  OtlpAttribute,
  OtlpValue,
  ParsedSpan,
  ParsedEvent,
  TraceSummary,
} from "./types"
import { SpanKind, StatusCode } from "./types"

function resolveValue(v: OtlpValue): string {
  if (!v) return ""
  if (v.stringValue !== undefined) return v.stringValue
  if (v.intValue !== undefined) return v.intValue
  if (v.boolValue !== undefined) return String(v.boolValue)
  if (v.doubleValue !== undefined) return String(v.doubleValue)
  if (v.arrayValue && v.arrayValue.values) {
    return JSON.stringify(v.arrayValue.values.map(resolveValue))
  }
  if (v.kvlistValue && v.kvlistValue.values) {
    const obj: Record<string, string> = Object.create(null)
    for (const a of v.kvlistValue.values) obj[a.key] = resolveValue(a.value)
    return JSON.stringify(obj)
  }
  return ""
}

function attrsToMap(attrs?: OtlpAttribute[]): Map<string, string> {
  const map = new Map<string, string>()
  if (!attrs) return map
  for (const a of attrs) {
    map.set(a.key, resolveValue(a.value))
  }
  return map
}

function getAttr(attrs: OtlpAttribute[] | undefined, key: string): string {
  if (!attrs) return ""
  const found = attrs.find((a) => a.key === key)
  return found ? resolveValue(found.value) : ""
}

function parseBigInt(value: unknown): bigint | undefined {
  if (typeof value === "string" && !/^[-+]?\d+$/.test(value.trim())) return undefined

  try {
    return BigInt(value as string | number | bigint)
  } catch (err: unknown) {
    if (err instanceof TypeError || err instanceof RangeError) return undefined
    throw err
  }
}

export function parseJsonl(content: string): TraceSummary[] {
  const spansByTrace = new Map<string, ParsedSpan[]>()

  const lines = content.split("\n").filter((l) => l.trim().length > 0)

  for (const line of lines) {
    let req: OtlpExportRequest
    try {
      req = JSON.parse(line)
    } catch {
      continue
    }

    if (!req.resourceSpans || !Array.isArray(req.resourceSpans)) continue

    for (const rs of req.resourceSpans) {
      if (!rs.resource || !rs.scopeSpans) continue
      const serviceName = getAttr(rs.resource.attributes, "service.name")
      const serviceVersion = getAttr(rs.resource.attributes, "service.version")

      for (const ss of rs.scopeSpans) {
        for (const span of ss.spans) {
          if (
            span.startTimeUnixNano === undefined ||
            span.startTimeUnixNano === null ||
            span.endTimeUnixNano === undefined ||
            span.endTimeUnixNano === null ||
            !span.traceId ||
            !span.spanId
          ) {
            continue
          }

          const startNano = parseBigInt(span.startTimeUnixNano)
          const endNano = parseBigInt(span.endTimeUnixNano)
          if (startNano === undefined || endNano === undefined) continue

          const durationNano = endNano - startNano

          const parsed: ParsedSpan = {
            traceId: span.traceId,
            spanId: span.spanId,
            parentSpanId: span.parentSpanId || undefined,
            name: span.name,
            kind: SpanKind[span.kind as keyof typeof SpanKind] ?? "UNSPECIFIED",
            serviceName,
            serviceVersion,
            scopeName: ss.scope.name,
            scopeVersion: ss.scope.version,
            startTimeNano: startNano,
            endTimeNano: endNano,
            durationNano,
            durationMs: Number(durationNano) / 1_000_000,
            status: StatusCode[(span.status?.code ?? 0) as keyof typeof StatusCode] ?? "UNSET",
            statusMessage: span.status?.message ?? "",
            attributes: attrsToMap(span.attributes),
            events: (span.events ?? []).flatMap((e): ParsedEvent[] => {
              const timeNano = parseBigInt(e.timeUnixNano)
              if (timeNano === undefined) return []

              return [
                {
                  timeNano,
                  name: e.name,
                  attributes: attrsToMap(e.attributes),
                },
              ]
            }),
            children: [],
          }

          let list = spansByTrace.get(span.traceId)
          if (!list) {
            list = []
            spansByTrace.set(span.traceId, list)
          }
          list.push(parsed)
        }
      }
    }
  }

  // Build trees and summaries
  const traces: TraceSummary[] = []

  for (const [traceId, spans] of spansByTrace) {
    // Sort spans by start time
    spans.sort((a, b) => {
      const diff = a.startTimeNano - b.startTimeNano
      return diff < 0n ? -1 : diff > 0n ? 1 : 0
    })

    // Index by spanId
    const byId = new Map<string, ParsedSpan>()
    for (const s of spans) byId.set(s.spanId, s)

    // Build tree
    const roots: ParsedSpan[] = []
    for (const s of spans) {
      if (s.parentSpanId) {
        const parent = byId.get(s.parentSpanId)
        if (parent) {
          parent.children.push(s)
          continue
        }
      }
      roots.push(s)
    }

    // Collect unique services
    const serviceSet = new Set<string>()
    for (const s of spans) {
      if (s.serviceName) serviceSet.add(s.serviceName)
    }

    // Compute trace timing
    let minStart = spans[0]!.startTimeNano
    let maxEnd = spans[0]!.endTimeNano
    let errorCount = 0
    for (const s of spans) {
      if (s.startTimeNano < minStart) minStart = s.startTimeNano
      if (s.endTimeNano > maxEnd) maxEnd = s.endTimeNano
      if (s.status === "ERROR") errorCount++
    }

    const durationNano = maxEnd - minStart
    const rootSpan = roots.length === 1 ? roots[0] : undefined

    traces.push({
      traceId,
      services: Array.from(serviceSet).sort(),
      spanCount: spans.length,
      errorCount,
      rootSpan,
      startTimeNano: minStart,
      endTimeNano: maxEnd,
      durationMs: Number(durationNano) / 1_000_000,
      spans,
      tree: roots,
    })
  }

  // Sort traces by start time
  traces.sort((a, b) => {
    const diff = a.startTimeNano - b.startTimeNano
    return diff < 0n ? -1 : diff > 0n ? 1 : 0
  })

  return traces
}
