import http from 'node:http';
import { randomUUID } from 'node:crypto';
import type { Logger } from './log.ts';

// Router + middleware kiểu Koa, rất nhỏ. Mục đích: thấy rõ "chuỗi xử lý request"
// (Novu/NestJS gọi là middleware -> guard -> interceptor -> pipe -> controller).

export type Result = { status: number; body?: unknown; headers?: Record<string, string> };
export type Ctx = {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  url: URL;
  params: Record<string, string>;
  requestId: string;
  body: any;
  state: Record<string, any>; // nơi middleware để lại dữ liệu cho bước sau
  result?: Result;
};
export type Next = () => Promise<void>;
export type Middleware = (ctx: Ctx, next: Next) => Promise<void>;
export type Handler = (ctx: Ctx) => Promise<Result | void>;
export type Route = { method: string; pattern: string; middlewares?: Middleware[]; handler: Handler };

export class HttpError extends Error {
  status: number;
  details?: unknown;
  headers: Record<string, string>;
  constructor(status: number, message: string, details?: unknown, headers: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.details = details;
    this.headers = headers;
  }
}

export function json(status: number, body: unknown, headers?: Record<string, string>): Result {
  return { status, body, headers };
}

// Middleware: gắn requestId (nhận từ client nếu có) để truy vết log.
export const requestId: Middleware = async (ctx, next) => {
  ctx.res.setHeader('x-request-id', ctx.requestId);
  await next();
};

// Middleware: đọc JSON body có GIỚI HẠN dung lượng (chống request khổng lồ).
export function jsonBody(limitBytes = 100_000): Middleware {
  return async (ctx, next) => {
    if (!['POST', 'PUT', 'PATCH'].includes(ctx.req.method ?? '')) return next();
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of ctx.req) {
      size += (chunk as Buffer).length;
      if (size > limitBytes) throw new HttpError(413, `Body vượt quá ${limitBytes} bytes`);
      chunks.push(chunk as Buffer);
    }
    const raw = Buffer.concat(chunks).toString('utf8');
    if (raw) {
      try {
        ctx.body = JSON.parse(raw);
      } catch {
        throw new HttpError(400, 'Body không phải JSON hợp lệ');
      }
    }
    await next();
  };
}

export function sendJson(res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  if (res.headersSent) return;
  const payload = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(payload);
}

function match(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/').filter(Boolean);
  const b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

export function createApp(opts: { name: string; log: Logger; middlewares?: Middleware[]; routes: Route[]; accessLog?: boolean }) {
  const inflight = new Set<Promise<void>>();

  const server = http.createServer((req, res) => {
    const p = handle(req, res);
    inflight.add(p);
    p.finally(() => inflight.delete(p));
  });

  async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const started = Date.now();
    const url = new URL(req.url ?? '/', 'http://localhost');
    const hdr = req.headers['x-request-id'];
    const ctx: Ctx = {
      req, res, url, params: {}, body: undefined, state: {},
      requestId: typeof hdr === 'string' && hdr ? hdr : randomUUID(),
    };
    try {
      let route: Route | undefined;
      for (const r of opts.routes) {
        const params = r.method === req.method ? match(r.pattern, url.pathname) : null;
        if (params) {
          route = r;
          ctx.params = params;
          break;
        }
      }
      if (!route) throw new HttpError(404, `Không có route ${req.method} ${url.pathname}`);
      const chain: Middleware[] = [...(opts.middlewares ?? []), ...(route.middlewares ?? [])];
      const terminal: Middleware = async () => {
        const out = await route.handler(ctx);
        if (out) ctx.result = out;
      };
      let i = -1;
      const dispatch = async (n: number): Promise<void> => {
        if (n <= i) throw new Error('next() gọi nhiều lần');
        i = n;
        const fn = n < chain.length ? chain[n] : terminal;
        await fn(ctx, () => dispatch(n + 1));
      };
      await dispatch(0);
      if (!res.headersSent && ctx.result) sendJson(res, ctx.result.status, ctx.result.body, ctx.result.headers);
    } catch (err) {
      if (err instanceof HttpError) {
        sendJson(res, err.status, { error: err.message, details: err.details, requestId: ctx.requestId }, err.headers);
      } else {
        // Lỗi bất ngờ: log chi tiết, nhưng KHÔNG lộ stack cho client.
        opts.log.error('unhandled error in request', { requestId: ctx.requestId, err: String((err as Error)?.stack ?? err) });
        sendJson(res, 500, { error: 'Internal Server Error', requestId: ctx.requestId });
      }
    } finally {
      if (opts.accessLog !== false && !url.pathname.startsWith('/internal') && url.pathname !== '/trace' && url.pathname !== '/stats' && !url.pathname.startsWith('/health')) {
        opts.log.info('request', { requestId: ctx.requestId, method: req.method, path: url.pathname, status: res.statusCode, ms: Date.now() - started });
      }
    }
  }

  return {
    server,
    listen: (port: number) =>
      new Promise<void>((resolve) => server.listen(port, '0.0.0.0', () => resolve())),
    // Tắt êm: ngừng nhận kết nối mới, chờ request đang chạy xong.
    async close() {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeIdleConnections?.();
      });
      await Promise.allSettled([...inflight]);
    },
  };
}

// Bắt lỗi nghiêm trọng toàn tiến trình. Novu: bootstrap.ts, lý do: sau unhandled rejection
// trạng thái app không còn đáng tin -> log fatal rồi thoát để orchestrator khởi động lại.
export function installCrashHandlers(log: Logger) {
  process.on('unhandledRejection', (reason) => {
    log.fatal('Unhandled promise rejection', { err: String((reason as Error)?.stack ?? reason) });
    process.exit(1);
  });
}
