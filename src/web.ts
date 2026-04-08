import { readFileSync } from "fs"
import { resolve } from "path"
import type { TraceSummary, ParsedSpan, ParsedEvent } from "./types"
import { THEMES, DEFAULT_THEME_ID } from "./themes"
import { summarizeTraces } from "./insights"

declare global {
  interface ImportMeta {
    readonly dir: string
  }
}

// --- Serializable types for embedding in HTML ---

interface WebEvent {
  timeMs: number
  name: string
  attributes: Record<string, string>
}

interface WebSpan {
  spanId: string
  parentSpanId: string | undefined
  name: string
  kind: string
  serviceName: string
  serviceVersion: string
  scopeName: string
  scopeVersion: string | undefined
  startTimeMs: number
  endTimeMs: number
  durationMs: number
  status: string
  statusMessage: string
  attributes: Record<string, string>
  events: WebEvent[]
  children: WebSpan[]
}

interface WebTrace {
  traceId: string
  services: string[]
  spanCount: number
  errorCount: number
  rootSpanName: string
  startTimeMs: number
  endTimeMs: number
  durationMs: number
  tree: WebSpan[]
}

// --- Converters ---

function convertEvent(e: ParsedEvent): WebEvent {
  return {
    timeMs: Number(e.timeNano / 1_000_000n),
    name: e.name,
    attributes: Object.fromEntries(e.attributes),
  }
}

function convertSpan(s: ParsedSpan): WebSpan {
  return {
    spanId: s.spanId,
    parentSpanId: s.parentSpanId,
    name: s.name,
    kind: s.kind,
    serviceName: s.serviceName,
    serviceVersion: s.serviceVersion,
    scopeName: s.scopeName,
    scopeVersion: s.scopeVersion,
    startTimeMs: Number(s.startTimeNano / 1_000_000n),
    endTimeMs: Number(s.endTimeNano / 1_000_000n),
    durationMs: s.durationMs,
    status: s.status,
    statusMessage: s.statusMessage,
    attributes: Object.fromEntries(s.attributes),
    events: s.events.map(convertEvent),
    children: s.children.map(convertSpan),
  }
}

function convertTrace(t: TraceSummary): WebTrace {
  return {
    traceId: t.traceId,
    services: t.services,
    spanCount: t.spanCount,
    errorCount: t.errorCount,
    rootSpanName: t.rootSpan?.name ?? "(multiple roots)",
    startTimeMs: Number(t.startTimeNano / 1_000_000n),
    endTimeMs: Number(t.endTimeNano / 1_000_000n),
    durationMs: t.durationMs,
    tree: t.tree.map(convertSpan),
  }
}

const logoBase64 = readFileSync(resolve(import.meta.dir, "../assets/logo.png")).toString("base64")

// --- HTML generation ---

function buildThemeDataJson(): string {
  const out: Record<string, { colors: Record<string, string>; servicePalette: string[] }> = {}
  for (const [id, theme] of Object.entries(THEMES)) {
    out[id] = {
      colors: {
        bg: theme.colors.bg,
        bgAlt: theme.colors.bgAlt,
        bgHighlight: theme.colors.bgHighlight,
        fg: theme.colors.fg,
        fgDim: theme.colors.fgDim,
        border: theme.colors.border,
        accent: theme.colors.accent,
        accent2: theme.colors.accent2,
        accent3: theme.colors.accent3,
        success: theme.colors.success,
        warning: theme.colors.warning,
        error: theme.colors.error,
        headerBg: theme.colors.headerBg,
        headerFg: theme.colors.headerFg,
        barFill: theme.colors.barFill,
      },
      servicePalette: theme.servicePalette,
    }
  }
  return JSON.stringify(out)
    .replace(/<\//g, "<\\/")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}

export function generateHtml(traces: TraceSummary[], themeId?: string): string {
  const theme = THEMES[themeId ?? DEFAULT_THEME_ID] ?? THEMES[DEFAULT_THEME_ID]
  const defaultThemeId = themeId ?? DEFAULT_THEME_ID
  const themeDataJson = buildThemeDataJson()
  const data = JSON.stringify(traces.map(convertTrace))
    .replace(/<\//g, "<\\/")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
  const insights = JSON.stringify(summarizeTraces(traces))
    .replace(/<\//g, "<\\/")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
  const reportBytes = JSON.stringify(Buffer.byteLength(data, "utf8"))
    .replace(/<\//g, "<\\/")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:;">
<title>Tawny &mdash; OpenTelemetry Traces</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:${theme.colors.bg};--surface:${theme.colors.bgAlt};--border:${theme.colors.border};
  --text:${theme.colors.fg};--text-dim:${theme.colors.fgDim};--text-bright:${theme.colors.fg};
  --accent:${theme.colors.accent};--error:${theme.colors.error};--ok:${theme.colors.success};--warn:${theme.colors.warning};
  --hover:${theme.colors.bgHighlight};--selected:${theme.colors.bgHighlight};
  font-family:"JetBrains Mono","Fira Code","SF Mono",Menlo,Consolas,monospace;
  font-size:13px;color:var(--text);background:var(--bg);
}
body{min-height:100vh;display:flex;flex-direction:column}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}

/* Header */
.header{background:var(--surface);border-bottom:1px solid var(--border);box-shadow:0 1px 4px rgba(0,0,0,0.2);padding:10px 20px;display:flex;align-items:center;gap:16px;flex-shrink:0}
.header img{display:block;flex-shrink:0}
.header h1{font-size:15px;font-weight:600;color:var(--text-bright)}
.header .subtitle{color:var(--text-dim);font-size:12px}
.header .stats{color:var(--text-dim);font-size:12px}
.header .stats.warn{color:var(--warn)}
.header .theme-select{margin-left:auto;background:var(--bg);border:1px solid var(--border);color:var(--text-dim);padding:4px 8px;border-radius:4px;font:inherit;font-size:12px;cursor:pointer;outline:none}
.header .theme-select:hover{border-color:var(--accent);color:var(--text)}
.header .theme-select:focus{border-color:var(--accent)}

/* Toolbar */
.toolbar{background:var(--surface);border-bottom:1px solid var(--border);padding:8px 20px;display:flex;align-items:center;gap:12px;flex-shrink:0}
.toolbar input[type=text]{background:var(--bg);border:1px solid var(--border);color:var(--text);padding:5px 10px;border-radius:4px;font:inherit;width:260px;outline:none}
.toolbar input[type=text]:focus{border-color:var(--accent)}
.toolbar input[type=text]::placeholder{color:var(--text-dim)}
.toolbar .filter-btn{background:var(--bg);border:1px solid var(--border);color:var(--text-dim);padding:5px 10px;border-radius:4px;font:inherit;cursor:pointer}
.toolbar .filter-btn:hover{border-color:var(--accent);color:var(--text)}
.toolbar .filter-btn.active{border-color:var(--accent);background:var(--accent);color:var(--bg)}
.toolbar .toolbar-spacer{flex:1}

/* Breadcrumb */
.breadcrumb{padding:8px 20px;font-size:12px;color:var(--text-dim);border-bottom:1px solid var(--border);flex-shrink:0}
.breadcrumb span{cursor:pointer;color:var(--accent)}
.breadcrumb span:hover{text-decoration:underline}

/* Main content */
.content{flex:1;overflow:auto}

/* Trace list table */
.trace-table{width:100%;border-collapse:collapse}
.trace-table th{position:sticky;top:0;background:var(--surface);text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-dim);border-bottom:1px solid var(--border);cursor:pointer;user-select:none;white-space:nowrap}
.trace-table th:hover{color:var(--text)}
.trace-table th .sort-arrow{margin-left:4px;font-size:10px}
.trace-table td{padding:6px 12px;border-bottom:1px solid var(--border);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:400px}
.trace-table tr.row{cursor:pointer}
.trace-table tr.row:hover{background:var(--hover)}
.trace-table tr.row.selected{background:var(--selected)}
.trace-table tr.row:nth-child(even){background:var(--surface)}
.trace-table .col-id{font-family:inherit;color:var(--text-dim);font-size:12px;max-width:100px}
.trace-table .col-root{color:var(--text-bright);max-width:none}
.trace-table .col-spans{text-align:right;color:var(--text-dim);width:70px}
.trace-table .col-duration{text-align:right;width:100px}
.trace-table .col-time{color:var(--text-dim);width:120px}
.trace-table .col-status{width:70px}
.trace-table .col-services{color:var(--text-dim);max-width:300px;font-size:12px}
.badge-error{color:var(--error);font-weight:600}
.badge-ok{color:var(--ok)}
.badge-unset{color:var(--text-dim)}
.svc-tag{display:inline-block;padding:1px 6px;border-radius:3px;font-size:11px;margin:1px 2px;border:1px solid}

/* Trace detail */
.detail-header{padding:12px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:16px;flex-shrink:0}
.detail-header .trace-id{font-size:12px;color:var(--text-dim)}
.detail-header .trace-meta{display:flex;gap:16px;margin-left:auto;font-size:12px;color:var(--text-dim)}

/* Waterfall */
.waterfall{width:100%;border-collapse:collapse}
.waterfall td{padding:0;border-bottom:1px solid var(--border);vertical-align:middle;height:28px}
.waterfall tr{cursor:pointer}
.waterfall tr:hover{background:var(--hover)}
.waterfall tr.selected{background:var(--selected)}
.wf-label{display:flex;align-items:center;padding:0 8px;gap:4px;white-space:nowrap;overflow:hidden}
.wf-toggle{width:16px;flex-shrink:0;text-align:center;cursor:pointer;color:var(--text-dim);font-size:11px}
.wf-indent{flex-shrink:0}
.wf-name{overflow:hidden;text-overflow:ellipsis;color:var(--text-bright);font-size:12px}
.wf-svc{flex-shrink:0;font-size:11px;margin-left:6px;opacity:0.7}
.wf-dur{flex-shrink:0;margin-left:auto;padding-left:8px;font-size:11px;color:var(--text-dim)}
.wf-bar-cell{position:relative}
.wf-bar{position:absolute;top:6px;height:16px;border-radius:3px;min-width:2px;opacity:0.85}
.wf-bar:hover{opacity:1}
.wf-ruler{position:sticky;top:0;background:var(--surface);border-bottom:1px solid var(--border);height:28px;display:flex;align-items:flex-end;font-size:10px;color:var(--text-dim);z-index:1}
.wf-ruler-tick{position:absolute;bottom:0;border-left:1px solid var(--border);height:8px;padding-left:4px;white-space:nowrap}

/* Span detail panel */
.span-panel{border-left:1px solid var(--border);background:var(--surface);overflow-y:auto;position:fixed;right:0;top:0;bottom:0;width:420px;z-index:20;box-shadow:-4px 0 16px rgba(0,0,0,0.4);transform:translateX(100%);transition:transform 0.15s ease-out}
.span-panel.open{transform:translateX(0)}
.span-panel-header{padding:10px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px}
.span-panel-header .close-btn{margin-left:auto;cursor:pointer;color:var(--text-dim);font-size:16px;background:none;border:none;font:inherit;padding:2px 6px;border-radius:3px}
.span-panel-header .close-btn:hover{background:var(--hover);color:var(--text)}
.span-section{padding:10px 16px;border-bottom:1px solid var(--border)}
.span-section h3{font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-dim);margin-bottom:8px}
.span-field{display:flex;padding:2px 0;font-size:12px;gap:8px}
.span-field .label{color:var(--text-dim);min-width:110px;flex-shrink:0}
.span-field .value{color:var(--text);word-break:break-all}
.attr-table{width:100%;border-collapse:collapse;font-size:12px}
.attr-table td{padding:3px 0;vertical-align:top}
.attr-table .attr-key{color:var(--accent);width:45%;padding-right:8px;word-break:break-all}
.attr-table .attr-val{color:var(--text);word-break:break-all}

/* Responsive waterfall layout */
.waterfall-container{display:flex;flex:1}
.waterfall-scroll{flex:1;overflow:visible}
.no-traces{padding:40px;text-align:center;color:var(--text-dim)}

/* Service filter dropdown */
.svc-filter-drop{position:absolute;top:100%;left:0;background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:4px 0;z-index:10;min-width:200px;max-height:300px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,0.4)}
.svc-filter-item{padding:5px 12px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:12px}
.svc-filter-item:hover{background:var(--hover)}
.svc-filter-item input{accent-color:var(--accent)}
.svc-filter-wrap{position:relative}

/* Status dot */
.status-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px}
.status-dot.error{background:var(--error);box-shadow:0 0 4px var(--error)}
.status-dot.ok{background:var(--ok)}
.status-dot.unset{background:var(--text-dim)}

