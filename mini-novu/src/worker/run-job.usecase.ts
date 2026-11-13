import { infra, type Job } from '../shared/infra-client.ts';
import { createLogger } from '../shared/log.ts';
import { trace } from '../shared/trace.ts';

const log = createLogger('worker');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Lỗi KHÔNG đáng thử lại (số điện thoại sai, dữ liệu hỏng...). Retry cũng vô ích -> đi thẳng DLQ.
// Novu: UnrecoverableError (BullMQ) trong standard.worker.ts
export class UnrecoverableError extends Error {}

// USE CASE xử lý một job. Novu: apps/worker/src/app/workflow/usecases/run-job/run-job.usecase.ts
export async function runJob(job: Job): Promise<void> {
  const { notificationId, requestId } = job.data as { notificationId: string; requestId: string };
  const notification = await infra.dbGet('notifications', notificationId);
  if (!notification) throw new UnrecoverableError(`Không thấy notification ${notificationId}`);

  await infra.dbPatch('notifications', notificationId, { status: 'processing', attempts: job.attemptsMade });
  trace('worker', 'worker.processing', { jobId: job.id, requestId, attempt: job.attemptsMade });
  log.info('xử lý job', { jobId: job.id, requestId, attempt: job.attemptsMade, simulate: notification.simulate });

  // --- Các kịch bản giả lập (để QUAN SÁT hành vi của hệ thống) ---
  switch (notification.simulate) {
    case 'flaky': // nhà cung cấp lỗi tạm thời 2 lần đầu
      if (job.attemptsMade < 3) throw new Error('provider trả 503 (lỗi tạm thời)');
      break;
    case 'always-fail':
      throw new Error('provider luôn lỗi');
    case 'fatal':
      throw new UnrecoverableError('Số điện thoại không hợp lệ (retry vô ích)');
    case 'crash':
      if (job.attemptsMade === 1) {
        // Worker chết đột ngột: KHÔNG ack, KHÔNG fail. Infra sẽ phát hiện nhờ visibility timeout.
        log.fatal('MÔ PHỎNG: worker bị kill giữa chừng', { jobId: job.id });
        trace('worker', 'worker.crashed', { jobId: job.id, requestId });
        process.exit(1);
      }
      break;
    case 'slow':
      await sleep(2500);
      break;
  }

  // Idempotent side effect: giao "at-least-once" nên cùng một job CÓ THỂ chạy 2 lần.
  // Đánh dấu đã gửi để lần chạy lại không gửi trùng email/SMS.
  const firstTime = await infra.kvSetNx(`sent:${notificationId}`, true, 24 * 60 * 60_000);
  if (firstTime) {
    trace('worker', 'worker.sent', { jobId: job.id, requestId, channel: 'email (giả lập)' });
    log.info('đã gửi qua provider (giả lập)', { jobId: job.id, subscriberId: notification.subscriberId });
  } else {
    log.warn('bỏ qua gửi vì đã gửi trước đó (idempotent)', { jobId: job.id });
  }
  await infra.dbPatch('notifications', notificationId, { status: 'sent', sentAt: Date.now() });

  // Báo cho service ws để đẩy realtime tới trình duyệt qua một queue khác.
  await infra.enqueue('web-sockets', {
    jobId: `ws:${notificationId}`,
    data: { subscriberId: notification.subscriberId, notificationId, message: `Thông báo cho ${notification.subscriberId}` },
  });
  trace('worker', 'worker.enqueued_ws', { jobId: job.id, requestId });
}
