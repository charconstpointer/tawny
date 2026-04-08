import { createMemo, createSignal, For } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { useRoute } from "../context/route"
import { useTraces } from "../context/traces"
import {
  formatDuration,
  formatTimeRuler,
  formatTimeShort,
  serviceColorMap,
  shortId,
  truncate,
} from "../util/format"
import type { ParsedSpan } from "../types"

const theme = {
  normal: "#1a1b26",
  selected: "#292e42",
  header: "#3b4261",
  headerFg: "#c0caf5",
  dim: "#565f89",
  rulerBg: "#24283b",
  rulerFg: "#565f89",
  fill: "#24283b",
  error: "#f7768e",
  duration: "#7aa2f7",
}

const FILL = 2000

interface LayoutBlock {
  span: ParsedSpan
  startCol: number
  width: number
  rowIndex: number
  indexInRow: number
}

interface LayoutRow {
  depth: number
  blocks: LayoutBlock[]
}

interface RowSegment {
  type: "fill" | "block"
  width: number
  color: string
  selected: boolean
  span?: ParsedSpan
}

function buildLayout(
  roots: ParsedSpan[],
  traceDurationMs: number,
  traceStartNano: bigint,
  termWidth: number,
): LayoutRow[] {
  const rows: LayoutBlock[][] = []
  const safeWidth = Math.max(1, termWidth)
  const safeDurationMs = traceDurationMs > 0 ? traceDurationMs : 1

  function walk(spans: ParsedSpan[], depth: number) {
    if (!rows[depth]) rows[depth] = []

    for (const span of spans) {
      const offsetFrac = Number(span.startTimeNano - traceStartNano) / 1_000_000 / safeDurationMs
      const durationFrac = span.durationMs / safeDurationMs
      const startCol = Math.max(0, Math.min(safeWidth - 1, Math.round(offsetFrac * safeWidth)))
      const width = Math.max(1, Math.min(Math.round(durationFrac * safeWidth), safeWidth - startCol))

      rows[depth].push({
        span,
        startCol,
        width,
        rowIndex: depth,
        indexInRow: 0,
      })

      if (span.children.length > 0) {
        walk(span.children, depth + 1)
      }
    }
  }

  walk(roots, 0)

  return rows.map((blocks, rowIndex) => ({
    depth: rowIndex,
    blocks: blocks
      .slice()
      .sort((a, b) => a.startCol - b.startCol || b.width - a.width || a.span.name.localeCompare(b.span.name))
      .map((block, indexInRow) => ({
        ...block,
        rowIndex,
        indexInRow,
      })),
  }))
}

function buildRowSegments(row: LayoutRow | undefined, width: number, selectedIndex: number): RowSegment[] {
  const segments: RowSegment[] = []
  const safeWidth = Math.max(1, width)

  if (!row || row.blocks.length === 0) {
    return [{ type: "fill", width: safeWidth, color: theme.fill, selected: false }]
  }

  let col = 0

  for (let i = 0; i < row.blocks.length && col < safeWidth; i++) {
    const block = row.blocks[i]
    const start = Math.max(col, block.startCol)

    if (start > col) {
      segments.push({ type: "fill", width: start - col, color: theme.fill, selected: false })
      col = start
    }

    const end = Math.max(start, Math.min(safeWidth, block.startCol + block.width))
    if (end > start) {
      segments.push({
        type: "block",
        width: end - start,
        color: theme.duration,
        selected: block.indexInRow === selectedIndex,
        span: block.span,
      })
      col = end
    }
  }

  if (col < safeWidth) {
    segments.push({ type: "fill", width: safeWidth - col, color: theme.fill, selected: false })
  }

  return segments
}