/* View tabs */
.view-tabs{display:flex;gap:4px;margin-left:auto}
.view-tab{background:none;border:1px solid var(--border);color:var(--text-dim);padding:3px 12px;border-radius:4px;font:inherit;font-size:12px;cursor:pointer}
.view-tab:hover{border-color:var(--accent);color:var(--text)}
.view-tab.active{border-color:var(--accent);color:var(--accent);background:var(--hover)}

/* Flamegraph */
.fg-container{padding:16px;overflow:auto;flex:1}
.fg-row{position:relative;height:22px;margin-bottom:2px}
.fg-bar{position:absolute;top:0;height:20px;border-radius:2px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:11px;line-height:20px;padding:0 4px;color:#000;opacity:0.85;cursor:pointer;min-width:2px}
.fg-bar:hover{opacity:1;z-index:1}
.fg-bar-label{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;display:block;pointer-events:none}
.fg-mode-tabs{display:flex;gap:6px;margin-bottom:10px}
.fg-mode-tab{padding:3px 12px;border-radius:4px;border:1px solid var(--border);background:transparent;color:var(--text-dim);font-size:12px;cursor:pointer}
.fg-mode-tab:hover{background:var(--hover);color:var(--text)}
.fg-mode-tab.active{border-color:var(--accent);color:var(--accent);background:var(--hover)}
.fg-breadcrumb{display:flex;align-items:center;gap:4px;margin-bottom:8px;font-size:12px;flex-wrap:wrap;min-height:22px}
.fg-bc-item{padding:2px 8px;border-radius:4px;border:1px solid var(--border);color:var(--text-dim);cursor:pointer;background:transparent}
.fg-bc-item:hover{border-color:var(--accent);color:var(--accent);background:var(--hover)}
.fg-bc-item.fg-bc-current{border-color:var(--accent);color:var(--accent);background:var(--hover);cursor:default}
.fg-bc-sep{color:var(--text-dim);user-select:none}

/* Insights */
.insights{padding:20px;display:flex;flex-direction:column;gap:18px}
.insights-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.insight-card{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:14px}
.insight-card h3{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-dim);margin-bottom:8px}
.insight-card .value{font-size:20px;color:var(--text-bright);margin-bottom:4px}
.insight-card .sub{font-size:12px;color:var(--text-dim)}
.insight-section{background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden}
.insight-section-header{padding:10px 14px;border-bottom:1px solid var(--border);font-size:12px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.5px}
.insight-table{width:100%;border-collapse:collapse}
.insight-table td{padding:9px 14px;border-bottom:1px solid var(--border);font-size:12px;vertical-align:top}
.insight-table tr:last-child td{border-bottom:none}
.insight-title{color:var(--text-bright)}
.insight-detail{color:var(--text-dim)}
.insight-action{color:var(--accent);cursor:pointer;white-space:nowrap}
.insight-action:hover{text-decoration:underline}
#kb-hint{position:fixed;bottom:0;left:0;right:0;padding:2px 8px;font-size:11px;color:var(--text-dim);background:var(--bg);border-top:1px solid var(--border);pointer-events:none;z-index:10}
</style>
</head>
<body>

