import { createSignal, For } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { useRoute } from "../context/route"
import { useTraces } from "../context/traces"
import { useFilter } from "../context/filter"

const theme = {
  bg: "#24283b",
  border: "#3b4261",
  header: "#c0caf5",
  selected: "#292e42",
  normal: "#1a1b26",
  service: "#7dcfff",
  check: "#9ece6a",
  uncheck: "#565f89",
  dim: "#565f89",
}

export function ServiceFilter() {
  const filter = useFilter()
  const traces = useTraces()
  const route = useRoute()
  const [cursor, setCursor] = createSignal(0)

  const services = () => traces.allServices

  const clampCursor = (c: number) => Math.max(0, Math.min(c, services().length))

  useKeyboard((key) => {
    if (!filter.showServiceFilter) return
    if (route.data.type !== "trace-list") return

    if (key.name === "j" || key.name === "down") {
      setCursor((c) => clampCursor(c + 1))
    }
    if (key.name === "k" || key.name === "up") {
      setCursor((c) => clampCursor(c - 1))
    }
    // g / G — go to top / bottom
    if (key.shift && key.name === "g") {
      setCursor(services().length)
    } else if (key.name === "g") {
      setCursor(0)
    }
    if (key.name === "return" || key.name === "space") {
      const idx = cursor()
      if (idx === 0) {
        // "All" option
        filter.clearServices()
      } else {
        const svc = services()[idx - 1]
        if (svc) filter.toggleService(svc)
      }
    }
    if (key.name === "escape" || key.name === "f") {
      filter.closeServiceFilter()
    }
  })

  return (
    <box
      position="absolute"
      width={50}
      height={Math.min(services().length + 4, 20)}
      left="50%-25"
      top="50%-10"
      borderStyle="rounded"
      border
      borderColor={theme.border}
      backgroundColor={theme.bg}
      flexDirection="column"
      padding={1}
      title="Filter by Service"
      titleAlignment="center"
    >
      {/* All option */}
      <box
        width="100%"
        height={1}
        flexDirection="row"
        backgroundColor={cursor() === 0 ? theme.selected : "transparent"}
        paddingLeft={1}
      >
        <text fg={filter.selectedServices.size === 0 ? theme.check : theme.uncheck}>
          {filter.selectedServices.size === 0 ? "[\u2713] " : "[ ] "}
        </text>
        <text fg={theme.header}>All Services</text>
      </box>

      <For each={services()}>
        {(svc, i) => {
          const idx = () => i() + 1
          const isActive = () => filter.selectedServices.has(svc)
          const isSelected = () => cursor() === idx()

          return (
            <box
              width="100%"
              height={1}
              flexDirection="row"
              backgroundColor={isSelected() ? theme.selected : "transparent"}
              paddingLeft={1}
            >
              <text fg={isActive() ? theme.check : theme.uncheck}>
                {isActive() ? "[\u2713] " : "[ ] "}
              </text>
              <text fg={theme.service}>{svc}</text>
            </box>
          )
        }}
      </For>

      <box width="100%" height={1} paddingLeft={1} marginTop={1}>
        <text fg={theme.dim}>Enter: toggle | Esc/f: close</text>
      </box>
    </box>
  )
}
