import { config } from '../shared/config.ts';
import { infra } from '../shared/infra-client.ts';
import { createLogger } from '../shared/log.ts';
import { trace } from '../shared/trace.ts';
import { createApp, installCrashHandlers, json, jsonBody, requestId, type Route } from '../shared/router.ts';
import { auth, idempotency, throttle } from './middlewares.ts';
import { TriggerEvent } from './trigger-event.usecase.ts';
import { parseTriggerBody } from './validation.ts';

const log = createLogger('api');
installCrashHandlers(log);
const triggerEvent = new TriggerEvent();

const routes: Route[] = [
  // Chuỗi xử lý của POST /v1/events/trigger (thứ tự quan trọng):
  //   requestId -> jsonBody(limit) -> auth -> throttle -> idempotency -> validate -> use case
  {
    method: 'POST',
    pattern: '/v1/events/trigger',
    middlewares: [auth, throttle(1), idempotency],
    handler: async (ctx) => {
      trace('api', 'api.request', { requestId: ctx.requestId, path: '/v1/events/trigger' });
      const command = parseTriggerBody(ctx.body); // validate -> ném 422 nếu sai
      const result = await triggerEvent.execute(command, ctx.requestId);
      // 202 Accepted: "đã nhận, đang xử lý nền" — không phải "đã gửi xong"
      return json(202, { data: result });
    },
  },
  {
    method: 'GET',
    pattern: '/v1/notifications/:id',
    middlewares: [auth],
    handler: async (ctx) => {
      const n = await infra.dbGet('notifications', ctx.params.id);
      return n ? json(200, { data: n }) : json(404, { error: 'Không tìm thấy' });
    },
  },
  { method: 'GET', pattern: '/v1/notifications', middlewares: [auth], handler: async () => json(200, { data: await infra.dbList('notifications') }) },

  // Liveness: process còn sống? (orchestrator dùng để quyết định khởi động lại)
  { method: 'GET', pattern: '/health/live', handler: async () => json(200, { status: 'up' }) },
  // Readiness: sẵn sàng nhận traffic? Kiểm tra từng phụ thuộc. Novu: libs/application-generic/src/health/*
  {
    method: 'GET',
    pattern: '/health',
    handler: async () => {
      const checks: Record<string, 'up' | 'down'> = {};
      try { checks.infra = (await infra.health()).status === 200 ? 'up' : 'down'; } catch { checks.infra = 'down'; }
      const ok = Object.values(checks).every((v) => v === 'up');
      return json(ok ? 200 : 503, { status: ok ? 'ok' : 'degraded', checks });
    },
  },
];

const app = createApp({ name: 'api', log, middlewares: [requestId, jsonBody(100_000)], routes });
await app.listen(config.ports.api);
log.info('api sẵn sàng', { port: config.ports.api });

// Tắt êm: ngừng nhận kết nối mới, chờ request đang chạy xong rồi mới thoát.
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    log.info('nhận tín hiệu tắt', { sig });
    app.close().then(() => process.exit(0));
  });
}