<div class="header">
  <img src="data:image/png;base64,${logoBase64}" alt="Tawny" width="28" height="28" style="border-radius:4px">
  <h1>Tawny</h1>
  <span class="subtitle">OpenTelemetry Trace Viewer</span>
  <select id="theme-select" class="theme-select" style="margin-left:auto">
    <option value="tokyo-night">Tokyo Night</option>
    <option value="solarized-light">Solarized Light</option>
    <option value="catppuccin-mocha">Catppuccin Mocha</option>
    <option value="dracula">Dracula</option>
    <option value="nord">Nord</option>
    <option value="gruvbox-dark">Gruvbox Dark</option>
  </select>
  <span class="stats" id="stats"></span>
</div>
<div id="toolbar-mount"></div>
<div id="breadcrumb-mount"></div>
<div id="app" class="content"></div>

<script>
// === Embedded trace data ===
const TRACES = ${data};
const INSIGHTS = ${insights};
const REPORT_BYTES = ${reportBytes};

// === Theme data ===
const THEME_DATA = ${themeDataJson};
const DEFAULT_THEME_ID = "${defaultThemeId}";

// CSS var name mapping: ThemeColors key → CSS custom property
const THEME_CSS_MAP = {
  bg: "--bg",
  bgAlt: "--surface",
  bgHighlight: "--hover",
  fg: "--text",
  fgDim: "--text-dim",
  border: "--border",
  accent: "--accent",
  accent2: "--accent2",
  accent3: "--accent3",
  success: "--ok",
  warning: "--warn",
  error: "--error",
  headerBg: "--header-bg",
  headerFg: "--header-fg",
  barFill: "--bar-fill",
};

function setTheme(id) {
  const t = THEME_DATA[id];
  if (!t) return;
  const root = document.documentElement;
  for (const [key, val] of Object.entries(t.colors)) {
    const cssVar = THEME_CSS_MAP[key];
    if (cssVar) root.style.setProperty(cssVar, val);
  }
  // --text-bright follows --text
  root.style.setProperty("--text-bright", t.colors.fg);
  // --selected follows --hover
  root.style.setProperty("--selected", t.colors.bgHighlight);
  // Update service colors
  SERVICE_COLORS.length = 0;
  for (const c of t.servicePalette) SERVICE_COLORS.push(c);
  // Recompute global service color map
  const newMap = assignServiceColors(allServices);
  for (const k of Object.keys(globalServiceColors)) delete globalServiceColors[k];
  Object.assign(globalServiceColors, newMap);
  render();
}

// === Helpers ===
let SERVICE_COLORS = ${JSON.stringify(theme.servicePalette)};

function assignServiceColors(services) {
  const sorted = [...services].sort();
  const map = {};
  for (let i = 0; i < sorted.length; i++) map[sorted[i]] = SERVICE_COLORS[i % SERVICE_COLORS.length];
  return map;
}

function formatDuration(ms) {
  if (ms < 0.001) return (ms * 1e6).toFixed(0) + "ns";
  if (ms < 1) return (ms * 1e3).toFixed(0) + "\\u00b5s";
  if (ms < 1000) return ms.toFixed(2) + "ms";
  if (ms < 60000) return (ms / 1000).toFixed(2) + "s";
  const m = Math.floor(ms / 60000);
  const s = ((ms % 60000) / 1000).toFixed(1);
  return m + "m" + s + "s";
}

function formatTimestamp(ms) {
  const d = new Date(ms);
  return d.toISOString().replace("T", " ").replace("Z", "");
}

function formatTimeShort(ms) {
  const d = new Date(ms);
  const pad2 = n => String(n).padStart(2, "0");
  const pad3 = n => String(n).padStart(3, "0");
  return pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds()) + "." + pad3(d.getMilliseconds());
}

function shortId(id, len) { return id.slice(0, len || 8); }

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function flattenTree(tree, collapsed) {
  const result = [];
  function walk(spans, depth) {
    for (const s of spans) {
      const isCollapsed = collapsed.has(s.spanId);
      let hiddenCount = 0;
      if (isCollapsed) {
        const countAll = sp => { let c = sp.children.length; for (const ch of sp.children) c += countAll(ch); return c; };
        hiddenCount = countAll(s);
      }
      result.push({ span: s, depth, hasChildren: s.children.length > 0, isCollapsed, hiddenCount });
      if (!isCollapsed) walk(s.children, depth + 1);
    }
  }
  walk(tree, 0);
  return result;
}

// Collect all unique services across all traces
const allServices = [...new Set(TRACES.flatMap(t => t.services))].sort();
const globalServiceColors = assignServiceColors(allServices);

// === State ===
let currentView = "list"; // "list" | "detail" | "insights"
let currentTraceId = null;
let selectedSpanId = null;
let selectedRowIndex = -1;
let selectedSpanIndex = -1;
let searchQuery = "";
let detailSearchQuery = "";
let sortCol = "time";
let sortAsc = true;
let collapsedSpans = new Set();
let selectedServices = new Set(); // empty = all selected
let minSpans = 0;
let errorOnly = false;
let minDurationMs = 0;
let displayLimit = 100;
let detailMatchIndex = 0;

// === Stats ===
const totalSpans = TRACES.reduce((s, t) => s + t.spanCount, 0);
const statsEl = document.getElementById("stats");
const reportSizeMb = (REPORT_BYTES / (1024 * 1024)).toFixed(1);
const heavyReport = TRACES.length >= 200 || totalSpans >= 20000 || REPORT_BYTES >= 5 * 1024 * 1024;
statsEl.textContent = TRACES.length + " traces \\u00b7 " + totalSpans + " spans \\u00b7 " + reportSizeMb + " MB embedded";
if (heavyReport) {
  statsEl.textContent += " \\u00b7 large report";
  statsEl.classList.add("warn");
  statsEl.title = "This export embeds a large dataset and may feel heavier to search or render in the browser.";
}

// === Rendering ===

function render() {
  if (currentView === "list") renderTraceList();
  else if (currentView === "detail") renderTraceDetail();
  else if (currentView === "insights") renderInsights();
}

function openInsights() {
  currentView = "insights";
  render();
}

// --- Trace List ---

function getFilteredTraces() {
  let list = TRACES;
  if (selectedServices.size > 0) {
    list = list.filter(t => t.services.some(s => selectedServices.has(s)));
  }
  if (minSpans > 0) {
    list = list.filter(t => t.spanCount >= minSpans);
  }
  if (errorOnly) list = list.filter(t => t.errorCount > 0);
  if (minDurationMs > 0) list = list.filter(t => t.durationMs >= minDurationMs);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(t =>
      t.traceId.toLowerCase().includes(q) ||
      t.rootSpanName.toLowerCase().includes(q) ||
      t.services.some(s => s.toLowerCase().includes(q))
    );
  }
  const col = sortCol;
  list = [...list].sort((a, b) => {
    let va, vb;
    if (col === "id") { va = a.traceId; vb = b.traceId; }
    else if (col === "root") { va = a.rootSpanName; vb = b.rootSpanName; }
    else if (col === "spans") { va = a.spanCount; vb = b.spanCount; }
    else if (col === "duration") { va = a.durationMs; vb = b.durationMs; }
    else if (col === "time") { va = a.startTimeMs; vb = b.startTimeMs; }
    else if (col === "status") { va = a.errorCount; vb = b.errorCount; }
    else if (col === "services") { va = a.services.join(","); vb = b.services.join(","); }
    else { va = a.startTimeMs; vb = b.startTimeMs; }
    if (va < vb) return sortAsc ? -1 : 1;
    if (va > vb) return sortAsc ? 1 : -1;
    return 0;
  });
  return list;
}

function sortArrow(col) {
  if (sortCol !== col) return "";
  return '<span class="sort-arrow">' + (sortAsc ? "\\u25b2" : "\\u25bc") + "</span>";
}

