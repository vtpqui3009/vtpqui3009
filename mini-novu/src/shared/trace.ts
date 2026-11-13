import { urls } from './config.ts';

// Gửi "sự kiện quan sát" về service ws để dashboard vẽ lại luồng chạy.
// Đây chỉ phục vụ HỌC: bắn rồi quên (fire-and-forget), lỗi thì bỏ qua, không ảnh hưởng logic thật.
export function trace(service: string, type: string, fields: Record<string, unknown> = {}): void {
  fetch(`${urls.ws}/internal/trace`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ t: Date.now(), service, type, ...fields }),
  }).catch(() => {});
}
