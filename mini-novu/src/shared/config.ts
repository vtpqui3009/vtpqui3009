// Cấu hình đọc từ biến môi trường và KIỂM TRA NGAY LÚC KHỞI ĐỘNG (fail fast).
// Novu: apps/api/src/config/env.validators.ts (dùng envalid). Ở đây tự viết để không cần thư viện.

const problems: string[] = [];

function num(name: string, def: number, min = 0): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return def;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min) {
    problems.push(`${name}="${raw}" phải là số >= ${min}`);
    return def;
  }
  return n;
}

export const config = {
  ports: {
    infra: num('INFRA_PORT', 4000, 1),
    api: num('API_PORT', 3000, 1),
    worker: num('WORKER_PORT', 3001, 1),
    ws: num('WS_PORT', 3002, 1),
  },
  // Thời gian tối đa một worker được giữ job trước khi infra giao lại (giống SQS visibility timeout)
  visibilityMs: num('VISIBILITY_MS', 4000, 100),
  // Backoff cơ sở cho retry: lần n chờ backoffMs * 2^(n-1)
  backoffMs: num('BACKOFF_MS', 800, 1),
  maxAttempts: num('MAX_ATTEMPTS', 3, 1),
  workerConcurrency: num('WORKER_CONCURRENCY', 2, 1),
  rateLimit: { capacity: num('RATE_CAPACITY', 8, 1), refillPerSec: num('RATE_REFILL_PER_SEC', 1, 0.01) },
  apiKeys: (process.env.API_KEYS ?? 'demo-key').split(',').map((s) => s.trim()).filter(Boolean),
};

if (config.apiKeys.length === 0) problems.push('API_KEYS không được rỗng');

if (problems.length > 0) {
  // In TẤT CẢ lỗi một lượt rồi dừng, thay vì sửa từng lỗi một.
  console.error(`[config] Cấu hình sai:\n - ${problems.join('\n - ')}`);
  process.exit(1);
}

export const urls = {
  infra: `http://127.0.0.1:${config.ports.infra}`,
  api: `http://127.0.0.1:${config.ports.api}`,
  worker: `http://127.0.0.1:${config.ports.worker}`,
  ws: `http://127.0.0.1:${config.ports.ws}`,
};
