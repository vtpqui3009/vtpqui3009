#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { analyze, parseJsonl, verifyChain } = require('../src/analyze');
const { render } = require('../src/render');

const USAGE = `agent-trustpack — turn coding-agent logs into a client-ready trust report

Usage:
  agent-trustpack report [path...] [--config trustpack.config.json] [--out ./trustpack-out] [--since 2026-11-01]
      path: Claude Code session .jsonl files or directories (default: ~/.claude/projects)
  agent-trustpack verify <report.json>
  agent-trustpack init                  write a starter trustpack.config.json
`;

function walk(p, acc) {
  let st;
  try { st = fs.statSync(p); } catch { return acc; }
  if (st.isDirectory()) for (const f of fs.readdirSync(p)) walk(path.join(p, f), acc);
  else if (p.endsWith('.jsonl')) acc.push(p);
  return acc;
}

function arg(args, name) {
  const i = args.indexOf(name);
  if (i === -1) return null;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
}

function main(argv) {
  const [cmd, ...args] = argv;
  if (cmd === 'init') {
    const f = 'trustpack.config.json';
    if (fs.existsSync(f)) { console.error(f + ' already exists'); return 1; }
    fs.writeFileSync(f, JSON.stringify({
      client: 'Client name', vendor: 'Your company', owner: 'Name <email> — accountable for agent output',
      modelHosting: 'e.g. Anthropic API (US), or self-hosted open-weight model in client VPC',
      trainingOnClientData: 'e.g. No — API terms prohibit training on inputs',
      dataRetention: 'e.g. 30 days, zero-retention agreement in place',
    }, null, 2) + '\n');
    console.log('wrote ' + f);
    return 0;
  }
  if (cmd === 'verify') {
    if (!args[0]) { console.error(USAGE); return 2; }
    const res = verifyChain(JSON.parse(fs.readFileSync(args[0], 'utf8')));
    console.log(res.ok ? 'OK: hash chain intact' : `FAILED: chain broken at event ${res.brokenAt}`);
    return res.ok ? 0 : 1;
  }
  if (cmd === 'report') {
    const cfgPath = arg(args, '--config');
    const out = arg(args, '--out') || 'trustpack-out';
    const since = arg(args, '--since');
    const cfg = cfgPath ? JSON.parse(fs.readFileSync(cfgPath, 'utf8')) : (fs.existsSync('trustpack.config.json') ? JSON.parse(fs.readFileSync('trustpack.config.json', 'utf8')) : {});
    const inputs = args.length ? args : [path.join(os.homedir(), '.claude', 'projects')];
    const files = inputs.flatMap((p) => walk(p, []));
    if (!files.length) { console.error('No .jsonl session files found in: ' + inputs.join(', ')); return 1; }
    // Keep row order inside each file (tool_result must follow its tool_use); order files by first timestamp.
    const groups = files.map((f) => parseJsonl(fs.readFileSync(f, 'utf8')));
    const firstTs = (g) => (g.find((r) => r.timestamp) || {}).timestamp || '';
    groups.sort((a, b) => firstTs(a).localeCompare(firstTs(b)));
    let rows = groups.flat();
    if (since) rows = rows.filter((r) => !r.timestamp || r.timestamp >= since);
    const report = analyze(rows, { client: cfg.client || null, files: files.length });
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(out, 'report.html'), render(report, cfg));
    console.log(`Analyzed ${files.length} file(s), ${report.events.length} tool calls.`);
    console.log(`Risk: ${report.risk.level} (${report.risk.score}/100) — ${report.risk.high} high, ${report.risk.medium} medium, ${report.secretHits.length} secret hit(s)`);
    console.log(`Wrote ${path.join(out, 'report.html')} and report.json`);
    console.log(`Chain head: ${report.chainHead}`);
    return 0;
  }
  console.log(USAGE);
  return cmd ? 2 : 0;
}

process.exitCode = main(process.argv.slice(2));