export function TraceFlamegraph() {
  const route = useRoute()
  const traces = useTraces()
  const [cursor, setCursor] = createSignal(0)
  const [scrollOffset, setScrollOffset] = createSignal(0)

  const visibleHeight = () => Math.max(3, (process.stdout.rows ?? 30) - 5)

  const trace = createMemo(() => {
    if (route.data.type !== "trace-flamegraph") return undefined
    return traces.byId(route.data.traceId)
  })

  const svcColors = createMemo(() => {
    const t = trace()
    if (!t) return new Map<string, string>()
    return serviceColorMap(t.services)
  })

  const graphWidth = createMemo(() => Math.max(1, (process.stdout.columns ?? 120) - 2))

  const rulerWidth = createMemo(() => {
    const cols = process.stdout.columns ?? 120
    const labelWidth = 13
    return Math.max(8, cols - labelWidth * 2 - 4)
  })

  const layoutRows = createMemo(() => {
    const t = trace()
    if (!t) return []
    return buildLayout(t.tree, t.durationMs, t.startTimeNano, graphWidth())
  })

  const flatBlocks = createMemo(() => {
    const result: LayoutBlock[] = []
    for (const row of layoutRows()) {
      for (const block of row.blocks) {
        result.push(block)
      }
    }
    return result
  })

  const rowStartIndices = createMemo(() => {
    const starts: number[] = []
    let offset = 0
    for (const row of layoutRows()) {
      starts.push(offset)
      offset += row.blocks.length
    }
    return starts
  })

  const clampCursor = (next: number) => Math.max(0, Math.min(next, flatBlocks().length - 1))

  const selectedBlock = createMemo(() => flatBlocks()[clampCursor(cursor())])

  const barColor = (span: ParsedSpan) => {
    if (span.status === "ERROR") return theme.error
    return svcColors().get(span.serviceName) ?? theme.duration
  }

  const syncCursor = (next: number) => {
    if (flatBlocks().length === 0) {
      setCursor(0)
      setScrollOffset(0)
      return
    }

    const clamped = clampCursor(next)
    setCursor(clamped)

    const rowIndex = flatBlocks()[clamped]?.rowIndex ?? 0
    if (rowIndex < scrollOffset()) {
      setScrollOffset(rowIndex)
    } else if (rowIndex >= scrollOffset() + visibleHeight()) {
      setScrollOffset(rowIndex - visibleHeight() + 1)
    }
  }

  const moveWithinRow = (delta: number) => {
    const current = selectedBlock()
    if (!current) return

    const row = layoutRows()[current.rowIndex]
    if (!row || row.blocks.length === 0) return

    const nextIndex = Math.max(0, Math.min(current.indexInRow + delta, row.blocks.length - 1))
    syncCursor((rowStartIndices()[current.rowIndex] ?? 0) + nextIndex)
  }

  useKeyboard((key) => {
    if (route.data.type !== "trace-flamegraph") return

    if (key.name === "j" || key.name === "down") {
      syncCursor(cursor() + 1)
    }
    if (key.name === "k" || key.name === "up") {
      syncCursor(cursor() - 1)
    }
    if (!key.shift && !key.ctrl && key.name === "l") {
      moveWithinRow(1)
    }
    if (!key.shift && !key.ctrl && key.name === "h") {
      moveWithinRow(-1)
    }
    if (key.shift && key.name === "g") {
      syncCursor(Math.max(0, flatBlocks().length - 1))
    } else if (key.name === "g") {
      syncCursor(0)
    }
    if (key.name === "escape") {
      route.back()
    }
    if (key.name === "q") {
      process.exit(0)
    }
  })

  const visibleRows = createMemo(() => {
    const rows = layoutRows()
    const start = scrollOffset()
    const end = start + visibleHeight()
    return rows.slice(start, end)
  })

  const infoLine = createMemo(() => {
    const selected = selectedBlock()
    if (!selected) return "No spans"
    const value = `${selected.span.name} · ${selected.span.serviceName} · ${formatDuration(selected.span.durationMs)} · ${cursor() + 1}/${flatBlocks().length}`
    return truncate(value, Math.max(1, graphWidth()))
  })

  return (
    <box flexDirection="column" flexGrow={1} width="100%">
      <box
        width="100%"
        height={1}
        backgroundColor={theme.header}
        flexDirection="row"
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={theme.headerFg}>
          Flamegraph {trace() ? shortId(trace()!.traceId, 16) : "?"} - {trace()?.spanCount ?? 0} spans - {formatDuration(trace()?.durationMs ?? 0)}
        </text>
      </box>

      <box
        width="100%"
        height={1}
        backgroundColor={theme.rulerBg}
        flexDirection="row"
        paddingLeft={1}
      >
        <box width={13}>
          <text fg={theme.dim}>{trace() ? formatTimeShort(trace()!.startTimeNano) : "--:--:--.---"}</text>
        </box>
        <box width={rulerWidth()}>
          <text fg={theme.rulerFg}>{formatTimeRuler(trace()?.durationMs ?? 0, rulerWidth())}</text>
        </box>
        <box flexGrow={1}>
          <text fg={theme.dim}>{trace() ? formatTimeShort(trace()!.endTimeNano) : "--:--:--.---"}</text>
        </box>
      </box>

      <box flexDirection="column" flexGrow={1} width="100%">
        <For each={visibleRows()}>
          {(row) => {
            const selected = selectedBlock()
            const segments = () => buildRowSegments(row, graphWidth(), selected?.rowIndex === row.depth ? selected.indexInRow : -1)

            return (
              <box
                width="100%"
                height={1}
                flexDirection="row"
                backgroundColor={selected?.rowIndex === row.depth ? theme.selected : theme.normal}
                paddingLeft={1}
              >
                <For each={segments()}>
                  {(segment) => (
                    <box width={segment.width}>
                      <text fg={segment.span ? barColor(segment.span) : segment.color}>
                        {segment.type === "block"
                          ? (segment.selected ? "▓" : "█").repeat(FILL)
                          : "─".repeat(FILL)}
                      </text>
                    </box>
                  )}
                </For>
              </box>
            )
          }}
        </For>
      </box>

      <box width="100%" height={1} backgroundColor={theme.header} paddingLeft={1}>
        <text fg={selectedBlock() ? barColor(selectedBlock()!.span) : theme.dim}>{infoLine()}</text>
      </box>
    </box>
  )
}
