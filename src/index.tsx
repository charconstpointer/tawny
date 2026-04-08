import { existsSync, readFileSync } from "fs"
import { resolve } from "path"
import { parseJsonl } from "./parser"
import { tui } from "./app"
import { generateHtml } from "./web"
import { readConfig } from "./config"
import { THEMES, DEFAULT_THEME_ID } from "./themes"

declare class URL {
  constructor(input: string, base?: string)
  readonly hostname: string
  readonly port: string
  readonly protocol: string
  readonly username: string
  readonly password: string
  readonly pathname: string
  readonly search: string
  readonly hash: string
}

declare class Response {
  constructor(body?: string, init?: { status?: number, headers?: Record<string, string> })
}

declare const Bun: {
  serve(options: {
    hostname: string
    port: number
    fetch(req: { url: string }): Response
  }): {
    url: string
  }
}

const DEFAULT_SERVE_ADDRESS = "127.0.0.1:3000"

function printUsage() {
  console.log("Usage: opentui-traces [--web | --serve [address]] [--theme <name>] <traces.jsonl>")
  console.log("")
  console.log("OpenTUI Traces - OpenTelemetry JSONL Trace Viewer")
  console.log("")
  console.log("Arguments:")
  console.log("  <traces.jsonl>   Path to a JSONL file containing OTLP trace data")
  console.log("")
  console.log("Options:")
  console.log("  --web            Output a self-contained HTML report to stdout")
  console.log(`  --serve [addr]   Serve the HTML report over HTTP (default: ${DEFAULT_SERVE_ADDRESS})`)
  console.log("                   Address format: host[:port] or http://host[:port]")
  console.log("  --theme <name>   Theme to use (tokyo-night, catppuccin-mocha, dracula, nord, gruvbox-dark)")
  console.log("")
  console.log("Navigation (TUI mode):")
  console.log("  j/k or arrows    Navigate up/down")
  console.log("  Enter            Open trace / span detail")
  console.log("  Esc              Go back")
  console.log("  /                Search")
  console.log("  f                Filter by service")
  console.log("  q                Quit")
}

function parseServeAddress(address: string) {
  let url: URL

  try {
    url = new URL(address.includes("://") ? address : `http://${address}`)
  } catch {
    throw new Error(`Invalid serve address: ${address}`)
  }

  if (url.protocol !== "http:") {
    throw new Error(`Invalid serve address: ${address}`)
  }

  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`Invalid serve address: ${address}`)
  }

  const hostname = url.hostname
  const port = url.port ? Number(url.port) : 3000

  if (!hostname) {
    throw new Error(`Invalid serve address: ${address}`)
  }

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid serve address: ${address}`)
  }

  return {
    hostname,
    port,
  }
}

function printNoTracesError(content: string) {
  const trimmed = content.trimStart().toLowerCase()

  if (trimmed.startsWith("<!doctype html") || trimmed.startsWith("<html")) {
    console.error("Input appears to be an exported HTML report, not OTLP JSONL trace data.")
    console.error("Use the original trace JSONL file with `--serve` or open the HTML report directly in a browser.")
    return
  }

  console.error("No traces found in the file.")
}

function printServeUsageError() {
  console.error("Error: expected `--serve [address] <traces.jsonl>`.")
  printUsage()
}

function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printUsage()
    process.exit(args[0] === "--help" || args[0] === "-h" ? 0 : 1)
  }

  let webMode = false
  let serveMode = false
  let themeArg: string | undefined
  const consumedIndexes = new Set<number>()

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === "--web") {
      webMode = true
      consumedIndexes.add(i)
      continue
    }

    if (arg === "--serve") {
      serveMode = true
      consumedIndexes.add(i)
      continue
    }

    if (arg === "--theme") {
      const nextArg = args[i + 1]
      if (!nextArg || nextArg.startsWith("--")) {
        console.error("Error: --theme requires a theme name.")
        printUsage()
        process.exit(1)
      }

      consumedIndexes.add(i)
      themeArg = nextArg
      if (nextArg !== undefined) {
        consumedIndexes.add(i + 1)
        i += 1
      }
      continue
    }

    if (arg.startsWith("--")) {
      console.error(`Error: unknown option ${arg}`)
      printUsage()
      process.exit(1)
    }
  }

  const positionalArgs = args.filter((arg, index) => !arg.startsWith("--") && !consumedIndexes.has(index))

  if (webMode && serveMode) {
    console.error("Error: --web and --serve cannot be used together.")
    printUsage()
    process.exit(1)
  }

  let serveAddress = DEFAULT_SERVE_ADDRESS
  let fileArg: string | undefined

  if (serveMode) {
    if (positionalArgs.length === 1) {
      fileArg = positionalArgs[0]
    } else if (positionalArgs.length === 2) {
      if (existsSync(resolve(positionalArgs[0]!))) {
        printServeUsageError()
        process.exit(1)
      }

      try {
        parseServeAddress(positionalArgs[0]!)
      } catch {
        printServeUsageError()
        process.exit(1)
      }

      serveAddress = positionalArgs[0]!
      fileArg = positionalArgs[1]
    } else if (positionalArgs.length === 0) {
      console.error("Error: no input file specified.")
      printUsage()
      process.exit(1)
    } else {
      printServeUsageError()
      process.exit(1)
    }
  } else {
    if (positionalArgs.length === 0) {
      console.error("Error: no input file specified.")
      printUsage()
      process.exit(1)
    }

    if (positionalArgs.length > 1) {
      console.error("Error: expected a single input file.")
      printUsage()
      process.exit(1)
    }

    fileArg = positionalArgs[0]
  }

  const configTheme = readConfig().theme
  const resolvedThemeId = (themeArg && themeArg in THEMES ? themeArg : undefined)
    ?? (configTheme && configTheme in THEMES ? configTheme : undefined)
    ?? DEFAULT_THEME_ID

  const filePath = resolve(fileArg!)

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
    printNoTracesError(content)
    process.exit(1)
  }

  if (webMode) {
    process.stdout.write(generateHtml(traces, resolvedThemeId))
    return
  }

  if (serveMode) {
    let parsedAddress: ReturnType<typeof parseServeAddress>

    try {
      parsedAddress = parseServeAddress(serveAddress)
    } catch (err: any) {
      console.error(err.message)
      process.exit(1)
    }

    const html = generateHtml(traces, resolvedThemeId)
    let server: { url: string }

    try {
      server = Bun.serve({
        hostname: parsedAddress.hostname,
        port: parsedAddress.port,
        fetch(req) {
          const { pathname } = new URL(req.url)

          if (pathname !== "/" && pathname !== "/index.html") {
            return new Response("Not found", { status: 404 })
          }

          return new Response(html, {
            headers: {
              "Content-Type": "text/html; charset=utf-8",
            },
          })
        },
      })
    } catch (err: any) {
      console.error(`Failed to start server on ${parsedAddress.hostname}:${parsedAddress.port}`)
      console.error(err.message)
      process.exit(1)
    }

    console.log(`Serving report at ${server.url}`)
    return
  }

  console.log(`Loaded ${traces.length} traces with ${traces.reduce((sum, t) => sum + t.spanCount, 0)} total spans`)

  tui(traces, resolvedThemeId)
}

main()
