import { createSignal, For } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { useRoute } from "../context/route"
import { useTraces } from "../context/traces"
import { useFilter } from "../context/filter"
import { useTheme } from "../context/theme"

export function ServiceFilter() {
  const filter = useFilter()
  const traces = useTraces()
  const route = useRoute()
  const t = useTheme()
  const [cursor, setCursor] = createSignal(0)

  const services = () => traces.allServices

  const clampCursor = (c: number) => Math.max(0, Math.min(c, services().length))

  useKeyboard((key) => {
    if (t.showThemePicker) return
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
      left="50%"
      top="50%"
      marginLeft={-25}
      marginTop={-10}
      borderStyle="rounded"
      border
      borderColor={t.colors.border}
      backgroundColor={t.colors.bgAlt}
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
        backgroundColor={cursor() === 0 ? t.colors.bgHighlight : "transparent"}
        paddingLeft={1}
      >
        <text fg={filter.selectedServices.size === 0 ? t.colors.success : t.colors.fgDim}>
          {filter.selectedServices.size === 0 ? "[\u2713] " : "[ ] "}
        </text>
        <text fg={t.colors.fg}>All Services</text>
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
              backgroundColor={isSelected() ? t.colors.bgHighlight : "transparent"}
              paddingLeft={1}
            >
              <text fg={isActive() ? t.colors.success : t.colors.fgDim}>
                {isActive() ? "[\u2713] " : "[ ] "}
              </text>
              <text fg={t.colors.accent3}>{svc}</text>
            </box>
          )
        }}
      </For>

      <box width="100%" height={1} paddingLeft={1} marginTop={1}>
        <text fg={t.colors.fgDim}>Enter: toggle | Esc/f: close</text>
      </box>
    </box>
  )
}
