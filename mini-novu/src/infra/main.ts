// "infra" = giả lập Redis(BullMQ)/SQS + Mongo + cache trong MỘT process để chạy được không cần cài gì.
// Cái cần học là NGỮ NGHĨA của queue, không phải công nghệ:
//   waiting -> active -> (ack: xóa) | (fail: chờ backoff rồi waiting lại) | (hết lượt hoặc lỗi không thể retry: dead = DLQ)
//   active quá visibilityMs mà không ack/fail  => coi như worker chết, giao lại.
import { randomUUID } from 'node:crypto';
import { config } from '../shared/config.ts';
import { createLogger } from '../shared/log.ts';
import { trace } from '../shared/trace.ts';
import { createApp, HttpError, installCrashHandlers, json, jsonBody, requestId, type Route } from '../shared/router.ts';

const log = createLogger('infra');
installCrashHandlers(log);

type JobRec = {
  id: string; queue: string; data: unknown;
  status: 'waiting' | 'active' | 'dead';
  attemptsMade: number; maxAttempts: number; backoffMs: number;
  availableAt: number; visibleUntil: number; receipt: string; lastError?: string;
};
const jobs = new Map<string, JobRec>();
const queues = new Set<string>(['standard', 'web-sockets']);

function failJob(job: JobRec, error: string, retryable: boolean): { outcome: 'retry' | 'dead'; delayMs?: number } {
  job.lastError = error;
  job.receipt = ''; // vô hiệu hóa receipt cũ
  if (!retryable || job.attemptsMade >= job.maxAttempts) {
    job.status = 'dead'; // giữ lại trong DLQ để người vận hành xem; jobId vẫn bị chiếm nên không bị đẩy trùng
    trace('infra', 'queue.dead', { jobId: job.id, queue: job.queue, error, reason: retryable ? 'hết lượt thử' : 'lỗi không thể retry' });
    log.warn('job -> DLQ', { jobId: job.id, error });
    return { outcome: 'dead' };
  }
  const delayMs = job.backoffMs * 2 ** (job.attemptsMade - 1); // exponential backoff
  job.status = 'waiting';
  job.availableAt = Date.now() + delayMs;
  trace('infra', 'queue.retry_scheduled', { jobId: job.id, queue: job.queue, attempt: job.attemptsMade, delayMs, error });
  return { outcome: 'retry', delayMs };
}

// Reaper: tìm job "active" quá hạn (worker chết / treo) rồi giao lại. Giống SQS visibility timeout.
setInterval(() => {
  const now = Date.now();
  for (const job of jobs.values()) {
    if (job.status === 'active' && job.visibleUntil < now) {
      trace('infra', 'queue.visibility_timeout', { jobId: job.id, queue: job.queue });
      log.warn('visibility timeout: giao lại job', { jobId: job.id });
      failJob(job, 'visibility timeout (worker không phản hồi)', true);
    }
  }
}, 250).unref();

// ---- DB và KV (có TTL) ----
const db = new Map<string, Map<string, any>>();
const kv = new Map<string, { value: unknown; expiresAt: number }>();
const kvLive = (key: string) => {
  const e = kv.get(key);
  if (e && e.expiresAt < Date.now()) { kv.delete(key); return undefined; }
  return e;
};
const col = (name: string) => db.get(name) ?? db.set(name, new Map()).get(name)!;

