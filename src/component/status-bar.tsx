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
      base.push(["j/k", "navigate"], ["g/G", "top/bottom"], ["^d/^u", "page"], ["Enter/l", "open"], ["/", "search"], ["f", "filter"], ["n", "min spans"], ["q", "quit"])
    } else if (r.type === "trace-detail") {
      base.push(["j/k", "navigate"], ["g/G", "top/bottom"], ["^d/^u", "page"], ["Space", "fold"], ["Enter/l", "detail"], ["h", "back"], ["/", "search"], ["q", "quit"])
    } else if (r.type === "span-detail") {
      base.push(["j/k", "scroll"], ["g/G", "top/bottom"], ["^d/^u", "page"], ["h", "back"], ["q", "quit"])
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
