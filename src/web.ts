import type { TraceSummary, ParsedSpan, ParsedEvent } from "./types"

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

// --- HTML generation ---

export function generateHtml(traces: TraceSummary[]): string {
  const data = JSON.stringify(traces.map(convertTrace))

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tawny &mdash; OpenTelemetry Traces</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#1a1b26;--surface:#24283b;--border:#3b4261;
  --text:#c0caf5;--text-dim:#565f89;--text-bright:#e0e0e0;
  --accent:#7aa2f7;--error:#f7768e;--ok:#9ece6a;--warn:#e0af68;
  --hover:#292e42;--selected:#33394d;
  font-family:"JetBrains Mono","Fira Code","SF Mono",Menlo,Consolas,monospace;
  font-size:13px;color:var(--text);background:var(--bg);
}
body{min-height:100vh;display:flex;flex-direction:column}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}

/* Header */
.header{background:var(--surface);border-bottom:1px solid var(--border);padding:10px 20px;display:flex;align-items:center;gap:16px;flex-shrink:0}
.header h1{font-size:15px;font-weight:600;color:var(--text-bright)}
.header .subtitle{color:var(--text-dim);font-size:12px}
.header .stats{margin-left:auto;color:var(--text-dim);font-size:12px}

/* Toolbar */
.toolbar{background:var(--surface);border-bottom:1px solid var(--border);padding:8px 20px;display:flex;align-items:center;gap:12px;flex-shrink:0}
.toolbar input[type=text]{background:var(--bg);border:1px solid var(--border);color:var(--text);padding:5px 10px;border-radius:4px;font:inherit;width:260px;outline:none}
.toolbar input[type=text]:focus{border-color:var(--accent)}
.toolbar input[type=text]::placeholder{color:var(--text-dim)}
.toolbar .filter-btn{background:var(--bg);border:1px solid var(--border);color:var(--text-dim);padding:5px 10px;border-radius:4px;font:inherit;cursor:pointer}
.toolbar .filter-btn:hover{border-color:var(--accent);color:var(--text)}
.toolbar .filter-btn.active{border-color:var(--accent);color:var(--accent)}

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
.span-panel{border-left:1px solid var(--border);background:var(--surface);overflow-y:auto;position:fixed;right:0;top:0;bottom:0;width:420px;z-index:20;box-shadow:-4px 0 16px rgba(0,0,0,0.4)}
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
.status-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px}
.status-dot.error{background:var(--error)}
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
</style>
</head>
<body>

<div class="header">
  <h1>Tawny</h1>
  <span class="subtitle">OpenTelemetry Trace Viewer</span>
  <span class="stats" id="stats"></span>
</div>
<div id="toolbar-mount"></div>
<div id="breadcrumb-mount"></div>
<div id="app" class="content"></div>

<script>
// === Embedded trace data ===
const TRACES = ${data};

// === Helpers ===
const SERVICE_COLORS = [
  "#7dcfff","#bb9af7","#7aa2f7","#9ece6a","#e0af68",
  "#ff9e64","#f7768e","#2ac3de","#b4f9f8","#c0caf5"
];

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
let currentView = "list"; // "list" | "detail"
let currentTraceId = null;
let selectedSpanId = null;
let searchQuery = "";
let sortCol = "time";
let sortAsc = true;
let collapsedSpans = new Set();
let selectedServices = new Set(); // empty = all selected

// === Stats ===
const totalSpans = TRACES.reduce((s, t) => s + t.spanCount, 0);
document.getElementById("stats").textContent = TRACES.length + " traces \\u00b7 " + totalSpans + " spans";

// === Rendering ===

function render() {
  if (currentView === "list") renderTraceList();
  else if (currentView === "detail") renderTraceDetail();
}

// --- Trace List ---

