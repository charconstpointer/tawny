import { createSignal, createEffect, For } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { useTheme } from "../context/theme"
import { writeConfig } from "../config"

export function ThemePicker() {
  const theme = useTheme()
  const [cursor, setCursor] = createSignal(0)
  const [originalThemeId, setOriginalThemeId] = createSignal(theme.id)

  const themes = () => theme.allThemes

  const clampCursor = (c: number) => Math.max(0, Math.min(c, themes().length - 1))

  createEffect(() => {
    if (theme.showThemePicker) {
      setOriginalThemeId(theme.id)
      const idx = themes().findIndex(th => th.id === theme.id)
      setCursor(idx >= 0 ? idx : 0)
    }
  })

  useKeyboard((key) => {
    if (!theme.showThemePicker) return

    if (key.name === "j" || key.name === "down") {
      const next = clampCursor(cursor() + 1)
      setCursor(next)
      theme.setTheme(themes()[next]?.id ?? theme.id)
    }
    if (key.name === "k" || key.name === "up") {
      const next = clampCursor(cursor() - 1)
      setCursor(next)
      theme.setTheme(themes()[next]?.id ?? theme.id)
    }
    if (key.shift && key.name === "g") {
      const last = themes().length - 1
      setCursor(last)
      theme.setTheme(themes()[last]?.id ?? theme.id)
    } else if (key.name === "g") {
      setCursor(0)
      theme.setTheme(themes()[0]?.id ?? theme.id)
    }
    if (key.name === "return") {
      const selectedId = themes()[cursor()]?.id ?? theme.id
      theme.setTheme(selectedId)
      writeConfig({ theme: selectedId })
      theme.closeThemePicker()
    }
    if (key.name === "escape") {
      theme.setTheme(originalThemeId())
      theme.closeThemePicker()
    }
  })

  return (
    <box
      position="absolute"
      width={40}
      height={themes().length + 4}
      left="50%"
      top="50%"
      marginLeft={-20}
      marginTop={-5}
      borderStyle="rounded"
      border
      borderColor={theme.colors.border}
      backgroundColor={theme.colors.bgAlt}
      flexDirection="column"
      padding={1}
      title="Select Theme"
      titleAlignment="center"
    >
      <For each={themes()}>
        {(th, i) => {
          const isSelected = () => cursor() === i()
          const isActive = () => theme.id === th.id

          return (
            <box
              width="100%"
              height={1}
              flexDirection="row"
              backgroundColor={isSelected() ? theme.colors.bgHighlight : "transparent"}
              paddingLeft={1}
            >
              <text fg={isActive() ? theme.colors.success : theme.colors.fgDim}>
                {isActive() ? "[\u2713] " : "[ ] "}
              </text>
              <text fg={theme.colors.fg}>{th.name}</text>
            </box>
          )
        }}
      </For>

      <box width="100%" height={1} paddingLeft={1} marginTop={1}>
        <text fg={theme.colors.fgDim}>Enter: confirm | Esc: cancel</text>
      </box>
    </box>
  )
}
