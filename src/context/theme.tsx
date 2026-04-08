import { createSignal } from "solid-js"
import { createSimpleContext } from "./helper"
import { THEMES, DEFAULT_THEME_ID } from "../themes"
import type { Theme, ThemeColors } from "../themes"

export const { use: useTheme, provider: ThemeProvider } = createSimpleContext({
  name: "Theme",
  init: () => {
    const [themeId, setThemeId] = createSignal(DEFAULT_THEME_ID)
    const [showThemePicker, setShowThemePicker] = createSignal(false)

    return {
      get colors(): ThemeColors {
        return (THEMES[themeId()] ?? THEMES[DEFAULT_THEME_ID]!).colors
      },
      get servicePalette(): string[] {
        return (THEMES[themeId()] ?? THEMES[DEFAULT_THEME_ID]!).servicePalette
      },
      get id(): string {
        return themeId()
      },
      get name(): string {
        return (THEMES[themeId()] ?? THEMES[DEFAULT_THEME_ID]!).name
      },
      get allThemes(): Theme[] {
        return Object.values(THEMES)
      },
      setTheme(id: string) {
        setThemeId(id in THEMES ? id : DEFAULT_THEME_ID)
      },
      get showThemePicker(): boolean {
        return showThemePicker()
      },
      toggleThemePicker() {
        setShowThemePicker((v) => !v)
      },
      closeThemePicker() {
        setShowThemePicker(false)
      },
      openThemePicker() {
        setShowThemePicker(true)
      },
    }
  },
})
