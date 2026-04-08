import { readFileSync } from "fs"
import { resolve } from "path"
import { parseJsonl } from "./parser"
import { tui } from "./app"
import { generateHtml } from "./web"
import { readConfig } from "./config"
import { THEMES, DEFAULT_THEME_ID } from "./themes"

function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log("Usage: opentui-traces [--web] [--theme <name>] <traces.jsonl>")
    console.log("")
    console.log("OpenTUI Traces - OpenTelemetry JSONL Trace Viewer")
    console.log("")
    console.log("Arguments:")
    console.log("  <traces.jsonl>   Path to a JSONL file containing OTLP trace data")
    console.log("")
    console.log("Options:")
    console.log("  --web            Output a self-contained HTML report to stdout")
    console.log("  --theme <name>   Theme to use (tokyo-night, catppuccin-mocha, dracula, nord, gruvbox-dark)")
    console.log("")
    console.log("Navigation (TUI mode):")
    console.log("  j/k or arrows    Navigate up/down")
    console.log("  Enter            Open trace / span detail")
    console.log("  Esc              Go back")
    console.log("  /                Search")
    console.log("  f                Filter by service")
    console.log("  q                Quit")
    process.exit(args[0] === "--help" || args[0] === "-h" ? 0 : 1)
  }

  const webMode = args.includes("--web")
  const themeArg = (() => {
    const idx = args.indexOf("--theme")
    return idx !== -1 ? args[idx + 1] : undefined
  })()
  const fileArgs = args.filter((a, i) => a !== "--web" && a !== "--theme" && args[i - 1] !== "--theme")
  const configTheme = readConfig().theme
  const resolvedThemeId = (themeArg && themeArg in THEMES ? themeArg : undefined)
    ?? (configTheme && configTheme in THEMES ? configTheme : undefined)
    ?? DEFAULT_THEME_ID

  if (fileArgs.length === 0) {
    console.error("Error: no input file specified.")
    console.error("Usage: opentui-traces [--web] [--theme <name>] <traces.jsonl>")
    process.exit(1)
  }

  const filePath = resolve(fileArgs[0]!)

  let content: string
  try {
    content = readFileSync(filePath, "utf-8")
  } catch (err: any) {
    console.error(`Error reading file: ${filePath}`)
    console.error(err.message)
    process.exit(1)
  }

  const traces = parseJsonl(content)

  if (traces.length === 0) {
    console.error("No traces found in the file.")
    process.exit(1)
  }

  if (webMode) {
    process.stdout.write(generateHtml(traces, resolvedThemeId))
    return
  }

  console.log(`Loaded ${traces.length} traces with ${traces.reduce((sum, t) => sum + t.spanCount, 0)} total spans`)

  tui(traces, resolvedThemeId)
}

main()