function renderTraceList() {
  // Toolbar
  const tb = document.getElementById("toolbar-mount");
  tb.innerHTML = '<div class="toolbar">'
    + '<input type="text" id="search-input" placeholder="Search traces\\u2026" value="' + esc(searchQuery) + '">'
    + '<div class="svc-filter-wrap">'
    + '<button class="filter-btn' + (selectedServices.size > 0 ? " active" : "") + '" id="svc-filter-btn">Services' + (selectedServices.size > 0 ? " (" + selectedServices.size + ")" : "") + '</button>'
    + '<div class="svc-filter-drop" id="svc-filter-drop" style="display:none"></div>'
    + '</div>'
    + '<button class="filter-btn' + (minSpans > 0 ? " active" : "") + '" id="minspans-btn">' + (minSpans > 0 ? "Min spans: " + minSpans : "Min spans") + '</button>'
    + '<button class="filter-btn' + (errorOnly ? " active" : "") + '" id="errors-btn">' + (errorOnly ? "Errors \u2713" : "Errors") + '</button>'
    + '<button class="filter-btn' + (minDurationMs > 0 ? " active" : "") + '" id="duration-btn">' + (minDurationMs > 0 ? "Duration: " + minDurationMs + "ms" : "Duration") + '</button>'
    + '<div class="toolbar-spacer"></div>'
    + '<button class="filter-btn" id="insights-btn">Insights</button>'
    + '</div>';

  document.getElementById("search-input").addEventListener("input", e => {
    searchQuery = e.target.value;
    displayLimit = 100;
    renderTableBody();
  });

  document.getElementById("insights-btn").addEventListener("click", () => {
    openInsights();
  });

  document.getElementById("minspans-btn").addEventListener("click", () => {
    const t = [0, 3, 5, 10, 20, 50];
    minSpans = t[(t.indexOf(minSpans) + 1) % t.length];
    displayLimit = 100;
    render();
  });

  document.getElementById("errors-btn").addEventListener("click", () => {
    errorOnly = !errorOnly;
    displayLimit = 100;
    render();
  });

  document.getElementById("duration-btn").addEventListener("click", () => {
    const t = [0, 10, 50, 100, 500, 1000, 5000];
    minDurationMs = t[(t.indexOf(minDurationMs) + 1) % t.length];
    displayLimit = 100;
    render();
  });

  const filterBtn = document.getElementById("svc-filter-btn");
  const filterDrop = document.getElementById("svc-filter-drop");
  filterBtn.addEventListener("click", () => {
    const open = filterDrop.style.display !== "none";
    filterDrop.style.display = open ? "none" : "block";
    if (!open) renderServiceFilter();
  });
  document.addEventListener("click", e => {
    if (!e.target.closest(".svc-filter-wrap")) filterDrop.style.display = "none";
  });

  // Breadcrumb
  document.getElementById("breadcrumb-mount").innerHTML = "";

  // Table
  const app = document.getElementById("app");
  const cols = [
    { key: "id", label: "Trace ID", cls: "col-id" },
    { key: "root", label: "Root Span", cls: "col-root" },
    { key: "spans", label: "Spans", cls: "col-spans" },
    { key: "duration", label: "Duration", cls: "col-duration" },
    { key: "time", label: "Time", cls: "col-time" },
    { key: "status", label: "Status", cls: "col-status" },
    { key: "services", label: "Services", cls: "col-services" },
  ];
  let html = '<table class="trace-table"><thead><tr>';
  for (const c of cols) {
    html += '<th class="' + c.cls + '" data-col="' + c.key + '">' + c.label + sortArrow(c.key) + "</th>";
  }
  html += '</tr></thead><tbody id="trace-tbody"></tbody></table>';
  app.innerHTML = html;

  // Sort headers
  app.querySelectorAll(".trace-table th").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.dataset.col;
      if (sortCol === col) sortAsc = !sortAsc;
      else { sortCol = col; sortAsc = true; }
      renderTraceList();
    });
  });

  renderTableBody();
}

function renderTableBody() {
  const tbody = document.getElementById("trace-tbody");
  if (!tbody) return;
  const filtered = getFilteredTraces();
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="no-traces">⊘ No matching traces<br><span style="font-size:11px">Try adjusting filters or search query</span></td></tr>';
    return;
  }
  const visible = filtered.slice(0, displayLimit);
  let html = "";
  for (let i = 0; i < visible.length; i++) {
    const t = visible[i];
    const statusCls = t.errorCount > 0 ? "badge-error" : "badge-ok";
    const statusText = t.errorCount > 0 ? t.errorCount + " error" + (t.errorCount > 1 ? "s" : "") : "OK";
    const svcs = t.services.map(s => {
      const c = globalServiceColors[s] || "#888";
      return '<span class="svc-tag" style="color:' + c + ";border-color:" + c + '44">' + esc(s) + "</span>";
    }).join("");
    const selCls = i === selectedRowIndex ? " selected" : "";
    html += '<tr class="row' + selCls + '" data-trace="' + esc(t.traceId) + '">'
      + '<td class="col-id" title="' + esc(t.traceId) + '">' + shortId(t.traceId) + "</td>"
      + '<td class="col-root" title="' + esc(t.rootSpanName) + '">' + esc(t.rootSpanName) + "</td>"
      + '<td class="col-spans">' + t.spanCount + "</td>"
      + '<td class="col-duration">' + formatDuration(t.durationMs) + "</td>"
      + '<td class="col-time">' + formatTimeShort(t.startTimeMs) + "</td>"
      + '<td class="col-status"><span class="' + statusCls + '">' + statusText + "</span></td>"
      + '<td class="col-services">' + svcs + "</td>"
      + "</tr>";
  }
  if (filtered.length > displayLimit) html += '<tr><td colspan="7" class="no-traces" style="cursor:pointer;color:var(--accent)" id="show-more-btn">Show more (' + (filtered.length - displayLimit) + ' remaining)</td></tr>';
  tbody.innerHTML = html;
  tbody.querySelectorAll("tr.row").forEach(tr => {
    tr.addEventListener("click", () => openTrace(tr.dataset.trace));
  });
  const showMoreBtn = document.getElementById("show-more-btn");
  if (showMoreBtn) showMoreBtn.addEventListener("click", () => { displayLimit += 100; renderTableBody(); });
}

function renderServiceFilter() {
  const drop = document.getElementById("svc-filter-drop");
  let html = '<div class="svc-filter-item" id="svc-clear">Clear filter</div>';
  for (const s of allServices) {
    const checked = selectedServices.size === 0 || selectedServices.has(s) ? "checked" : "";
    const c = globalServiceColors[s] || "#888";
    html += '<label class="svc-filter-item"><input type="checkbox" data-svc="' + esc(s) + '" ' + checked + '><span style="color:' + c + '">' + esc(s) + "</span></label>";
  }
  drop.innerHTML = html;
  document.getElementById("svc-clear").addEventListener("click", () => {
    selectedServices.clear();
    displayLimit = 100;
    renderTraceList();
  });
  drop.querySelectorAll("input[type=checkbox]").forEach(cb => {
    cb.addEventListener("change", () => {
      const svc = cb.dataset.svc;
      if (cb.checked) {
        if (selectedServices.size === 0) {
          // Switching from "all" to specific: select all then toggle
          for (const s of allServices) selectedServices.add(s);
        }
        selectedServices.add(svc);
      } else {
        if (selectedServices.size === 0) {
          for (const s of allServices) selectedServices.add(s);
        }
        selectedServices.delete(svc);
        if (selectedServices.size === allServices.length) selectedServices.clear();
      }
      // If all are selected again, clear to mean "all"
      if (selectedServices.size === allServices.length) selectedServices.clear();
      displayLimit = 100;
      renderTableBody();
      // Update button text
      const btn = document.getElementById("svc-filter-btn");
      btn.className = "filter-btn" + (selectedServices.size > 0 ? " active" : "");
      btn.textContent = "Services" + (selectedServices.size > 0 ? " (" + selectedServices.size + ")" : "");
    });
  });
}

