import { urls } from './config.ts';

// Client gọi service "infra" (giả lập Redis/SQS + Mongo). Các service khác chỉ nói chuyện với infra qua đây.

export type Job = {
  id: string;
  queue: string;
  data: any;
  attemptsMade: number; // = receiveCount của SQS: tăng mỗi lần job được giao cho worker
  maxAttempts: number;
  receipt: string; // "receipt handle": chỉ người đang giữ job mới ack/fail được
};

async function call(method: string, path: string, body?: unknown): Promise<{ status: number; data: any }> {
  const res = await fetch(urls.infra + path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(3000), // luôn đặt timeout khi gọi service khác
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : undefined };
}

export const infra = {
  health: () => call('GET', '/health'),
  stats: () => call('GET', '/stats').then((r) => r.data),

  enqueue: (queue: string, opts: { jobId?: string; data: unknown; maxAttempts?: number; backoffMs?: number }) =>
    call('POST', `/queues/${queue}/jobs`, opts).then((r) => r.data as { id: string; deduped: boolean }),
  pull: async (queue: string, visibilityMs: number): Promise<Job | null> => {
    const r = await call('POST', `/queues/${queue}/pull`, { visibilityMs });
    return r.status === 204 ? null : (r.data as Job);
  },
  ack: (job: Job) => call('POST', `/jobs/${job.id}/ack`, { receipt: job.receipt }),
  fail: (job: Job, error: string, retryable: boolean) =>
    call('POST', `/jobs/${job.id}/fail`, { receipt: job.receipt, error, retryable }).then(
      (r) => r.data as { outcome: 'retry' | 'dead' | 'stale'; delayMs?: number },
    ),

  dbInsert: (col: string, doc: { id: string } & Record<string, unknown>) => call('POST', `/db/${col}`, doc),
  dbGet: (col: string, id: string) => call('GET', `/db/${col}/${id}`).then((r) => (r.status === 200 ? r.data : null)),
  dbPatch: (col: string, id: string, patch: Record<string, unknown>) => call('PATCH', `/db/${col}/${id}`, patch),
  dbList: (col: string) => call('GET', `/db/${col}`).then((r) => r.data as any[]),

  kvGet: (key: string) => call('GET', `/kv/${encodeURIComponent(key)}`).then((r) => (r.status === 200 ? r.data.value : null)),
  kvSet: (key: string, value: unknown, ttlMs: number) => call('PUT', `/kv/${encodeURIComponent(key)}`, { value, ttlMs }),
  kvDel: (key: string) => call('DELETE', `/kv/${encodeURIComponent(key)}`),
  // set-if-not-exists: thao tác NGUYÊN TỬ, dùng để "giành quyền" (khóa idempotency, transactionId)
  kvSetNx: (key: string, value: unknown, ttlMs: number) =>
    call('POST', `/kv/${encodeURIComponent(key)}/setnx`, { value, ttlMs }).then((r) => r.data.ok as boolean),
};
