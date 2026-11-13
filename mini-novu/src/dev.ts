// Chạy cả 4 service cùng lúc, in log có màu theo service, tự khởi động lại service nào chết.
// (Việc "tự khởi động lại" ngoài đời do Docker/Kubernetes/ECS làm. Ở đây giả lập để thấy cảnh worker chết rồi sống lại.)
import { spawn, type ChildProcess } from 'node:child_process';
import { config } from './shared/config.ts';

const services = [
  { name: 'infra', file: 'src/infra/main.ts', color: 36 },
  { name: 'ws', file: 'src/ws/main.ts', color: 35 },
  { name: 'api', file: 'src/api/main.ts', color: 32 },
  { name: 'worker', file: 'src/worker/main.ts', color: 33 },
];
const children = new Map<string, ChildProcess>();
let shuttingDown = false;

function start(s: (typeof services)[number]) {
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', s.file], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  children.set(s.name, child);
  const out = (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) {
      if (process.env.QUIET === '1') continue;
      console.log(`\x1b[${s.color}m${s.name.padEnd(6)}\x1b[0m ${line}`);
    }
  };
  child.stdout!.on('data', out);
  child.stderr!.on('data', out);
  child.on('exit', (code) => {
    if (shuttingDown) return;
    console.log(`\x1b[31m${s.name.padEnd(6)} thoát (code ${code}) -> khởi động lại sau 500ms\x1b[0m`);
    setTimeout(() => start(s), 500);
  });
}

const shutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children.values()) c.kill('SIGTERM');
  setTimeout(() => process.exit(0), 1500).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log(`Dashboard: http://localhost:${config.ports.ws}   API: http://localhost:${config.ports.api}`);
for (const s of services) start(s);
