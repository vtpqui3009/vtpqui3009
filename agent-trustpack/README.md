# agent-trustpack

Turn AI coding-agent session logs into a **client-ready trust report**.

When you ship agent work to an enterprise client, they ask four things:
1. Which model, and where does it run?
2. Did our data leave the environment?
3. What could the agent do, and what did it touch?
4. Who is accountable, and can you prove what happened?

Most tools record or restrict agents. This one answers those four questions **from evidence**, in a document you can hand to a client's security reviewer. Fields it can't observe (model hosting, retention, owner) are marked `gap` until you declare them in config, so nothing is silently invented.

## Quick start (Node 18+, zero dependencies)

```bash
cd agent-trustpack
node bin/trustpack.js init                 # writes trustpack.config.json
node bin/trustpack.js report               # reads ~/.claude/projects/**/*.jsonl
node bin/trustpack.js report path/to/session.jsonl --since 2026-11-01 --out out
node bin/trustpack.js verify out/report.json
```

Outputs `report.html` (self-contained, light/dark) and `report.json`.
Try it on a synthetic sample: `node examples/make-sample.js && node bin/trustpack.js report examples/sample-session.jsonl --config examples/trustpack.config.json --out examples/out`. A pre-built result is in `examples/out/report.html`.

## What it detects
- Risky shell commands (force-push, pipe-to-shell, `sudo`, destructive SQL, publish, infra changes, hook bypass, package installs…), see `src/rules.js`
- Credential/key files touched (`.env`, `.ssh`, `.pem`…)
- Secrets appearing in tool inputs or outputs (AWS, GitHub, Anthropic, OpenAI, Stripe, JWT, private keys…). Redacted in reports.
- Outbound hosts, MCP servers used, files read/modified, tool errors
- SHA-256 hash chain over events; `verify` detects edits to the log

## Honest limits
- Currently parses **Claude Code** transcripts only.
- Observed network egress is a **floor**: it can't see traffic from code the agent ran.
- The hash chain detects edits but a malicious editor can recompute it. Anchor the head hash externally (e.g. email it to the client) for real tamper-resistance.
- Regex rules produce false positives/negatives. They are a starting point for a human review, not a certification.
- Not a compliance attestation (SOC 2, ISO 27001, etc.).

## Prior art (researched 2026-11-20)
Recording/replay is crowded: agent-strace, agentlog, Aftcast, panopticon, AgentLens, Retrace and others. Credential brokering exists too (Kontext CLI, Authsome, 1Password Credential Broker). Security-questionnaire automation exists (Conveyor, Vanta, Drata, UpGuard) but works from policy documents, not from agent logs. This tool's niche is the last mile: **log evidence → client-facing answers**.

## Roadmap
- v0.2: Cursor / Codex / Gemini CLI parsers; policy file (allow/deny) with pass/fail; PDF export
- v0.3: questionnaire import (CSV/XLSX) → auto-fill answers with evidence links
- v0.4: optional hosted dashboard for agencies (multi-client, retention, signed head-hash anchoring)
