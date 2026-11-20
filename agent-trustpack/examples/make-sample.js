'use strict';
// Generates a synthetic session. The fake secret is assembled at runtime so no
// secret-looking literal is committed (GitHub push protection would block it).
const fs = require('fs');
const path = require('path');
const fakeStripe = ['sk', 'live', 'x'.repeat(24)].join('_');
const use = (id, name, input, ts) => ({ type: 'assistant', sessionId: 'demo', timestamp: ts, permissionMode: 'acceptEdits', cwd: '/work/acme-portal', message: { model: 'claude-sonnet-5-5', content: [{ type: 'tool_use', id, name, input }] } });
const res = (id, c, e = false) => ({ type: 'user', sessionId: 'demo', message: { content: [{ type: 'tool_result', tool_use_id: id, content: c, is_error: e }] } });
const rows = [
  use('1', 'Read', { file_path: '/work/acme-portal/src/app.ts' }, '2026-11-19T09:00:00Z'), res('1', 'ok'),
  use('2', 'Bash', { command: 'npm install lodash axios' }, '2026-11-19T09:01:00Z'), res('2', 'added 2 packages'),
  use('3', 'Edit', { file_path: '/work/acme-portal/src/api.ts' }, '2026-11-19T09:02:00Z'), res('3', 'ok'),
  use('4', 'WebFetch', { url: 'https://api.acme-internal.example/v1/users' }, '2026-11-19T09:03:00Z'), res('4', 'ok'),
  use('5', 'Read', { file_path: '/work/acme-portal/.env' }, '2026-11-19T09:04:00Z'), res('5', 'STRIPE=' + fakeStripe),
  use('6', 'Bash', { command: 'git push --force origin main' }, '2026-11-19T09:05:00Z'), res('6', 'forced update'),
  use('7', 'Bash', { command: 'npm test' }, '2026-11-19T09:06:00Z'), res('7', '1 failing', true),
  use('8', 'mcp__github__create_pull_request', { title: 'x' }, '2026-11-19T09:07:00Z'), res('8', 'ok'),
];
const out = path.join(__dirname, 'sample-session.jsonl');
fs.writeFileSync(out, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
console.log('wrote ' + out);