function renderInsights() {
  document.getElementById("toolbar-mount").innerHTML = '<div class="toolbar">'
    + '<button class="filter-btn" id="back-to-list">Back to traces</button>'
    + '<div class="toolbar-spacer"></div>'
    + '<button class="filter-btn" id="refresh-insights">Refresh summary</button>'
    + '</div>';

  document.getElementById("breadcrumb-mount").innerHTML = '<div class="breadcrumb"><span id="bc-list">Traces</span> / Insights</div>';
  document.getElementById("bc-list").addEventListener("click", () => { selectedRowIndex = -1; currentView = "list"; render(); });
  document.getElementById("back-to-list").addEventListener("click", () => { selectedRowIndex = -1; currentView = "list"; render(); });
  document.getElementById("refresh-insights").addEventListener("click", () => { renderInsights(); });

  const data = INSIGHTS;
  const app = document.getElementById("app");

  let html = '<div class="insights">';
  html += '<div class="insights-grid">';
  html += insightCard("Trace volume", data.overview.traceCount + ' traces', data.overview.totalSpans + ' spans across ' + data.overview.serviceCount + ' services');
  html += insightCard("Failures", data.overview.errorTraceCount + ' traces', data.overview.totalErrors + ' error spans');
  html += insightCard("Latency", formatDuration(data.overview.avgTraceDurationMs), 'avg trace duration');
  html += insightCard("Tail latency", formatDuration(data.overview.p95TraceDurationMs), 'p95 trace duration');
  html += '</div>';

  html += insightTable('Slowest traces', data.slowestTraces.map(trace => ({
    title: formatDuration(trace.durationMs) + ' · ' + esc(trace.rootSpanName),
    detail: trace.spanCount + ' spans · ' + trace.errorCount + ' errors · ' + esc(trace.services.join(', ') || '(unknown service)'),
    traceId: trace.traceId,
  })));

  html += insightTable('Root operations', data.hottestOperations.map(op => ({
    title: esc(op.serviceName + ' · ' + op.spanName),
    detail: op.count + ' traces · avg ' + formatDuration(op.avgDurationMs) + ' · max ' + formatDuration(op.maxDurationMs),
    traceId: op.slowestTraceId,
  })));

  html += insightTable('Service health', data.serviceHealth.map(service => ({
    title: esc(service.serviceName),
    detail: service.traceCount + ' traces · ' + service.spanCount + ' spans · ' + service.errorCount + ' errors · avg ' + formatDuration(service.avgTraceDurationMs),
    traceId: service.slowestTraceId,
  })));

  html += '</div>';
  app.innerHTML = html;

  app.querySelectorAll('[data-open-trace]').forEach(el => {
    el.addEventListener('click', () => {
      const traceId = el.getAttribute('data-open-trace');
      if (traceId) openTrace(traceId);
    });
  });
}

function insightCard(title, value, sub) {
  return '<div class="insight-card">'
    + '<h3>' + esc(title) + '</h3>'
    + '<div class="value">' + esc(value) + '</div>'
    + '<div class="sub">' + esc(sub) + '</div>'
    + '</div>';
}

function insightTable(title, rows) {
  let html = '<div class="insight-section"><div class="insight-section-header">' + esc(title) + '</div><table class="insight-table">';
  if (rows.length === 0) {
    html += '<tr><td class="insight-detail">No data available.</td></tr>';
  } else {
    for (const row of rows) {
      html += '<tr>'
        + '<td><div class="insight-title">' + row.title + '</div><div class="insight-detail">' + row.detail + '</div></td>'
        + '<td style="width:90px;text-align:right">'
        + (row.traceId ? '<span class="insight-action" data-open-trace="' + esc(row.traceId) + '">Open trace</span>' : '')
        + '</td>'
        + '</tr>';
    }
  }
  html += '</table></div>';
  return html;
}

// --- Trace Detail (Waterfall / Flamegraph) ---

let detailTab = "waterfall";

function openTrace(traceId) {
  currentView = "detail";
  currentTraceId = traceId;
  selectedSpanId = null;
  selectedSpanIndex = -1;
  collapsedSpans.clear();
  detailSearchQuery = "";
  detailMatchIndex = 0;
  detailTab = "waterfall";
  render();
}

function renderTraceDetail() {
  const trace = TRACES.find(t => t.traceId === currentTraceId);
  if (!trace) return;

  const svcColors = assignServiceColors(trace.services);

  document.getElementById("toolbar-mount").innerHTML = '<div class="toolbar">'
    + '<input type="text" id="detail-search-input" placeholder="Search spans…" value="' + esc(detailSearchQuery) + '">'
    + '<button class="filter-btn" id="detail-prev-match">Prev match</button>'
    + '<button class="filter-btn" id="detail-next-match">Next match</button>'
    + '<button class="filter-btn" id="detail-clear-search">Clear</button>'
    + '</div>';

  document.getElementById("detail-search-input").addEventListener("input", e => {
    detailSearchQuery = e.target.value;
    detailMatchIndex = 0;
    renderWaterfall(trace, svcColors);
  });
  document.getElementById("detail-prev-match").addEventListener("click", () => {
    moveDetailMatch(trace, svcColors, -1);
  });
  document.getElementById("detail-next-match").addEventListener("click", () => {
    moveDetailMatch(trace, svcColors, 1);
  });
  document.getElementById("detail-clear-search").addEventListener("click", () => {
    detailSearchQuery = "";
    detailMatchIndex = 0;
    document.getElementById("detail-search-input").value = "";
    renderWaterfall(trace, svcColors);
  });

  // Breadcrumb
  document.getElementById("breadcrumb-mount").innerHTML =
    '<div class="breadcrumb"><span id="bc-list">Traces</span> / ' + shortId(trace.traceId) + "</div>";
  document.getElementById("bc-list").addEventListener("click", () => { selectedSpanIndex = -1; currentView = "list"; render(); });
  app.innerHTML =
    '<div class="detail-header">'
    + '<span class="trace-id" title="' + esc(trace.traceId) + '">' + shortId(trace.traceId, 16) + "</span>"
    + '<div class="trace-meta">'
    + '<span>' + trace.spanCount + " spans</span>"
    + "<span>" + formatDuration(trace.durationMs) + "</span>"
    + "</div>"
    + '<div class="view-tabs">'
    + '<button class="view-tab' + (detailTab === "waterfall" ? " active" : "") + '" id="tab-waterfall">Waterfall</button>'
    + '<button class="view-tab' + (detailTab === "flamegraph" ? " active" : "") + '" id="tab-flamegraph">Flamegraph</button>'
    + "</div>"
    + "</div>"
    + '<div class="waterfall-container" id="wf-container" style="' + (detailTab === "waterfall" ? "" : "display:none") + '">'
    + '<div class="waterfall-scroll" id="wf-scroll"></div>'
    + '<div class="span-panel" id="span-panel"></div>'
    + "</div>"
    + '<div class="fg-container" id="fg-container" style="' + (detailTab === "flamegraph" ? "" : "display:none") + '"></div>';

  document.getElementById("tab-waterfall").addEventListener("click", () => {
    detailTab = "waterfall";
    document.getElementById("wf-container").style.display = "";
    document.getElementById("fg-container").style.display = "none";
    document.getElementById("tab-waterfall").className = "view-tab active";
    document.getElementById("tab-flamegraph").className = "view-tab";
  });

  document.getElementById("tab-flamegraph").addEventListener("click", () => {
    detailTab = "flamegraph";
    document.getElementById("wf-container").style.display = "none";
    document.getElementById("fg-container").style.display = "";
    document.getElementById("tab-waterfall").className = "view-tab";
    document.getElementById("tab-flamegraph").className = "view-tab active";
    renderFlamegraph(trace, svcColors);
  });

  renderWaterfall(trace, svcColors);
  if (detailTab === "flamegraph") renderFlamegraph(trace, svcColors);
}

