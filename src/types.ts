// OTLP JSON wire format types (from the JSONL export)

export interface OtlpValue {
  stringValue?: string
  intValue?: string
  boolValue?: boolean
  doubleValue?: number
  arrayValue?: { values: OtlpValue[] }
  kvlistValue?: { values: OtlpAttribute[] }
}

export interface OtlpAttribute {
  key: string
  value: OtlpValue
}

export interface OtlpResource {
  attributes: OtlpAttribute[]
}

export interface OtlpScope {
  name: string
  version?: string
}

export interface OtlpStatus {
  message?: string
  code?: number // 0=UNSET, 1=OK, 2=ERROR
}

export interface OtlpSpan {
  traceId: string
  spanId: string
  parentSpanId?: string
  flags?: number
  name: string
  kind: number // 0=UNSPECIFIED, 1=INTERNAL, 2=SERVER, 3=CLIENT, 4=PRODUCER, 5=CONSUMER
  startTimeUnixNano: string
  endTimeUnixNano: string
  attributes?: OtlpAttribute[]
  status?: OtlpStatus
  events?: OtlpEvent[]
  links?: OtlpLink[]
}

export interface OtlpEvent {
  timeUnixNano: string
  name: string
  attributes?: OtlpAttribute[]
}

export interface OtlpLink {
  traceId: string
  spanId: string
  attributes?: OtlpAttribute[]
}

export interface OtlpScopeSpans {
  scope: OtlpScope
  spans: OtlpSpan[]
}

export interface OtlpResourceSpans {
  resource: OtlpResource
  scopeSpans: OtlpScopeSpans[]
}

export interface OtlpExportRequest {
  resourceSpans: OtlpResourceSpans[]
}

// Application domain types

export const SpanKind = {
  0: "UNSPECIFIED",
  1: "INTERNAL",
  2: "SERVER",
  3: "CLIENT",
  4: "PRODUCER",
  5: "CONSUMER",
} as const

export const StatusCode = {
  0: "UNSET",
  1: "OK",
  2: "ERROR",
} as const

export type StatusCodeName = (typeof StatusCode)[keyof typeof StatusCode]

export interface ParsedSpan {
  traceId: string
  spanId: string
  parentSpanId: string | undefined
  name: string
  kind: string
  serviceName: string
  serviceVersion: string
  scopeName: string
  scopeVersion: string | undefined
  startTimeNano: bigint
  endTimeNano: bigint
  durationNano: bigint
  durationMs: number
  status: StatusCodeName
  statusMessage: string
  attributes: Map<string, string>
  events: ParsedEvent[]
  children: ParsedSpan[]
}

export interface ParsedEvent {
  timeNano: bigint
  name: string
  attributes: Map<string, string>
}

export interface TraceSummary {
  traceId: string
  services: string[]
  spanCount: number
  errorCount: number
  rootSpan: ParsedSpan | undefined
  startTimeNano: bigint
  endTimeNano: bigint
  durationMs: number
  spans: ParsedSpan[]
  tree: ParsedSpan[] // root-level spans (no parent or parent not in trace)
}

// Navigation

export type Route =
  | { type: "trace-list" }
  | { type: "trace-detail"; traceId: string }
  | { type: "span-detail"; traceId: string; spanId: string }
