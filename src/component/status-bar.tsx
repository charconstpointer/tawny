import { useRoute } from "../context/route"
import { useTheme } from "../context/theme"

export function StatusBar() {
  const route = useRoute()
  const t = useTheme()

  const hints = () => {
    const base: [string, string][] = []
    const r = route.data

    if (r.type === "trace-list") {
      base.push(["j/k", "navigate"], ["g/G", "top/bottom"], ["^d/^u", "page"], ["Enter/l", "open"], ["/", "search"], ["f", "filter"], ["n", "min spans"], ["t", "theme"], ["q", "quit"])
    } else if (r.type === "trace-detail") {
      base.push(["j/k", "navigate"], ["g/G", "top/bottom"], ["^d/^u", "page"], ["Space", "fold"], ["Enter/l", "detail"], ["h", "back"], ["/", "search"], ["f", "flamegraph"], ["t", "theme"], ["q", "quit"])
    } else if (r.type === "span-detail") {
      base.push(["j/k", "scroll"], ["g/G", "top/bottom"], ["^d/^u", "page"], ["h", "back"], ["t", "theme"], ["q", "quit"])
    } else if (r.type === "trace-flamegraph") {
      base.push(["m", "mode"], ["Enter", "zoom"], ["Esc", "back"], ["j/k", "nav"], ["h/l", "left/right"], ["t", "theme"], ["g/G", "top/bottom"])
    }

    return base
  }

  return (
    <box
      width="100%"
      height={1}
      flexDirection="row"
      backgroundColor={t.colors.bg}
    >
      {hints().map(([key, desc], i) => (
        <box flexDirection="row">
          {i > 0 && (
            <text fg={t.colors.border}> | </text>
          )}
          <text fg={t.colors.accent}>
            {` ${key} `}
          </text>
          <text fg={t.colors.fgDim}>{desc}</text>
        </box>
      ))}
    </box>
  )
}
