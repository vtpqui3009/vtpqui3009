import { randomUUID } from 'node:crypto';
import { config } from '../shared/config.ts';
import { infra } from '../shared/infra-client.ts';
import { createLogger } from '../shared/log.ts';
import { trace } from '../shared/trace.ts';
import type { TriggerEventCommand } from './validation.ts';

const log = createLogger('api');
const TRANSACTION_TTL = 24 * 60 * 60_000;

// USE CASE: một hành động nghiệp vụ = một class/hàm, nhận Command đã validate.
// Novu: apps/api/src/app/events/usecases/parse-event-request/parse-event-request.usecase.ts
// Việc của API chỉ là: kiểm tra -> ghi DB -> đẩy job -> trả lời. KHÔNG gửi thông báo ở đây.
export class TriggerEvent {
  async execute(cmd: TriggerEventCommand, requestId: string) {
    const transactionId = cmd.transactionId ?? randomUUID();

    // Lớp chống trùng #2: transactionId do client đặt. Trùng => bỏ qua (acknowledged nhưng ignored).
    const first = await infra.kvSetNx(`tx:${transactionId}`, true, TRANSACTION_TTL);
    if (!first) {
      trace('api', 'api.ignored_duplicate', { requestId, transactionId });
      return { acknowledged: true, status: 'ignored' as const, transactionId, reason: 'transactionId đã dùng' };
    }

    const notificationId = randomUUID();
    await infra.dbInsert('notifications', {
      id: notificationId, transactionId, workflowId: cmd.workflowId, subscriberId: cmd.subscriberId,
      simulate: cmd.simulate, status: 'queued', attempts: 0, createdAt: Date.now(),
    });

    // Lớp chống trùng #3: jobId cố định, queue sẽ không nhận hai job cùng id.
    const { deduped } = await infra.enqueue('standard', {
      jobId: `notif:${notificationId}`,
      data: { notificationId, payload: cmd.payload, requestId },
      maxAttempts: config.maxAttempts,
    });
    trace('api', 'api.enqueued', { requestId, notificationId, jobId: `notif:${notificationId}`, deduped });
    log.info('đã đẩy job', { requestId, notificationId, transactionId });
    return { acknowledged: true, status: 'processed' as const, transactionId, notificationId };
  }
}