function getFilteredTraces() {
  let list = TRACES;
  if (selectedServices.size > 0) {
    list = list.filter(t => t.services.some(s => selectedServices.has(s)));
  }
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
    + '</div>';

  document.getElementById("search-input").addEventListener("input", e => {
    searchQuery = e.target.value;
    renderTableBody();
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
    tbody.innerHTML = '<tr><td colspan="7" class="no-traces">No matching traces</td></tr>';
    return;
  }
  let html = "";
  for (const t of filtered) {
    const statusCls = t.errorCount > 0 ? "badge-error" : "badge-ok";
    const statusText = t.errorCount > 0 ? t.errorCount + " error" + (t.errorCount > 1 ? "s" : "") : "OK";
    const svcs = t.services.map(s => {
      const c = globalServiceColors[s] || "#888";
      return '<span class="svc-tag" style="color:' + c + ";border-color:" + c + '44">' + esc(s) + "</span>";
    }).join("");
    html += '<tr class="row" data-trace="' + t.traceId + '">'
      + '<td class="col-id" title="' + t.traceId + '">' + shortId(t.traceId) + "</td>"
      + '<td class="col-root" title="' + esc(t.rootSpanName) + '">' + esc(t.rootSpanName) + "</td>"
      + '<td class="col-spans">' + t.spanCount + "</td>"
      + '<td class="col-duration">' + formatDuration(t.durationMs) + "</td>"
      + '<td class="col-time">' + formatTimeShort(t.startTimeMs) + "</td>"
      + '<td class="col-status"><span class="' + statusCls + '">' + statusText + "</span></td>"
      + '<td class="col-services">' + svcs + "</td>"
      + "</tr>";
  }
  tbody.innerHTML = html;
  tbody.querySelectorAll("tr.row").forEach(tr => {
    tr.addEventListener("click", () => openTrace(tr.dataset.trace));
  });
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
      renderTableBody();
      // Update button text
      const btn = document.getElementById("svc-filter-btn");
      btn.className = "filter-btn" + (selectedServices.size > 0 ? " active" : "");
      btn.textContent = "Services" + (selectedServices.size > 0 ? " (" + selectedServices.size + ")" : "");
    });
  });
}

// --- Trace Detail (Waterfall / Flamegraph) ---

let detailTab = "waterfall";

function openTrace(traceId) {
  currentView = "detail";
  currentTraceId = traceId;
  selectedSpanId = null;
  collapsedSpans.clear();
  detailTab = "waterfall";
  render();
}

function renderTraceDetail() {
  const trace = TRACES.find(t => t.traceId === currentTraceId);
  if (!trace) return;

  const svcColors = assignServiceColors(trace.services);

  // Toolbar: none
  document.getElementById("toolbar-mount").innerHTML = "";

  // Breadcrumb
  document.getElementById("breadcrumb-mount").innerHTML =
    '<div class="breadcrumb"><span id="bc-list">Traces</span> / ' + shortId(trace.traceId) + "</div>";
  document.getElementById("bc-list").addEventListener("click", () => { currentView = "list"; render(); });

  const app = document.getElementById("app");
  app.innerHTML =
    '<div class="detail-header">'
    + '<span class="trace-id" title="' + trace.traceId + '">' + shortId(trace.traceId, 16) + "</span>"
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
    + '<div class="span-panel" id="span-panel" style="display:none"></div>'
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

function renderWaterfall(trace, svcColors) {
  const flat = flattenTree(trace.tree, collapsedSpans);
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
    const nameColor = isError ? "var(--error)" : "var(--text-bright)";

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
    html += '<tr class="' + selCls + '" data-span="' + s.spanId + '">'
      + '<td class="wf-label-cell" style="width:' + labelPct + '%"><div class="wf-label">'
      + toggle
      + '<span class="wf-indent" style="width:' + indent + 'px"></span>'
      + '<span class="wf-name" style="color:' + nameColor + '" title="' + esc(s.name) + '">' + esc(s.name) + badge + "</span>"
      + '<span class="wf-svc" style="color:' + svcColor + '">' + esc(s.serviceName) + "</span>"
      + '<span class="wf-dur">' + formatDuration(s.durationMs) + "</span>"
      + '</div></td>'
      + '<td class="wf-bar-cell" style="width:' + (100 - labelPct) + '%;position:relative">'
      + '<div class="wf-bar" style="left:' + offsetPct + "%;width:" + widthPct + "%;background:" + svcColor + '"></div>'
      + "</td></tr>";
  }

  html += "</table>";
  wfScroll.innerHTML = html;

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
  panel.style.display = "block";

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
  html += field("Status", '<span class="' + (span.status === "ERROR" ? "badge-error" : span.status === "OK" ? "badge-ok" : "badge-unset") + '">' + span.status + "</span>");
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
  html += field("Service", '<span style="color:' + svcColor + '">' + esc(span.serviceName) + "</span>");
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
    panel.style.display = "none";
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
  return '<div class="span-field"><span class="label">' + label + '</span><span class="value">' + value + "</span></div>";
}

// === Init ===
render();
</script>
</body>
</html>`
}
