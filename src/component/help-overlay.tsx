import { For, createMemo } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { useRoute } from "../context/route"
import { useTheme } from "../context/theme"
import { useFilter } from "../context/filter"

type HelpSection = {
  title: string
  items: [string, string][]
}

export function HelpOverlay() {
  const route = useRoute()
  const t = useTheme()
  const filter = useFilter()

  const sections = createMemo<HelpSection[]>(() => {
    const base: HelpSection[] = [
      {
        title: "Global",
        items: [["q", "quit"], ["t", "theme"], ["?", "help"]],
      },
    ]

    if (route.data.type === "trace-list") {
      base.push({
        title: "Trace List",
        items: [["j/k", "navigate"], ["Enter", "open"], ["/", "search"], ["f", "service filter"], ["n", "min spans"], ["s", "sort"], ["e", "errors only"], ["d", "min duration"], ["i", "insights"]],
      })
    } else if (route.data.type === "trace-detail") {
      base.push({
        title: "Trace Detail",
        items: [["j/k", "navigate"], ["Space", "fold"], ["n/N", "next/prev match"], ["Enter", "span detail"], ["h/Esc", "back"], ["/", "search"], ["f", "flamegraph"], ["c", "critical path"]],
      })
    } else if (route.data.type === "span-detail") {
      base.push({
        title: "Span Detail",
        items: [["j/k", "scroll"], ["h/Esc", "back"]],
      })
    } else if (route.data.type === "insights") {
      base.push({
        title: "Insights",
        items: [["j/k", "navigate"], ["h/l", "section"], ["Enter", "open trace"], ["Esc", "back"]],
      })
    } else if (route.data.type === "trace-flamegraph") {
      base.push({
        title: "Trace Flamegraph",
        items: [["m", "mode"], ["Enter", "zoom"], ["Esc", "back"], ["j/k", "nav"], ["h/l", "left/right"], ["g/G", "top/bottom"]],
      })
    }

    return base
  })

  useKeyboard((key) => {
    if (!filter.showHelp) return

    if (key.name === "escape" || key.name === "?") {
      filter.toggleHelp()
    }
  })

  return (
    <box
      position="absolute"
      width={72}
      height={Math.min(20, sections().reduce((total, section) => total + section.items.length + 2, 2))}
      left="50%"
      top="50%"
      marginLeft={-36}
      marginTop={-10}
      borderStyle="rounded"
      border
      borderColor={t.colors.border}
      backgroundColor={t.colors.bgAlt}
      flexDirection="column"
      padding={1}
      title="Keyboard Shortcuts"
      titleAlignment="center"
    >
      <For each={sections()}>
        {(section) => (
          <box flexDirection="column" width="100%" marginBottom={1}>
            <text fg={t.colors.accent}>{section.title}</text>
            <For each={section.items}>
              {(item) => (
                <box width="100%" flexDirection="row">
                  <text fg={t.colors.accent}>  {item[0]}</text>
                  <text fg={t.colors.fgDim}> — {item[1]}</text>
                </box>
              )}
            </For>
          </box>
        )}
      </For>
      <box width="100%" marginTop={1}>
        <text fg={t.colors.fgDim}>Esc or ? to close</text>
      </box>
    </box>
  )
}
