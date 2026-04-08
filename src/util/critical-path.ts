import type { ParsedSpan } from "../types"

export function computeCriticalPath(spans: ParsedSpan[]): Set<string> {
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
  const criticalPath = new Set<string>()

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

  for (const root of roots) {
    walk(root)
  }

  return criticalPath
}
