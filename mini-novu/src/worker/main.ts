import { config } from '../shared/config.ts';
import { infra, type Job } from '../shared/infra-client.ts';
import { createLogger } from '../shared/log.ts';
import { trace } from '../shared/trace.ts';
import { createApp, installCrashHandlers, json } from '../shared/router.ts';
import { runJob, UnrecoverableError } from './run-job.usecase.ts';

const log = createLogger('worker');
installCrashHandlers(log);

let stopping = false;
let active = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function handle(job: Job) {
  const requestId = (job.data as any)?.requestId;
  try {
    await runJob(job);
    await infra.ack(job); // CHỈ ack sau khi làm xong (at-least-once)
    trace('worker', 'worker.ack', { jobId: job.id, requestId });
  } catch (err) {
    const message = (err as Error).message;
    const retryable = !(err instanceof UnrecoverableError);
    const res = await infra.fail(job, message, retryable);
    log.warn('job lỗi', { jobId: job.id, requestId, error: message, retryable, outcome: res.outcome, delayMs: res.delayMs });
    trace('worker', 'worker.failed', { jobId: job.id, requestId, error: message, outcome: res.outcome, delayMs: res.delayMs });
    if (res.outcome === 'dead') {
      const n = (job.data as any).notificationId;
      await infra.dbPatch('notifications', n, { status: 'failed', error: message, attempts: job.attemptsMade }).catch(() => {});
    }
  }
}

// Vòng lặp lấy job. Đồng thời tối đa `workerConcurrency` job (giới hạn để không quá tải provider/DB).
async function loop() {
  while (!stopping) {
    if (active >= config.workerConcurrency) { await sleep(50); continue; }
    let job: Job | null = null;
    try {
      job = await infra.pull('standard', config.visibilityMs);
    } catch {
      await sleep(500); // infra chưa sẵn sàng: chờ rồi thử lại, đừng sập
      continue;
    }
    if (!job) { await sleep(150); continue; }
    active++;
    handle(job).catch((e) => log.error('handle lỗi ngoài dự kiến', { err: String(e) })).finally(() => active--);
  }
}

// Worker vẫn mở HTTP port để có health check. Novu: apps/worker cũng làm vậy.
const app = createApp({
  name: 'worker', log, accessLog: false,
  routes: [
    { method: 'GET', pattern: '/health/live', handler: async () => json(200, { status: 'up' }) },
    { method: 'GET', pattern: '/health', handler: async () => json(200, { status: stopping ? 'draining' : 'ok', active }) },
  ],
});
await app.listen(config.ports.worker);
log.info('worker sẵn sàng', { port: config.ports.worker, concurrency: config.workerConcurrency });
const running = loop();

// Tắt êm: ngừng lấy job mới, chờ job đang chạy xong để không bỏ rơi job nửa chừng.
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    log.info('nhận tín hiệu tắt, chờ job đang chạy', { sig, active });
    stopping = true;
    await running;
    while (active > 0) await sleep(50);
    await app.close();
    process.exit(0);
  });
}
