'use strict';
const crypto = require('crypto');
const { RISKY_COMMANDS, SENSITIVE_PATHS, SECRET_PATTERNS } = require('./rules');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function redact(text) {
  let out = String(text);
  for (const p of SECRET_PATTERNS) {
    out = out.replace(p.re, (m) => `${m.slice(0, 4)}…[REDACTED:${p.id}]`);
  }
  return out;
}

function findSecrets(text) {
  const hits = new Set();
  for (const p of SECRET_PATTERNS) {
    p.re.lastIndex = 0;
    if (p.re.test(text)) hits.add(p.id);
    p.re.lastIndex = 0;
  }
  return [...hits];
}

function resultText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((c) => (c && c.text) || '').join('\n');
  return '';
}

// Remove heredoc bodies so file *contents* written via `cat <<EOF` are not mistaken for commands.
function stripHeredocs(cmd) {
  return cmd.replace(/<<-?\s*(['"]?)([A-Za-z_][\w]*)\1[^\n]*\n[\s\S]*?\n\s*\2\b/g, '<<$2 [heredoc body omitted]');
}

function hostsIn(text) {
  const hosts = new Set();
  for (const m of String(text).matchAll(/https?:\/\/([A-Za-z0-9.-]+\.[A-Za-z]{2,}|localhost|\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?/g)) {
    hosts.add(m[1].toLowerCase());
  }
  return [...hosts];
}

const WRITE_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit']);
const READ_TOOLS = new Set(['Read', 'Glob', 'Grep', 'NotebookRead']);

function parseJsonl(text) {
  const rows = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try { rows.push(JSON.parse(line)); } catch { /* skip malformed line */ }
  }
  return rows;
}

function analyze(rows, meta = {}) {
  const events = [];
  const models = new Map();
  const sessions = new Set();
  const modes = new Set();
  const cwds = new Set();
  const branches = new Set();
  const toolCounts = new Map();
  const hosts = new Map();
  const findings = [];
  const secretHits = [];
  const filesWritten = new Map();
  const filesRead = new Set();
  const sensitive = [];
  const mcpTools = new Set();
  const pending = new Map(); // tool_use_id -> event index
  let errors = 0;
  let first = null;
  let last = null;

  const bump = (m, k, n = 1) => m.set(k, (m.get(k) || 0) + n);

  for (const row of rows) {
    if (row.sessionId) sessions.add(row.sessionId);
    if (row.permissionMode) modes.add(row.permissionMode);
    if (row.cwd) cwds.add(row.cwd);
    if (row.gitBranch) branches.add(row.gitBranch);
    const ts = row.timestamp || null;
    if (ts) { first = first && first < ts ? first : ts; last = last && last > ts ? last : ts; }
    const msg = row.message;
    if (!msg || typeof msg !== 'object') continue;
    if (row.type === 'assistant' && msg.model && msg.model !== '<synthetic>') bump(models, msg.model);
    if (!Array.isArray(msg.content)) continue;

    for (const b of msg.content) {
      if (b.type === 'tool_use') {
        const name = b.name;
        const input = b.input || {};
        bump(toolCounts, name);
        const ev = { i: events.length, ts, tool: name, kind: 'other', summary: '', sidechain: !!row.isSidechain, flags: [], error: false };
        const raw = JSON.stringify(input);

        if (name === 'Bash') {
          ev.kind = 'shell';
          ev.summary = stripHeredocs(String(input.command || ''));
          for (const r of RISKY_COMMANDS) {
            if (r.re.test(ev.summary)) ev.flags.push({ id: r.id, sev: r.sev, why: r.why });
          }
          for (const h of hostsIn(ev.summary)) bump(hosts, h);
        } else if (WRITE_TOOLS.has(name)) {
          ev.kind = 'write';
          const p = input.file_path || input.notebook_path || '';
          ev.summary = p;
          if (p) bump(filesWritten, p);
        } else if (READ_TOOLS.has(name)) {
          ev.kind = 'read';
          const p = input.file_path || input.path || input.pattern || '';
          ev.summary = String(p);
          if (input.file_path) filesRead.add(input.file_path);
        } else if (name === 'WebFetch' || name === 'WebSearch') {
          ev.kind = 'network';
          ev.summary = String(input.url || input.query || '');
          for (const h of hostsIn(ev.summary)) bump(hosts, h);
          if (name === 'WebSearch') bump(hosts, '(web search)');
        } else if (name && name.startsWith('mcp__')) {
          ev.kind = 'mcp';
          ev.summary = name;
          mcpTools.add(name.split('__').slice(0, 2).join('__'));
        } else {
          ev.summary = raw.slice(0, 160);
        }

        const sensTarget = ev.kind === 'shell' ? ev.summary.split(/\s+/) : [ev.summary];
        for (const t of sensTarget) {
          if (SENSITIVE_PATHS.test(t.replace(/^['"]|['"]$/g, ''))) {
            ev.flags.push({ id: 'sensitive-path', sev: 'high', why: 'Touches a credential or key file' });
            sensitive.push({ i: ev.i, tool: name, path: redact(t) });
            break;
          }
        }
        const inSecrets = findSecrets(raw);
        for (const s of inSecrets) {
          ev.flags.push({ id: 'secret-in-input', sev: 'high', why: `Secret (${s}) present in tool input` });
          secretHits.push({ i: ev.i, tool: name, type: s, where: 'input' });
        }
        ev.summary = redact(ev.summary);
        pending.set(b.id, events.length);
        events.push(ev);
      } else if (b.type === 'tool_result') {
        const idx = pending.get(b.tool_use_id);
        const text = resultText(b.content);
        if (idx !== undefined) {
          const ev = events[idx];
          if (b.is_error) { ev.error = true; errors++; }
          for (const s of findSecrets(text)) {
            ev.flags.push({ id: 'secret-in-output', sev: 'high', why: `Secret (${s}) surfaced in tool output (now in model context)` });
            secretHits.push({ i: ev.i, tool: ev.tool, type: s, where: 'output' });
          }
        }
      }
    }
  }

  // Tamper-evident hash chain over normalized events.
  let prev = '0'.repeat(64);
  for (const ev of events) {
    const body = JSON.stringify({ i: ev.i, ts: ev.ts, tool: ev.tool, kind: ev.kind, summary: ev.summary, flags: ev.flags.map((f) => f.id), error: ev.error });
    ev.hash = sha256(prev + body);
    prev = ev.hash;
  }

  for (const ev of events) {
    for (const f of ev.flags) findings.push({ ...f, i: ev.i, tool: ev.tool, summary: ev.summary.slice(0, 200), ts: ev.ts });
  }
  const high = findings.filter((f) => f.sev === 'high').length;
  const medium = findings.filter((f) => f.sev === 'medium').length;
  const score = Math.min(100, high * 10 + medium * 2 + secretHits.length * 5);
  const level = score < 15 ? 'low' : score < 40 ? 'moderate' : 'high';

  return {
    meta: { ...meta, generatedAt: new Date().toISOString(), tool: 'agent-trustpack@0.1.0' },
    window: { first, last },
    sessions: [...sessions],
    models: Object.fromEntries(models),
    permissionModes: [...modes],
    cwds: [...cwds],
    branches: [...branches],
    toolCounts: Object.fromEntries([...toolCounts].sort((a, b) => b[1] - a[1])),
    mcpServers: [...mcpTools],
    hosts: Object.fromEntries([...hosts].sort((a, b) => b[1] - a[1])),
    filesWritten: Object.fromEntries([...filesWritten].sort((a, b) => b[1] - a[1])),
    filesReadCount: filesRead.size,
    sensitive,
    secretHits,
    errors,
    findings,
    risk: { score, level, high, medium },
    chainHead: prev,
    events,
  };
}

function verifyChain(report) {
  let prev = '0'.repeat(64);
  for (const ev of report.events) {
    const body = JSON.stringify({ i: ev.i, ts: ev.ts, tool: ev.tool, kind: ev.kind, summary: ev.summary, flags: ev.flags.map((f) => f.id), error: ev.error });
    const h = sha256(prev + body);
    if (h !== ev.hash) return { ok: false, brokenAt: ev.i };
    prev = h;
  }
  return { ok: prev === report.chainHead, brokenAt: prev === report.chainHead ? null : -1 };
}

module.exports = { analyze, parseJsonl, verifyChain, redact };
