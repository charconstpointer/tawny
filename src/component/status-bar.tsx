import { useRoute } from "../context/route"

const theme = {
  key: "#7aa2f7",
  desc: "#565f89",
  sep: "#3b4261",
}

export function StatusBar() {
  const route = useRoute()

  const hints = () => {
    const base: [string, string][] = []
    const r = route.data

    if (r.type === "trace-list") {
      base.push(["j/k", "navigate"], ["Enter", "open trace"], ["/", "search"], ["f", "filter services"], ["q", "quit"])
    } else if (r.type === "trace-detail") {
      base.push(["j/k", "navigate"], ["Space", "expand/collapse"], ["Enter", "span detail"], ["Esc", "back"], ["/", "search"], ["q", "quit"])
    } else if (r.type === "span-detail") {
      base.push(["j/k", "scroll"], ["Esc", "back"], ["q", "quit"])
    }

    return base
  }

  return (
    <box
      width="100%"
      height={1}
      flexDirection="row"
      backgroundColor="#1a1b26"
    >
      {hints().map(([key, desc], i) => (
        <box flexDirection="row">
          {i > 0 && (
            <text fg={theme.sep}> | </text>
          )}
          <text fg={theme.key}>
            {` ${key} `}
          </text>
          <text fg={theme.desc}>{desc}</text>
        </box>
      ))}
    </box>
  )
}