function collectSearchState(tree, query, collapsed) {
  const q = query.trim().toLowerCase();
  if (!q) {
    return {
      matchedIds: new Set(),
      contextIds: new Set(),
      effectiveCollapsed: new Set(collapsed),
    };
  }

  const matchedIds = new Set();
  const parentMap = new Map();

  function walk(spans, parentSpanId) {
    for (const span of spans) {
      parentMap.set(span.spanId, parentSpanId || null);
      if (
        span.name.toLowerCase().includes(q)
        || span.serviceName.toLowerCase().includes(q)
        || span.spanId.toLowerCase().includes(q)
      ) {
        matchedIds.add(span.spanId);
      }
      if (span.children.length > 0) walk(span.children, span.spanId);
    }
  }

  walk(tree, null);

  const contextIds = new Set();
  for (const spanId of matchedIds) {
    let current = parentMap.get(spanId);
    while (current) {
      contextIds.add(current);
      current = parentMap.get(current);
    }
  }

  const effectiveCollapsed = new Set(collapsed);
  contextIds.forEach(spanId => effectiveCollapsed.delete(spanId));

  return { matchedIds, contextIds, effectiveCollapsed };
}

function moveDetailMatch(trace, svcColors, delta) {
  const state = collectSearchState(trace.tree, detailSearchQuery, collapsedSpans);
  if (state.matchedIds.size === 0) return;
  const flat = flattenTree(trace.tree, state.effectiveCollapsed).filter(item => state.matchedIds.has(item.span.spanId) || state.contextIds.has(item.span.spanId));
  const matches = flat.filter(item => state.matchedIds.has(item.span.spanId)).map(item => item.span.spanId);
  if (matches.length === 0) return;

  detailMatchIndex = (detailMatchIndex + delta + matches.length) % matches.length;
  selectedSpanId = matches[detailMatchIndex];
  renderWaterfall(trace, svcColors);

  const row = document.querySelector('tr[data-span="' + selectedSpanId + '"]');
  if (row) row.scrollIntoView({ block: "center" });
}

function renderWaterfall(trace, svcColors) {
  const searchState = collectSearchState(trace.tree, detailSearchQuery, collapsedSpans);
  const flat = flattenTree(trace.tree, searchState.effectiveCollapsed)
    .filter(item => searchState.matchedIds.size === 0 || searchState.matchedIds.has(item.span.spanId) || searchState.contextIds.has(item.span.spanId));
  const wfScroll = document.getElementById("wf-scroll");
  const traceDur = trace.durationMs || 1;
  const traceStart = trace.startTimeMs;

  // Compute label column width (roughly 50%)
  const labelPct = 45;

  let html = '<table class="waterfall" style="width:100%">';

  // Ruler row
  html += '<tr class="wf-ruler-row"><td style="width:' + labelPct + '%;padding:0"></td>'
    + '<td style="width:' + (100 - labelPct) + '%;padding:0;position:relative;height:28px">'
    + '<div class="wf-ruler" id="wf-ruler" style="width:100%;position:relative;height:28px">'
    + renderRulerTicks(traceDur)
    + '</div></td></tr>';

  // Span rows
  for (const item of flat) {
    const s = item.span;
    const indent = item.depth * 16;
    const svcColor = svcColors[s.serviceName] || "#888";
    const isError = s.status === "ERROR";
    const isMatch = searchState.matchedIds.has(s.spanId);
    const isContext = searchState.contextIds.has(s.spanId);
    const nameColor = isMatch ? "var(--warn)" : isContext ? "var(--text-dim)" : isError ? "var(--error)" : "var(--text-bright)";

    // Toggle icon
    let toggle = '<span class="wf-toggle">&nbsp;</span>';
    if (item.hasChildren) {
      toggle = '<span class="wf-toggle">' + (item.isCollapsed ? "\\u25b6" : "\\u25bc") + "</span>";
    }

    // Collapsed badge
    const badge = item.isCollapsed && item.hiddenCount > 0
      ? ' <span style="color:var(--text-dim);font-size:10px">(+' + item.hiddenCount + ")</span>"
      : "";

    // Bar position
    const offsetPct = ((s.startTimeMs - traceStart) / traceDur) * 100;
    const widthPct = Math.max((s.durationMs / traceDur) * 100, 0.3);

    const selCls = selectedSpanId === s.spanId ? " selected" : "";
    html += '<tr class="' + selCls + '" data-span="' + esc(s.spanId) + '">'
      + '<td class="wf-label-cell" style="width:' + labelPct + '%"><div class="wf-label">'
      + toggle
      + '<span class="wf-indent" style="width:' + indent + 'px"></span>'
      + '<span class="wf-name" style="color:' + nameColor + '" title="' + esc(s.name) + '">' + esc(s.name) + badge + "</span>"
      + '<span class="wf-svc" style="color:' + svcColor + '">' + esc(s.serviceName) + "</span>"
      + '<span class="wf-dur">' + formatDuration(s.durationMs) + "</span>"
      + '</div></td>'
      + '<td class="wf-bar-cell" style="width:' + (100 - labelPct) + '%;position:relative">'
      + '<div class="wf-bar" style="left:' + offsetPct + "%;width:" + widthPct + "%;background:" + svcColor + ";border-left:2px solid " + svcColor + '"></div>'
      + "</td></tr>";
  }

  html += "</table>";
  wfScroll.innerHTML = html;

  const matchCount = searchState.matchedIds.size;
  const input = document.getElementById("detail-search-input");
  if (input && detailSearchQuery) {
    input.title = matchCount > 0 ? matchCount + " matches" : "No matches";
  }

  // Event handlers
  wfScroll.querySelectorAll("tr[data-span]").forEach(tr => {
    const spanId = tr.dataset.span;
    // Click on toggle
    const toggle = tr.querySelector(".wf-toggle");
    if (toggle && toggle.textContent.trim()) {
      toggle.addEventListener("click", e => {
        e.stopPropagation();
        if (collapsedSpans.has(spanId)) collapsedSpans.delete(spanId);
        else collapsedSpans.add(spanId);
        renderWaterfall(trace, svcColors);
      });
    }
    // Click on row to show span detail
    tr.addEventListener("click", () => {
      selectedSpanId = spanId;
      renderWaterfall(trace, svcColors);
      renderSpanPanel(trace, spanId, svcColors);
    });
  });

  // Re-render span panel if one was open
  if (selectedSpanId) {
    renderSpanPanel(trace, selectedSpanId, svcColors);
  }
}

function renderRulerTicks(durationMs) {
  if (durationMs <= 0) return "";
  const rough = durationMs / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const residual = rough / mag;
  let nice;
  if (residual <= 1) nice = 1;
  else if (residual <= 2) nice = 2;
  else if (residual <= 5) nice = 5;
  else nice = 10;
  const interval = nice * mag;

  let html = "";
  for (let t = 0; t <= durationMs; t += interval) {
    const pct = (t / durationMs) * 100;
    if (pct > 100) break;
    html += '<div class="wf-ruler-tick" style="left:' + pct + '%">' + formatDuration(t) + "</div>";
  }
  return html;
}

// --- Flamegraph ---

function collectByDepth(tree, depth, rows) {
  for (const span of tree) {
    if (!rows[depth]) rows[depth] = [];
    rows[depth].push(span);
    if (span.children.length > 0) collectByDepth(span.children, depth + 1, rows);
  }
}

function buildAggregatedRows(tree, traceDur) {
  var safeDur = traceDur > 0 ? traceDur : 1;
  var depthMap = new Map();

  function walkAgg(spans, depth, ancestorPath) {
    if (!depthMap.has(depth)) depthMap.set(depth, new Map());
    var levelMap = depthMap.get(depth);
    for (var i = 0; i < spans.length; i++) {
      var span = spans[i];
      var key = ancestorPath ? ancestorPath + " > " + span.serviceName + ":" + span.name : span.serviceName + ":" + span.name;
      if (levelMap.has(key)) {
        levelMap.get(key).totalDurationMs += span.durationMs;
      } else {
        levelMap.set(key, { totalDurationMs: span.durationMs, span: span });
      }
      if (span.children && span.children.length > 0) walkAgg(span.children, depth + 1, key);
    }
  }

  walkAgg(tree, 0, "");

  var depths = Array.from(depthMap.keys()).sort(function(a, b) { return a - b; });
  var rows = [];
  for (var di = 0; di < depths.length; di++) {
    var depth = depths[di];
    var levelMap = depthMap.get(depth);
    var entries = Array.from(levelMap.entries()).sort(function(a, b) {
      var aLeaf = a[0].split(" > ").pop() || a[0];
      var bLeaf = b[0].split(" > ").pop() || b[0];
      return aLeaf < bLeaf ? -1 : aLeaf > bLeaf ? 1 : 0;
    });
    rows.push({ depth: depth, entries: entries, safeDur: safeDur });
  }
  return rows;
}