const routes: Route[] = [
  { method: 'GET', pattern: '/health', handler: async () => json(200, { ok: true }) },

  // --- Queue ---
  { method: 'POST', pattern: '/queues/:queue/jobs', handler: async (ctx) => {
    const q = ctx.params.queue; queues.add(q);
    const { jobId, data, maxAttempts, backoffMs } = ctx.body ?? {};
    const id: string = jobId ?? randomUUID();
    if (jobs.has(id)) {
      // jobId trùng => KHÔNG thêm lần hai. (Novu: standard-queue.service.ts đặt jobId mặc định = tên job)
      trace('infra', 'queue.deduped', { jobId: id, queue: q });
      return json(200, { id, deduped: true });
    }
    jobs.set(id, { id, queue: q, data, status: 'waiting', attemptsMade: 0, maxAttempts: maxAttempts ?? config.maxAttempts,
      backoffMs: backoffMs ?? config.backoffMs, availableAt: Date.now(), visibleUntil: 0, receipt: '' });
    return json(201, { id, deduped: false });
  } },
  { method: 'POST', pattern: '/queues/:queue/pull', handler: async (ctx) => {
    const q = ctx.params.queue; const now = Date.now();
    const visibilityMs = Number(ctx.body?.visibilityMs ?? config.visibilityMs);
    for (const job of jobs.values()) {
      if (job.queue === q && job.status === 'waiting' && job.availableAt <= now) {
        job.status = 'active';
        job.attemptsMade += 1;
        job.visibleUntil = now + visibilityMs;
        job.receipt = randomUUID();
        trace('infra', 'queue.pulled', { jobId: job.id, queue: q, attempt: job.attemptsMade });
        return json(200, { id: job.id, queue: q, data: job.data, attemptsMade: job.attemptsMade, maxAttempts: job.maxAttempts, receipt: job.receipt });
      }
    }
    return { status: 204 };
  } },
  { method: 'POST', pattern: '/jobs/:id/ack', handler: async (ctx) => {
    const job = jobs.get(ctx.params.id);
    // Chặn "ack muộn": nếu job đã bị giao cho worker khác, receipt cũ không còn giá trị
    if (!job || job.status !== 'active' || job.receipt !== ctx.body?.receipt) throw new HttpError(409, 'receipt không hợp lệ hoặc job đã được giao lại');
    jobs.delete(job.id); // removeOnComplete: không để Redis phình
    trace('infra', 'queue.acked', { jobId: job.id, queue: job.queue });
    return json(200, { ok: true });
  } },
  { method: 'POST', pattern: '/jobs/:id/fail', handler: async (ctx) => {
    const job = jobs.get(ctx.params.id);
    if (!job || job.status !== 'active' || job.receipt !== ctx.body?.receipt) return json(200, { outcome: 'stale' });
    return json(200, failJob(job, String(ctx.body?.error ?? 'unknown'), ctx.body?.retryable !== false));
  } },
  { method: 'GET', pattern: '/stats', handler: async () => {
    const now = Date.now();
    const out: Record<string, { waiting: number; delayed: number; active: number; dead: number }> = {};
    for (const q of queues) out[q] = { waiting: 0, delayed: 0, active: 0, dead: 0 };
    for (const j of jobs.values()) {
      const s = out[j.queue];
      if (j.status === 'waiting') (j.availableAt > now ? s.delayed++ : s.waiting++);
      else s[j.status]++;
    }
    return json(200, { queues: out, dead: [...jobs.values()].filter((j) => j.status === 'dead').map((j) => ({ id: j.id, queue: j.queue, error: j.lastError })) });
  } },

  // --- DB (giả lập Mongo) ---
  { method: 'POST', pattern: '/db/:col', handler: async (ctx) => { col(ctx.params.col).set(ctx.body.id, ctx.body); return json(201, ctx.body); } },
  { method: 'GET', pattern: '/db/:col', handler: async (ctx) => json(200, [...col(ctx.params.col).values()].reverse().slice(0, 50)) },
  { method: 'GET', pattern: '/db/:col/:id', handler: async (ctx) => {
    const d = col(ctx.params.col).get(ctx.params.id);
    return d ? json(200, d) : json(404, { error: 'not found' });
  } },
  { method: 'PATCH', pattern: '/db/:col/:id', handler: async (ctx) => {
    const c = col(ctx.params.col); const d = c.get(ctx.params.id);
    if (!d) return json(404, { error: 'not found' });
    const next = { ...d, ...ctx.body, updatedAt: Date.now() };
    c.set(ctx.params.id, next);
    return json(200, next);
  } },

  // --- KV có TTL (giả lập Redis cache) ---
  { method: 'GET', pattern: '/kv/:key', handler: async (ctx) => {
    const e = kvLive(ctx.params.key);
    return e ? json(200, { value: e.value }) : json(404, { error: 'not found' });
  } },
  { method: 'PUT', pattern: '/kv/:key', handler: async (ctx) => {
    kv.set(ctx.params.key, { value: ctx.body.value, expiresAt: Date.now() + Number(ctx.body.ttlMs ?? 60_000) });
    return json(200, { ok: true });
  } },
  { method: 'DELETE', pattern: '/kv/:key', handler: async (ctx) => { kv.delete(ctx.params.key); return json(200, { ok: true }); } },
  { method: 'POST', pattern: '/kv/:key/setnx', handler: async (ctx) => {
    if (kvLive(ctx.params.key)) return json(200, { ok: false });
    kv.set(ctx.params.key, { value: ctx.body.value, expiresAt: Date.now() + Number(ctx.body.ttlMs ?? 60_000) });
    return json(200, { ok: true });
  } },
];

const app = createApp({ name: 'infra', log, accessLog: false, middlewares: [requestId, jsonBody()], routes });
await app.listen(config.ports.infra);
log.info('infra sẵn sàng', { port: config.ports.infra });

for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => app.close().then(() => process.exit(0)));
