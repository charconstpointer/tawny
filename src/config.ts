import os from "node:os"
import { readFileSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

export function getConfigPath(): string {
  const base = process.env["XDG_CONFIG_HOME"] ?? join(os.homedir(), ".config")
  return join(base, "tawny", "config.json")
}

export function readConfig(): { theme?: string } {
  try {
    const raw = readFileSync(getConfigPath(), "utf-8")
    return JSON.parse(raw) as { theme?: string }
  } catch {
    return {}
  }
}

export function writeConfig(config: { theme: string }): void {
  try {
    const path = getConfigPath()
    const dir = path.substring(0, path.lastIndexOf("/"))
    mkdirSync(dir, { recursive: true })
    writeFileSync(path, JSON.stringify(config, null, 2))
  } catch {
    // fail silently
  }
}
