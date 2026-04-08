import type { ParsedSpan } from "../types"

export function computeCriticalPath(spans: ParsedSpan[]): Set<string> {
  if (spans.length === 0) return new Set<string>()

  const spanIds = new Set(spans.map(span => span.spanId))
  const childrenByParent = new Map<string, ParsedSpan[]>()

  for (const span of spans) {
    const parentId = span.parentSpanId ?? ""
    const siblings = childrenByParent.get(parentId)
    if (siblings) {
      siblings.push(span)
    } else {
      childrenByParent.set(parentId, [span])
    }
  }

  const roots = spans.filter(span => !span.parentSpanId || !spanIds.has(span.parentSpanId))
  const root = roots.reduce((latest, span) => {
    if (!latest || span.endTimeNano > latest.endTimeNano) return span
    return latest
  }, roots[0])
  const criticalPath = new Set<string>()

  if (!root) return criticalPath

  const walk = (span: ParsedSpan) => {
    criticalPath.add(span.spanId)

    const children = childrenByParent.get(span.spanId) ?? []
    if (children.length === 0) return

    let criticalChild = children[0]!
    for (const child of children.slice(1)) {
      if (child.endTimeNano > criticalChild.endTimeNano) {
        criticalChild = child
      }
    }

    walk(criticalChild)
  }

  walk(root)

  return criticalPath
}
