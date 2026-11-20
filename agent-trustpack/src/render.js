'use strict';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const list = (o) => Object.entries(o);

function table(rows, head) {
  if (!rows.length) return '<p class="muted">None observed.</p>';
  return `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;
}

function declared(v, fallback = 'Not declared — add to trustpack.config.json') {
  return v ? `<span class="tag decl">declared</span> ${esc(v)}` : `<span class="tag gap">gap</span> ${esc(fallback)}`;
}

function render(r, cfg = {}) {
  const models = list(r.models);
  const hosts = list(r.hosts);
  const tools = list(r.toolCounts);
  const written = list(r.filesWritten);
  const high = r.findings.filter((f) => f.sev === 'high');
  const med = r.findings.filter((f) => f.sev === 'medium');

  const q1 = `
    <p><b>Observed model(s):</b> ${models.length ? models.map(([m, n]) => `<code>${esc(m)}</code> (${n} turns)`).join(', ') : 'none recorded'}</p>
    <p><b>Where the model runs:</b> ${declared(cfg.modelHosting)}</p>
    <p><b>Training / fine-tuning on client data:</b> ${declared(cfg.trainingOnClientData)}</p>`;

  const q2 = `
    <p><b>Observed outbound destinations:</b> ${hosts.length ? hosts.map(([h, n]) => `<code>${esc(h)}</code> ×${n}`).join(', ') : 'none seen in shell/web tools'}</p>
    <p><b>MCP servers used:</b> ${r.mcpServers.length ? r.mcpServers.map((m) => `<code>${esc(m)}</code>`).join(', ') : 'none'}</p>
    <p><b>Files read:</b> ${r.filesReadCount} distinct · <b>files modified:</b> ${written.length}</p>
    <p><b>Data retention / residency:</b> ${declared(cfg.dataRetention)}</p>
    <p class="muted">Observed = derived from the session log. It cannot see traffic made inside code the agent ran, so treat this as a floor, not a ceiling.</p>`;

  const q3 = `
    <p><b>Permission mode(s):</b> ${r.permissionModes.length ? r.permissionModes.map((m) => `<code>${esc(m)}</code>`).join(', ') : 'unknown'}</p>
    <p><b>Tools used:</b> ${tools.map(([t, n]) => `<code>${esc(t)}</code> ×${n}`).join(', ') || 'none'}</p>
    <p><b>Credential / key files touched:</b> ${r.sensitive.length || 'none'} · <b>secrets seen in logs:</b> ${r.secretHits.length || 'none'}</p>
    <p><b>Risky actions:</b> ${r.risk.high} high · ${r.risk.medium} medium</p>`;

  const q4 = `
    <p><b>Accountable owner:</b> ${declared(cfg.owner)}</p>
    <p><b>Sessions covered:</b> ${r.sessions.length} · <b>window:</b> ${esc(r.window.first || '?')} → ${esc(r.window.last || '?')}</p>
    <p><b>Evidence integrity:</b> SHA-256 hash chain over ${r.events.length} events. Head: <code>${esc(r.chainHead.slice(0, 16))}…</code>
    <span class="muted">Run <code>agent-trustpack verify report.json</code>. Detects edits to the log; to resist a malicious editor, store the head hash somewhere you don't control (e.g. email it to the client).</span></p>`;

  const flagRows = [...high, ...med].map((f) => [
    `<span class="sev ${f.sev}">${f.sev}</span>`,
    `<code>${esc(f.id)}</code>`,
    esc(f.why),
    `<code>${esc(f.summary)}</code>`,
    `#${f.i}`,
  ]);

  const timeline = r.events.slice(0, 400).map((ev) => [
    `#${ev.i}`,
    esc((ev.ts || '').replace('T', ' ').slice(0, 19)),
    `<code>${esc(ev.tool)}</code>`,
    `<code>${esc(ev.summary.slice(0, 140))}</code>`,
    ev.flags.length ? ev.flags.map((f) => `<span class="sev ${f.sev}">${esc(f.id)}</span>`).join(' ') : '',
    ev.error ? '<span class="sev medium">error</span>' : '',
  ]);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Agent Trust Report${cfg.client ? ' — ' + esc(cfg.client) : ''}</title>
<style>
:root{--bg:#fff;--fg:#1a1d23;--mut:#6b7280;--card:#f6f7f9;--line:#e3e5ea;--hi:#b42318;--md:#b54708;--lo:#067647;--ac:#2f5fd0}
@media (prefers-color-scheme:dark){:root{--bg:#12141a;--fg:#e8eaee;--mut:#9aa1ad;--card:#1b1e26;--line:#2a2e38;--hi:#f97066;--md:#fdb022;--lo:#47cd89;--ac:#7aa2ff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,sans-serif}
main{max-width:980px;margin:0 auto;padding:24px 16px 64px}h1{margin:0 0 4px;font-size:26px}h2{margin:36px 0 10px;font-size:19px}
.muted{color:var(--mut);font-size:13px}.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin:10px 0}
.score{display:flex;gap:16px;align-items:center;flex-wrap:wrap}.big{font-size:44px;font-weight:700}
.low{color:var(--lo)}.moderate{color:var(--md)}.high{color:var(--hi)}
code{font:12.5px ui-monospace,monospace;background:var(--card);padding:1px 5px;border-radius:4px;word-break:break-all}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}
.wrap{overflow-x:auto}.sev{font-size:11px;font-weight:600;padding:1px 7px;border-radius:99px;border:1px solid currentColor}
.sev.high{color:var(--hi)}.sev.medium{color:var(--md)}.tag{font-size:11px;padding:1px 6px;border-radius:4px;border:1px solid var(--line)}
.tag.gap{color:var(--md)}.tag.decl{color:var(--ac)}
</style></head><body><main>
<h1>AI Agent Trust Report</h1>
<div class="muted">${cfg.client ? 'Prepared for ' + esc(cfg.client) + ' · ' : ''}${cfg.vendor ? 'by ' + esc(cfg.vendor) + ' · ' : ''}generated ${esc(r.meta.generatedAt)}</div>

<div class="card score"><div class="big ${r.risk.level}">${r.risk.score}<span class="muted">/100</span></div>
<div><b class="${r.risk.level}">${esc(r.risk.level.toUpperCase())} RISK</b><br>
<span class="muted">${r.events.length} tool calls · ${r.sessions.length} session(s) · ${r.risk.high} high / ${r.risk.medium} medium findings · ${r.errors} tool errors</span></div></div>

<h2>1. Which model, and where does it run?</h2><div class="card">${q1}</div>
<h2>2. Did client data leave the environment?</h2><div class="card">${q2}</div>
<h2>3. What could the agent do?</h2><div class="card">${q3}</div>
<h2>4. Who is accountable, and can you prove what happened?</h2><div class="card">${q4}</div>

<h2>Findings</h2><div class="wrap">${table(flagRows, ['Severity', 'Rule', 'Why it matters', 'Evidence', 'Event'])}</div>
<h2>Files modified</h2><div class="wrap">${table(written.slice(0, 50).map(([p, n]) => [`<code>${esc(p)}</code>`, n]), ['Path', 'Edits'])}</div>
<h2>Timeline</h2><div class="wrap">${table(timeline, ['#', 'Time (UTC)', 'Tool', 'Action', 'Flags', ''])}</div>
${r.events.length > 400 ? `<p class="muted">Showing first 400 of ${r.events.length} events. Full data in report.json.</p>` : ''}
<p class="muted" style="margin-top:32px">Generated by agent-trustpack. Items tagged <span class="tag gap">gap</span> need a human answer; items tagged <span class="tag decl">declared</span> come from your config and are not verified by this tool. Secrets are redacted in this report.</p>
</main></body></html>`;
}

module.exports = { render };