function renderFlamegraph(trace, svcColors) {
  var container = document.getElementById("fg-container");
  if (!container) return;

  var fgZoomStack = [];

  function getZoomedRoots() {
    if (fgZoomStack.length === 0) return { roots: trace.tree, dur: trace.durationMs || 1, startMs: trace.startTimeMs };
    var top = fgZoomStack[fgZoomStack.length - 1];
    return { roots: top.children, dur: top.durationMs || 1, startMs: top.startTimeMs };
  }

  function buildBreadcrumbEl() {
    var bc = document.createElement("div");
    bc.className = "fg-breadcrumb";

    var traceItem = document.createElement("span");
    traceItem.className = "fg-bc-item" + (fgZoomStack.length === 0 ? " fg-bc-current" : "");
    traceItem.textContent = "Trace";
    traceItem.addEventListener("click", function() {
      if (fgZoomStack.length === 0) return;
      fgZoomStack = [];
      rerender();
    });
    bc.appendChild(traceItem);

    for (var i = 0; i < fgZoomStack.length; i++) {
      var sep = document.createElement("span");
      sep.className = "fg-bc-sep";
      sep.textContent = " › ";
      bc.appendChild(sep);

      var item = document.createElement("span");
      item.className = "fg-bc-item" + (i === fgZoomStack.length - 1 ? " fg-bc-current" : "");
      item.textContent = fgZoomStack[i].serviceName + ":" + fgZoomStack[i].name;
      var idx = i;
      item.addEventListener("click", function() {
        fgZoomStack = fgZoomStack.slice(0, idx + 1);
        rerender();
      });
      bc.appendChild(item);
    }

    return bc;
  }

  function buildIcicleHtml(roots, dur, startMs) {
    var rows = [];
    collectByDepth(roots, 0, rows);
    var safeDur = dur > 0 ? dur : 1;
    var html = "";
    for (var d = 0; d < rows.length; d++) {
      html += '<div class="fg-row">';
      for (var si = 0; si < rows[d].length; si++) {
        var span = rows[d][si];
        var leftPct = ((span.startTimeMs - startMs) / safeDur) * 100;
        var widthPct = Math.max(0.3, (span.durationMs / safeDur) * 100);
        var isError = span.status === "ERROR";
        var bg = isError ? "#f7768e" : (svcColors[span.serviceName] || "#888");
        var hasChildren = span.children && span.children.length > 0;
        html += '<div class="fg-bar" data-span-id="' + esc(span.spanId) + '" style="left:' + leftPct + "%;width:" + widthPct + "%;background:" + bg + (hasChildren ? "" : ";opacity:0.6") + '" title="' + esc(span.name) + " [" + formatDuration(span.durationMs) + "]" + '">'
          + '<span class="fg-bar-label">' + esc(span.name) + "</span>"
          + "</div>";
      }
      html += "</div>";
    }
    return html || '<div style="padding:20px;color:var(--text-dim)">No spans to display.</div>';
  }

  function buildAggregatedHtml(roots, dur) {
    var aggRows = buildAggregatedRows(roots, dur);
    var html = "";
    for (var ri = 0; ri < aggRows.length; ri++) {
      var row = aggRows[ri];
      html += '<div class="fg-row" style="position:relative">';
      var leftPct = 0;
      for (var ei = 0; ei < row.entries.length; ei++) {
        var entry = row.entries[ei];
        var key = entry[0];
        var val = entry[1];
        var span = val.span;
        var widthPct = Math.max(0.3, (val.totalDurationMs / row.safeDur) * 100);
        var isError = span.status === "ERROR";
        var bg = isError ? "#f7768e" : (svcColors[span.serviceName] || "#888");
        var label = key.split(" > ").pop() || span.name;
        html += '<div class="fg-bar" data-agg-key="' + esc(key) + '" style="left:' + leftPct + "%;width:" + widthPct + "%;background:" + bg + '" title="' + esc(label) + " [" + formatDuration(val.totalDurationMs) + "]" + '">'
          + '<span class="fg-bar-label">' + esc(label) + "</span>"
          + "</div>";
        leftPct += widthPct;
      }
      html += "</div>";
    }
    return html || '<div style="padding:20px;color:var(--text-dim)">No spans to display.</div>';
  }

  function attachBarClickHandlers(fgRows, currentMode) {
    var bars = fgRows.querySelectorAll(".fg-bar[data-span-id]");
    for (var i = 0; i < bars.length; i++) {
      bars[i].addEventListener("click", function(e) {
        var spanId = e.currentTarget.getAttribute("data-span-id");
        var span = findSpan(trace.tree, spanId);
        if (!span) return;
        if (!span.children || span.children.length === 0) return;
        fgZoomStack.push(span);
        rerender();
      });
    }
  }

  var currentMode = "icicle";
  var fgRows = document.createElement("div");
  fgRows.id = "fg-rows";

  var bcEl = buildBreadcrumbEl();

  var tabs = document.createElement("div");
  tabs.className = "fg-mode-tabs";

  var icicleBtn = document.createElement("button");
  icicleBtn.className = "fg-mode-tab active";
  icicleBtn.textContent = "Icicle";

  var aggBtn = document.createElement("button");
  aggBtn.className = "fg-mode-tab";
  aggBtn.textContent = "Aggregated";

  function rerender() {
    var z = getZoomedRoots();
    if (currentMode === "icicle") {
      fgRows.innerHTML = buildIcicleHtml(z.roots, z.dur, z.startMs);
      attachBarClickHandlers(fgRows, currentMode);
    } else {
      fgRows.innerHTML = buildAggregatedHtml(z.roots, z.dur);
    }
    var oldBc = container.querySelector(".fg-breadcrumb");
    var newBc = buildBreadcrumbEl();
    if (oldBc) {
      container.replaceChild(newBc, oldBc);
    } else {
      container.insertBefore(newBc, tabs);
    }
  }

  icicleBtn.addEventListener("click", function() {
    icicleBtn.classList.add("active");
    aggBtn.classList.remove("active");
    currentMode = "icicle";
    var z = getZoomedRoots();
    fgRows.innerHTML = buildIcicleHtml(z.roots, z.dur, z.startMs);
    attachBarClickHandlers(fgRows, currentMode);
  });

  aggBtn.addEventListener("click", function() {
    aggBtn.classList.add("active");
    icicleBtn.classList.remove("active");
    currentMode = "aggregated";
    var z = getZoomedRoots();
    fgRows.innerHTML = buildAggregatedHtml(z.roots, z.dur);
  });

  tabs.appendChild(icicleBtn);
  tabs.appendChild(aggBtn);

  var z = getZoomedRoots();
  fgRows.innerHTML = buildIcicleHtml(z.roots, z.dur, z.startMs);

  container.innerHTML = "";
  container.appendChild(bcEl);
  container.appendChild(tabs);
  container.appendChild(fgRows);

  attachBarClickHandlers(fgRows, currentMode);
}

// --- Span Detail Panel ---

