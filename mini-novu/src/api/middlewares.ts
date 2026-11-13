import { createHash } from 'node:crypto';
import { config } from '../shared/config.ts';
import { infra } from '../shared/infra-client.ts';
import { trace } from '../shared/trace.ts';
import { HttpError, type Middleware } from '../shared/router.ts';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

// 1) XÁC THỰC: "bạn là ai". Novu: Guard xác thực API key/JWT.
export const auth: Middleware = async (ctx, next) => {
  const m = /^ApiKey (.+)$/.exec(String(ctx.req.headers.authorization ?? ''));
  if (!m || !config.apiKeys.includes(m[1])) {
    trace('api', 'api.rejected', { requestId: ctx.requestId, status: 401, reason: 'API key sai/thiếu' });
    throw new HttpError(401, 'Thiếu hoặc sai API key. Dùng header: Authorization: ApiKey <key>');
  }
  ctx.state.apiKey = m[1];
  await next();
};

// 2) RATE LIMIT (token bucket theo API key). Novu: @ThrottlerCategory / @ThrottlerCost (dùng Redis).
// Lưu ý: bucket nằm trong RAM của 1 process. Chạy nhiều api instance thì phải để ở Redis dùng chung.
const buckets = new Map<string, { tokens: number; last: number }>();
export function throttle(cost = 1): Middleware {
  return async (ctx, next) => {
    const { capacity, refillPerSec } = config.rateLimit;
    const now = Date.now();
    const b = buckets.get(ctx.state.apiKey) ?? { tokens: capacity, last: now };
    b.tokens = Math.min(capacity, b.tokens + ((now - b.last) / 1000) * refillPerSec);
    b.last = now;
    if (b.tokens < cost) {
      buckets.set(ctx.state.apiKey, b);
      const retryAfter = Math.ceil((cost - b.tokens) / refillPerSec);
      trace('api', 'api.rejected', { requestId: ctx.requestId, status: 429, reason: 'vượt rate limit' });
      throw new HttpError(429, 'Quá nhiều request', { retryAfterSeconds: retryAfter }, { 'retry-after': String(retryAfter) });
    }
    b.tokens -= cost;
    buckets.set(ctx.state.apiKey, b);
    await next();
  };
}

// 3) IDEMPOTENCY. Client gửi header Idempotency-Key; gửi lại cùng key thì KHÔNG chạy lại, trả kết quả cũ.
// Novu: apps/api/src/app/shared/framework/idempotency.interceptor.ts (trạng thái in-progress/success/error, cache 24h).
type Stored = { status: 'in-progress' | 'success' | 'error'; bodyHash: string; response?: { status: number; body: unknown } };
const PROGRESS_TTL = 5 * 60_000;
const DONE_TTL = 24 * 60 * 60_000;

export const idempotency: Middleware = async (ctx, next) => {
  const key = ctx.req.headers['idempotency-key'];
  if (typeof key !== 'string' || !key) return next();

  const id = `idem:${sha(ctx.state.apiKey + ':' + key)}`;
  const bodyHash = sha(JSON.stringify(ctx.body ?? null));

  // Giành quyền bằng thao tác nguyên tử: chỉ MỘT request thắng khi 2 request cùng key đến cùng lúc.
  const won = await infra.kvSetNx(id, { status: 'in-progress', bodyHash } satisfies Stored, PROGRESS_TTL);
  if (!won) {
    const cur = (await infra.kvGet(id)) as Stored | null;
    if (cur) {
      if (cur.bodyHash !== bodyHash) throw new HttpError(422, 'Idempotency-Key này đã dùng cho body khác');
      if (cur.status === 'in-progress') throw new HttpError(409, 'Request với key này đang được xử lý, thử lại sau');
      trace('api', 'api.idempotent_replay', { requestId: ctx.requestId, key });
      ctx.result = { status: cur.response!.status, body: cur.response!.body, headers: { 'idempotency-replay': 'true' } };
      return;
    }
  }

  try {
    await next();
    const stored: Stored = { status: 'success', bodyHash, response: { status: ctx.result!.status, body: ctx.result!.body } };
    await infra.kvSet(id, stored, DONE_TTL);
  } catch (err) {
    if (err instanceof HttpError && err.status < 500) {
      // Lỗi 4xx mang tính xác định: lưu lại để lần sau trả y hệt.
      const stored: Stored = { status: 'error', bodyHash, response: { status: err.status, body: { error: err.message, details: err.details } } };
      await infra.kvSet(id, stored, DONE_TTL);
    } else {
      await infra.kvDel(id); // lỗi 5xx: cho phép client thử lại với cùng key
    }
    throw err;
  }
};
