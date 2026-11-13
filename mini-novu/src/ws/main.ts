// Service "ws": giữ kết nối realtime tới trình duyệt. Novu dùng socket.io (apps/ws/src/socket/ws.gateway.ts);
// ở đây dùng SSE (Server-Sent Events) vì nó chạy bằng Node thuần, cùng ý tưởng: server ĐẨY dữ liệu xuống client.
// Nó cũng phục vụ dashboard và nhận "trace" để vẽ luồng.
import fs from 'node:fs';
import type http from 'node:http';
import { config, urls } from '../shared/config.ts';
import { infra } from '../shared/infra-client.ts';
import { createLogger } from '../shared/log.ts';
import { createApp, HttpError, installCrashHandlers, json, jsonBody, requestId, type Ctx, type Route } from '../shared/router.ts';

const log = createLogger('ws');
installCrashHandlers(log);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const subscribers = new Map<string, Set<http.ServerResponse>>(); // subscriberId -> các kết nối đang mở
const watchers = new Set<http.ServerResponse>(); // dashboard
const history: unknown[] = [];

function sse(ctx: Ctx) {
  ctx.res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
  ctx.res.write(': connected\n\n');
}
const sendEvent = (res: http.ServerResponse, name: string, data: unknown) => res.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);

// Consumer của queue "web-sockets": lấy tin từ worker rồi đẩy xuống đúng subscriber.
let stopping = false;
async function consume() {
  while (!stopping) {
    try {
      const job = await infra.pull('web-sockets', config.visibilityMs);
      if (!job) { await sleep(150); continue; }
      const { subscriberId, notificationId, message } = job.data as any;
      const conns = subscribers.get(subscriberId);
      if (conns?.size) {
        for (const r of conns) sendEvent(r, 'notification', { notificationId, message });
        push({ t: Date.now(), service: 'ws', type: 'ws.pushed', jobId: job.id, subscriberId });
      } else {
        // Subscriber đang offline: Novu kiểm tra "online" trước khi đẩy; tin vẫn nằm trong DB để đọc sau.
        push({ t: Date.now(), service: 'ws', type: 'ws.offline', jobId: job.id, subscriberId });
      }
      await infra.ack(job);
    } catch {
      await sleep(500);
    }
  }
}

function push(ev: Record<string, unknown>) {
  history.push(ev);
  if (history.length > 300) history.shift();
  for (const w of watchers) sendEvent(w, 'trace', ev);
}

const dashboardHtml = fs.readFileSync(new URL('./dashboard.html', import.meta.url), 'utf8');

const routes: Route[] = [
  { method: 'GET', pattern: '/', handler: async (ctx) => { ctx.res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); ctx.res.end(dashboardHtml); } },
  { method: 'GET', pattern: '/stream', handler: async (ctx) => {
    const sub = ctx.url.searchParams.get('subscriber');
    if (!sub) throw new HttpError(400, 'Thiếu ?subscriber=');
    sse(ctx);
    const set = subscribers.get(sub) ?? subscribers.set(sub, new Set()).get(sub)!;
    set.add(ctx.res);
    const hb = setInterval(() => ctx.res.write(': ping\n\n'), 15_000); // heartbeat giữ kết nối
    ctx.req.on('close', () => { clearInterval(hb); set.delete(ctx.res); });
  } },
  { method: 'GET', pattern: '/trace', handler: async (ctx) => {
    sse(ctx);
    for (const ev of history) sendEvent(ctx.res, 'trace', ev);
    watchers.add(ctx.res);
    ctx.req.on('close', () => watchers.delete(ctx.res));
  } },
  { method: 'POST', pattern: '/internal/trace', handler: async (ctx) => { push(ctx.body); return json(204, undefined); } },
  { method: 'GET', pattern: '/stats', handler: async () => json(200, await infra.stats()) },

  // Proxy cho dashboard gọi API (tránh phải cấu hình CORS trong bài học này)
  { method: 'POST', pattern: '/demo/trigger', handler: async (ctx) => {
    const headers: Record<string, string> = { 'content-type': 'application/json', authorization: 'ApiKey demo-key' };
    const idem = ctx.req.headers['idempotency-key']; if (typeof idem === 'string') headers['idempotency-key'] = idem;
    const r = await fetch(`${urls.api}/v1/events/trigger`, { method: 'POST', headers, body: JSON.stringify(ctx.body) });
    return json(r.status, { status: r.status, body: await r.json().catch(() => null) });
  } },
  { method: 'GET', pattern: '/demo/notifications', handler: async () => {
    const r = await fetch(`${urls.api}/v1/notifications`, { headers: { authorization: 'ApiKey demo-key' } });
    return json(200, (await r.json()).data ?? []);
  } },
  { method: 'GET', pattern: '/health', handler: async () => json(200, { status: 'ok', watchers: watchers.size }) },
];

const app = createApp({ name: 'ws', log, accessLog: false, middlewares: [requestId, jsonBody()], routes });
await app.listen(config.ports.ws);
log.info('ws + dashboard sẵn sàng', { url: `http://localhost:${config.ports.ws}` });
consume();

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => { stopping = true; for (const w of [...watchers, ...[...subscribers.values()].flatMap((s) => [...s])]) w.end(); process.exit(0); });
}