function renderSpanPanel(trace, spanId, svcColors) {
  const span = findSpan(trace.tree, spanId);
  if (!span) return;

  const panel = document.getElementById("span-panel");
  panel.classList.add("open");

  const statusCls = span.status === "ERROR" ? "error" : span.status === "OK" ? "ok" : "unset";
  const svcColor = svcColors[span.serviceName] || "#888";

  let html = '<div class="span-panel-header">'
    + '<span class="status-dot ' + statusCls + '"></span>'
    + '<strong style="font-size:13px;color:var(--text-bright)">' + esc(span.name) + "</strong>"
    + '<button class="close-btn" id="close-span">\\u00d7</button>'
    + "</div>";

  // Span Info
  html += '<div class="span-section"><h3>Span Info</h3>';
  html += field("Span ID", span.spanId);
  html += field("Trace ID", trace.traceId);
  if (span.parentSpanId) html += field("Parent Span", span.parentSpanId);
  html += field("Kind", span.kind);
  html += fieldHtml("Status", '<span class="' + (span.status === "ERROR" ? "badge-error" : span.status === "OK" ? "badge-ok" : "badge-unset") + '">' + esc(span.status) + "</span>");
  if (span.statusMessage) html += field("Message", span.statusMessage);
  html += "</div>";

  // Timing
  html += '<div class="span-section"><h3>Timing</h3>';
  html += field("Start", formatTimestamp(span.startTimeMs));
  html += field("End", formatTimestamp(span.endTimeMs));
  html += field("Duration", formatDuration(span.durationMs));
  html += "</div>";

  // Service
  html += '<div class="span-section"><h3>Service</h3>';
  html += fieldHtml("Service", '<span style="color:' + svcColor + '">' + esc(span.serviceName) + "</span>");
  if (span.serviceVersion) html += field("Version", span.serviceVersion);
  if (span.scopeName) html += field("Scope", span.scopeName);
  if (span.scopeVersion) html += field("Scope Version", span.scopeVersion);
  html += "</div>";

  // Attributes
  const attrKeys = Object.keys(span.attributes);
  if (attrKeys.length > 0) {
    html += '<div class="span-section"><h3>Attributes (' + attrKeys.length + ")</h3>";
    html += '<table class="attr-table">';
    for (const k of attrKeys) {
      html += '<tr><td class="attr-key">' + esc(k) + '</td><td class="attr-val">' + esc(span.attributes[k]) + "</td></tr>";
    }
    html += "</table></div>";
  }

  // Events
  if (span.events.length > 0) {
    html += '<div class="span-section"><h3>Events (' + span.events.length + ")</h3>";
    for (const ev of span.events) {
      html += '<div style="margin-bottom:8px">';
      html += '<div style="font-size:12px;color:var(--text-bright)">' + esc(ev.name) + "</div>";
      html += '<div style="font-size:11px;color:var(--text-dim)">' + formatTimestamp(ev.timeMs) + "</div>";
      const evAttrKeys = Object.keys(ev.attributes);
      if (evAttrKeys.length > 0) {
        html += '<table class="attr-table" style="margin-top:4px">';
        for (const k of evAttrKeys) {
          html += '<tr><td class="attr-key">' + esc(k) + '</td><td class="attr-val">' + esc(ev.attributes[k]) + "</td></tr>";
        }
        html += "</table>";
      }
      html += "</div>";
    }
    html += "</div>";
  }

  panel.innerHTML = html;

  document.getElementById("close-span").addEventListener("click", () => {
    selectedSpanId = null;
    panel.classList.remove("open");
    // Remove selected class
    document.querySelectorAll(".waterfall tr.selected").forEach(tr => tr.classList.remove("selected"));
  });
}

function findSpan(tree, spanId) {
  for (const s of tree) {
    if (s.spanId === spanId) return s;
    const found = findSpan(s.children, spanId);
    if (found) return found;
  }
  return null;
}

function field(label, value) {
  return '<div class="span-field"><span class="label">' + esc(label) + '</span><span class="value">' + esc(value) + "</span></div>";
}

function fieldHtml(label, html) {
  return '<div class="span-field"><span class="label">' + esc(label) + '</span><span class="value">' + html + "</span></div>";
}

function getVisibleSpans() {
  const trace = TRACES.find(t => t.traceId === currentTraceId);
  if (!trace) return [];
  const state = collectSearchState(trace.tree, detailSearchQuery, collapsedSpans);
  return flattenTree(trace.tree, state.effectiveCollapsed)
    .filter(item => state.matchedIds.size === 0 || state.matchedIds.has(item.span.spanId) || state.contextIds.has(item.span.spanId));
}

function handleKeydown(e) {
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

  if (currentView === "list") {
    const filtered = getFilteredTraces();
    const len = filtered.length;
    if (e.key === "j" || e.key === "ArrowDown") {
      e.preventDefault();
      selectedRowIndex = Math.min(selectedRowIndex + 1, len - 1);
      renderTableBody();
      const sel = document.querySelector("tr.row.selected");
      if (sel) sel.scrollIntoView({ block: "nearest" });
    } else if (e.key === "k" || e.key === "ArrowUp") {
      e.preventDefault();
      selectedRowIndex = Math.max(selectedRowIndex - 1, 0);
      renderTableBody();
      const sel = document.querySelector("tr.row.selected");
      if (sel) sel.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      if (selectedRowIndex >= 0 && selectedRowIndex < len) {
        openTrace(filtered[selectedRowIndex].traceId);
      }
    } else if (e.key === "/") {
      e.preventDefault();
      const input = document.getElementById("search-input");
      if (input) input.focus();
    } else if (e.key === "Escape") {
      selectedRowIndex = -1;
      renderTableBody();
    }
  } else if (currentView === "detail") {
    const flat = getVisibleSpans();
    const len = flat.length;
    if (e.key === "j" || e.key === "ArrowDown") {
      e.preventDefault();
      selectedSpanIndex = Math.min(selectedSpanIndex + 1, len - 1);
      if (selectedSpanIndex >= 0) selectedSpanId = flat[selectedSpanIndex].span.spanId;
      const trace = TRACES.find(t => t.traceId === currentTraceId);
      if (trace) {
        const svcColors = assignServiceColors(trace.services);
        renderWaterfall(trace, svcColors);
        const row = document.querySelector('tr[data-span="' + selectedSpanId + '"]');
        if (row) row.scrollIntoView({ block: "nearest" });
      }
    } else if (e.key === "k" || e.key === "ArrowUp") {
      e.preventDefault();
      selectedSpanIndex = Math.max(selectedSpanIndex - 1, 0);
      if (selectedSpanIndex >= 0) selectedSpanId = flat[selectedSpanIndex].span.spanId;
      const trace = TRACES.find(t => t.traceId === currentTraceId);
      if (trace) {
        const svcColors = assignServiceColors(trace.services);
        renderWaterfall(trace, svcColors);
        const row = document.querySelector('tr[data-span="' + selectedSpanId + '"]');
        if (row) row.scrollIntoView({ block: "nearest" });
      }
    } else if (e.key === "Enter") {
      if (selectedSpanId) {
        const trace = TRACES.find(t => t.traceId === currentTraceId);
        if (trace) {
          const svcColors = assignServiceColors(trace.services);
          renderSpanPanel(trace, selectedSpanId, svcColors);
        }
      }
    } else if (e.key === " ") {
      e.preventDefault();
      if (selectedSpanId) {
        if (collapsedSpans.has(selectedSpanId)) collapsedSpans.delete(selectedSpanId);
        else collapsedSpans.add(selectedSpanId);
        const trace = TRACES.find(t => t.traceId === currentTraceId);
        if (trace) {
          const svcColors = assignServiceColors(trace.services);
          renderWaterfall(trace, svcColors);
        }
      }
    } else if (e.key === "Escape" || e.key === "h") {
      selectedRowIndex = -1;
      selectedSpanIndex = -1;
      selectedSpanId = null;
      currentView = "list";
      render();
    }
  }
}


(function() {
  const saved = localStorage.getItem("tawny-theme");
  const initial = (saved && THEME_DATA[saved]) ? saved : DEFAULT_THEME_ID;
  const sel = document.getElementById("theme-select");
  if (sel) sel.value = initial;
  if (initial !== DEFAULT_THEME_ID) setTheme(initial);
  sel && sel.addEventListener("change", function() {
    const id = sel.value;
    setTheme(id);
    localStorage.setItem("tawny-theme", id);
  });
  document.addEventListener("keydown", handleKeydown);
})();
render();
</script>
<div id="kb-hint">j/k navigate &middot; Enter open &middot; / search &middot; Esc back</div>
</body>
</html>`
}
