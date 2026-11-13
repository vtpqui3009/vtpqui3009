// Test end-to-end: khởi động cả 4 service ở cổng riêng rồi chạy từng kịch bản học.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';

const P = { infra: 4100, api: 4101, worker: 4102, ws: 4103 };
const API = `http://127.0.0.1:${P.api}`;
const H = { 'content-type': 'application/json', authorization: 'ApiKey demo-key' };
let dev: ChildProcess;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor<T>(fn: () => Promise<T | null | false | undefined>, ms = 10_000, label = 'điều kiện'): Promise<T> {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = await fn().catch(() => null); if (v) return v; await sleep(100); }
  throw new Error(`Hết giờ chờ ${label}`);
}
const trigger = (body: object, extra: Record<string, string> = {}) =>
  fetch(`${API}/v1/events/trigger`, { method: 'POST', headers: { ...H, ...extra }, body: JSON.stringify(body) });
const body = (simulate: string, extra: object = {}) => ({ workflowId: 'w', to: { subscriberId: 'alice' }, simulate, ...extra });
const getN = async (id: string) => (await (await fetch(`${API}/v1/notifications/${id}`, { headers: H })).json()).data;
const stats = async () => (await (await fetch(`http://127.0.0.1:${P.infra}/stats`)).json());

before(async () => {
  dev = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'src/dev.ts'], {
    stdio: 'ignore',
    env: {
      ...process.env, QUIET: '1',
      INFRA_PORT: String(P.infra), API_PORT: String(P.api), WORKER_PORT: String(P.worker), WS_PORT: String(P.ws),
      BACKOFF_MS: '200', VISIBILITY_MS: '1200', RATE_CAPACITY: '40', RATE_REFILL_PER_SEC: '0.2', API_KEYS: 'demo-key,limit-key',
    },
  });
  await waitFor(async () => (await fetch(`${API}/health`)).status === 200, 10_000, 'api sẵn sàng');
  await waitFor(async () => (await fetch(`http://127.0.0.1:${P.worker}/health`)).status === 200, 10_000, 'worker sẵn sàng');
});
after(() => { dev?.kill('SIGTERM'); });

test('API từ chối request không có API key (401) và body sai (422)', async () => {
  assert.equal((await fetch(`${API}/v1/events/trigger`, { method: 'POST', body: '{}' })).status, 401);
  const r = await trigger({ workflowId: 5 });
  assert.equal(r.status, 422);
  assert.ok((await r.json()).details.length >= 2);
});

test('luồng bình thường: 202 ngay, worker gửi xong, trạng thái = sent', async () => {
  const r = await trigger(body('ok'));
  assert.equal(r.status, 202);
  const { notificationId } = (await r.json()).data;
  const n = await waitFor(async () => { const x = await getN(notificationId); return x.status === 'sent' && x; });
  assert.equal(n.attempts, 1);
});

test('lỗi tạm thời: retry với backoff rồi thành công ở lần 3', async () => {
  const { notificationId } = (await (await trigger(body('flaky'))).json()).data;
  const n = await waitFor(async () => { const x = await getN(notificationId); return x.status === 'sent' && x; }, 10_000, 'flaky thành công');
  assert.equal(n.attempts, 3);
});

test('lỗi không thể retry: vào DLQ ngay ở lần 1', async () => {
  const { notificationId } = (await (await trigger(body('fatal'))).json()).data;
  const n = await waitFor(async () => { const x = await getN(notificationId); return x.status === 'failed' && x; });
  assert.equal(n.attempts, 1);
  assert.ok((await stats()).dead.some((d: any) => d.id === `notif:${notificationId}`));
});

test('lỗi mãi mãi: hết 3 lượt thì vào DLQ', async () => {
  const { notificationId } = (await (await trigger(body('always-fail'))).json()).data;
  const n = await waitFor(async () => { const x = await getN(notificationId); return x.status === 'failed' && x; }, 10_000);
  assert.equal(n.attempts, 3);
});

test('worker chết giữa chừng: job KHÔNG mất, được giao lại sau visibility timeout', async () => {
  const { notificationId } = (await (await trigger(body('crash'))).json()).data;
  const n = await waitFor(async () => { const x = await getN(notificationId); return x.status === 'sent' && x; }, 15_000, 'job được giao lại');
  assert.equal(n.attempts, 2);
});

test('Idempotency-Key: gửi lại cùng key trả kết quả cũ, không tạo thông báo mới', async () => {
  const key = 'k-' + Math.random();
  const b = body('ok');
  const r1 = await trigger(b, { 'idempotency-key': key });
  const r2 = await trigger(b, { 'idempotency-key': key });
  assert.equal(r2.headers.get('idempotency-replay'), 'true');
  assert.deepEqual((await r2.json()).data.notificationId, (await r1.json()).data.notificationId);
  // cùng key nhưng body khác => 422
  assert.equal((await trigger(body('flaky'), { 'idempotency-key': key })).status, 422);
});

test('transactionId trùng: lần 2 bị bỏ qua (ignored)', async () => {
  const tx = 'tx-' + Math.random();
  assert.equal((await (await trigger(body('ok', { transactionId: tx }))).json()).data.status, 'processed');
  assert.equal((await (await trigger(body('ok', { transactionId: tx }))).json()).data.status, 'ignored');
});

test('realtime: subscriber đang kết nối nhận được tin qua ws', async () => {
  const sub = 'bob-' + Math.random().toString(36).slice(2, 6);
  const ac = new AbortController();
  const res = await fetch(`http://127.0.0.1:${P.ws}/stream?subscriber=${sub}`, { signal: ac.signal });
  const reader = res.body!.getReader();
  let text = '';
  const reading = (async () => { for (;;) { const { value, done } = await reader.read(); if (done) break; text += new TextDecoder().decode(value); if (text.includes('event: notification')) break; } })();
  await sleep(300);
  await trigger({ workflowId: 'w', to: { subscriberId: sub }, simulate: 'ok' });
  await Promise.race([reading, sleep(8000)]);
  ac.abort();
  assert.ok(text.includes('event: notification'), 'phải nhận được event notification');
});

test('rate limit: vượt dung lượng bucket thì nhận 429 kèm Retry-After (dùng key riêng để không ảnh hưởng test khác)', async () => {
  const codes: number[] = [];
  let retryAfter: string | null = null;
  for (let i = 0; i < 50; i++) {
    // Body rỗng => 422 nếu qua được throttle. Throttle chạy TRƯỚC validate nên vẫn tiêu token.
    const r = await fetch(`${API}/v1/events/trigger`, { method: 'POST', headers: { ...H, authorization: 'ApiKey limit-key' }, body: '{}' });
    codes.push(r.status);
    retryAfter ??= r.headers.get('retry-after');
  }
  assert.ok(codes.includes(429), `cần có 429, nhận ${codes}`);
  assert.equal(codes[0], 422, 'request đầu qua throttle');
  assert.ok(retryAfter, 'phải có header retry-after');
});
