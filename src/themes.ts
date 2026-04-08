export interface ThemeColors {
  bg: string
  bgAlt: string
  bgHighlight: string
  fg: string
  fgDim: string
  border: string
  accent: string
  accent2: string
  accent3: string
  success: string
  warning: string
  error: string
  headerBg: string
  headerFg: string
  barFill: string
}

export interface Theme {
  name: string
  id: string
  colors: ThemeColors
  servicePalette: string[]
}

const tokyoNight: Theme = {
  name: "Tokyo Night",
  id: "tokyo-night",
  colors: {
    bg: "#1a1b26",
    bgAlt: "#24283b",
    bgHighlight: "#292e42",
    fg: "#c0caf5",
    fgDim: "#565f89",
    border: "#3b4261",
    accent: "#7aa2f7",
    accent2: "#bb9af7",
    accent3: "#7dcfff",
    success: "#9ece6a",
    warning: "#e0af68",
    error: "#f7768e",
    headerBg: "#1a1b26",
    headerFg: "#c0caf5",
    barFill: "#24283b",
  },
  servicePalette: [
    "#7aa2f7",
    "#bb9af7",
    "#7dcfff",
    "#9ece6a",
    "#e0af68",
    "#f7768e",
    "#2ac3de",
    "#ff9e64",
    "#73daca",
    "#cfc9c2",
  ],
}

const solarizedLight: Theme = {
  name: "Solarized Light",
  id: "solarized-light",
  colors: {
    bg: "#fdf6e3",
    bgAlt: "#eee8d5",
    bgHighlight: "#e4ddd0",
    fg: "#657b83",
    fgDim: "#93a1a1",
    border: "#d3cbbe",
    accent: "#268bd2",
    accent2: "#6c71c4",
    accent3: "#2aa198",
    success: "#859900",
    warning: "#b58900",
    error: "#dc322f",
    headerBg: "#eee8d5",
    headerFg: "#586e75",
    barFill: "#eee8d5",
  },
  servicePalette: [
    "#268bd2",
    "#2aa198",
    "#859900",
    "#b58900",
    "#cb4b16",
    "#dc322f",
    "#6c71c4",
    "#d33682",
    "#657b83",
    "#586e75",
  ],
}

const catppuccinMocha: Theme = {
  name: "Catppuccin Mocha",
  id: "catppuccin-mocha",
  colors: {
    bg: "#1e1e2e",
    bgAlt: "#181825",
    bgHighlight: "#313244",
    fg: "#cdd6f4",
    fgDim: "#6c7086",
    border: "#45475a",
    accent: "#89b4fa",
    accent2: "#cba6f7",
    accent3: "#89dceb",
    success: "#a6e3a1",
    warning: "#f9e2af",
    error: "#f38ba8",
    headerBg: "#1e1e2e",
    headerFg: "#cdd6f4",
    barFill: "#181825",
  },
  servicePalette: [
    "#89b4fa",
    "#cba6f7",
    "#89dceb",
    "#a6e3a1",
    "#f9e2af",
    "#f38ba8",
    "#94e2d5",
    "#fab387",
    "#a6adc8",
    "#f5c2e7",
  ],
}

const dracula: Theme = {
  name: "Dracula",
  id: "dracula",
  colors: {
    bg: "#282a36",
    bgAlt: "#1e1f29",
    bgHighlight: "#44475a",
    fg: "#f8f8f2",
    fgDim: "#6272a4",
    border: "#44475a",
    accent: "#bd93f9",
    accent2: "#ff79c6",
    accent3: "#8be9fd",
    success: "#50fa7b",
    warning: "#ffb86c",
    error: "#ff5555",
    headerBg: "#282a36",
    headerFg: "#f8f8f2",
    barFill: "#1e1f29",
  },
  servicePalette: [
    "#bd93f9",
    "#ff79c6",
    "#8be9fd",
    "#50fa7b",
    "#ffb86c",
    "#ff5555",
    "#f1fa8c",
    "#6272a4",
    "#ff6e6e",
    "#69ff47",
  ],
}

const nord: Theme = {
  name: "Nord",
  id: "nord",
  colors: {
    bg: "#2e3440",
    bgAlt: "#3b4252",
    bgHighlight: "#434c5e",
    fg: "#eceff4",
    fgDim: "#4c566a",
    border: "#434c5e",
    accent: "#81a1c1",
    accent2: "#b48ead",
    accent3: "#88c0d0",
    success: "#a3be8c",
    warning: "#ebcb8b",
    error: "#bf616a",
    headerBg: "#2e3440",
    headerFg: "#eceff4",
    barFill: "#3b4252",
  },
  servicePalette: [
    "#81a1c1",
    "#b48ead",
    "#88c0d0",
    "#a3be8c",
    "#ebcb8b",
    "#bf616a",
    "#5e81ac",
    "#d08770",
    "#8fbcbb",
    "#e5e9f0",
  ],
}

const gruvboxDark: Theme = {
  name: "Gruvbox Dark",
  id: "gruvbox-dark",
  colors: {
    bg: "#282828",
    bgAlt: "#1d2021",
    bgHighlight: "#3c3836",
    fg: "#ebdbb2",
    fgDim: "#928374",
    border: "#504945",
    accent: "#83a598",
    accent2: "#d3869b",
    accent3: "#8ec07c",
    success: "#b8bb26",
    warning: "#fabd2f",
    error: "#fb4934",
    headerBg: "#282828",
    headerFg: "#ebdbb2",
    barFill: "#1d2021",
  },
  servicePalette: [
    "#83a598",
    "#d3869b",
    "#8ec07c",
    "#b8bb26",
    "#fabd2f",
    "#fb4934",
    "#fe8019",
    "#b16286",
    "#689d6a",
    "#cc241d",
  ],
}

export const THEMES: Record<string, Theme> = {
  "tokyo-night": tokyoNight,
  "solarized-light": solarizedLight,
  "catppuccin-mocha": catppuccinMocha,
  dracula,
  nord,
  "gruvbox-dark": gruvboxDark,
}

export const DEFAULT_THEME_ID = "tokyo-night"
