export function shortId(id: string, len = 8): string {
  return id.slice(0, len)
}

export function formatDuration(ms: number): string {
  if (ms < 0.001) return `${(ms * 1_000_000).toFixed(0)}ns`
  if (ms < 1) return `${(ms * 1_000).toFixed(0)}us`
  if (ms < 1_000) return `${ms.toFixed(2)}ms`
  if (ms < 60_000) return `${(ms / 1_000).toFixed(2)}s`
  const mins = Math.floor(ms / 60_000)
  const secs = ((ms % 60_000) / 1_000).toFixed(1)
  return `${mins}m${secs}s`
}

export function formatTimestamp(nano: bigint): string {
  const ms = Number(nano / 1_000_000n)
  const d = new Date(ms)
  return d.toISOString().replace("T", " ").replace("Z", "")
}

export function formatTimeShort(nano: bigint): string {
  const ms = Number(nano / 1_000_000n)
  const d = new Date(ms)
  const h = d.getHours().toString().padStart(2, "0")
  const m = d.getMinutes().toString().padStart(2, "0")
  const s = d.getSeconds().toString().padStart(2, "0")
  const mil = d.getMilliseconds().toString().padStart(3, "0")
  return `${h}:${m}:${s}.${mil}`
}

export function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s
  return s.slice(0, maxLen - 1) + "\u2026"
}

export function durationBar(fraction: number, width: number): string {
  const filled = Math.max(0, Math.min(width, Math.round(fraction * width)))
  return "\u2588".repeat(filled) + "\u2591".repeat(width - filled)
}

export function padRight(s: string, len: number): string {
  if (s.length >= len) return s.slice(0, len)
  return s + " ".repeat(len - s.length)
}

export function padLeft(s: string, len: number): string {
  if (s.length >= len) return s.slice(0, len)
  return " ".repeat(len - s.length) + s
}

// --- Waterfall utilities ---

const SERVICE_COLORS = [
  "#7dcfff", // cyan
  "#bb9af7", // purple
  "#7aa2f7", // blue
  "#9ece6a", // green
  "#e0af68", // yellow
  "#ff9e64", // orange
  "#f7768e", // pink/red
  "#2ac3de", // teal
  "#b4f9f8", // light cyan
  "#c0caf5", // lavender
]

/**
 * Assigns a distinct color to each service name from a fixed palette.
 * Returns a Map<serviceName, hexColor>.
 */
export function serviceColorMap(services: string[]): Map<string, string> {
  const sorted = [...services].sort()
  const map = new Map<string, string>()
  for (let i = 0; i < sorted.length; i++) {
    map.set(sorted[i], SERVICE_COLORS[i % SERVICE_COLORS.length])
  }
  return map
}

/**
 * Pick a "nice" tick interval for a time ruler given a total duration in ms
 * and a desired number of ticks (~4-6).
 */
function niceInterval(durationMs: number): number {
  const rough = durationMs / 5
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const residual = rough / mag
  let nice: number
  if (residual <= 1) nice = 1
  else if (residual <= 2) nice = 2
  else if (residual <= 5) nice = 5
  else nice = 10
  return nice * mag
}

/**
 * Builds a time ruler string of exactly `width` characters, with tick marks
 * and labels at nice intervals. Returns the string.
 *
 * Example (width=40, durationMs=200):
 *   |0ms       |50ms      |100ms     |150ms     |200ms
 */
export function formatTimeRuler(durationMs: number, width: number): string {
  if (width < 10 || durationMs <= 0) return " ".repeat(width)

  const interval = niceInterval(durationMs)
  const chars = new Array(width).fill(" ")

  for (let t = 0; t <= durationMs; t += interval) {
    const pos = Math.round((t / durationMs) * (width - 1))
    if (pos >= width) break
    const label = formatDuration(t)
    const tag = `|${label}`
    // Write the tag into the char array if it fits
    if (pos + tag.length <= width) {
      for (let j = 0; j < tag.length; j++) {
        chars[pos + j] = tag[j]
      }
    } else if (pos < width) {
      // At least place the tick mark
      chars[pos] = "|"
    }
  }

  return chars.join("")
}
