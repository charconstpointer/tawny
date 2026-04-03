import { readFileSync } from "fs"
import { resolve } from "path"
import { parseJsonl } from "./parser"
import { tui } from "./app"

function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log("Usage: bun run src/index.tsx <traces.jsonl>")
    console.log("")
    console.log("OpenTUI Traces - OpenTelemetry JSONL Trace Viewer")
    console.log("")
    console.log("Arguments:")
    console.log("  <traces.jsonl>   Path to a JSONL file containing OTLP trace data")
    console.log("")
    console.log("Navigation:")
    console.log("  j/k or arrows    Navigate up/down")
    console.log("  Enter            Open trace / span detail")
    console.log("  Esc              Go back")
    console.log("  /                Search")
    console.log("  f                Filter by service")
    console.log("  q                Quit")
    process.exit(args[0] === "--help" || args[0] === "-h" ? 0 : 1)
  }

  const filePath = resolve(args[0]!)

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

  console.log(`Loaded ${traces.length} traces with ${traces.reduce((sum, t) => sum + t.spanCount, 0)} total spans`)

  tui(traces)
}

main()
