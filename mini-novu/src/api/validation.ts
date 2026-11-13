import { HttpError } from '../shared/router.ts';

// Command = dữ liệu đầu vào ĐÃ ĐƯỢC KIỂM TRA của một use case.
// Novu dùng class-validator (@IsDefined, @IsString...). Ở đây viết tay cho dễ thấy bản chất.
export type Simulate = 'ok' | 'flaky' | 'fatal' | 'always-fail' | 'crash' | 'slow';
const SIMULATIONS: Simulate[] = ['ok', 'flaky', 'fatal', 'always-fail', 'crash', 'slow'];

export type TriggerEventCommand = {
  workflowId: string;
  subscriberId: string;
  transactionId?: string;
  payload: Record<string, unknown>;
  simulate: Simulate;
};

export function parseTriggerBody(body: any): TriggerEventCommand {
  const errors: string[] = [];
  if (typeof body?.workflowId !== 'string' || !body.workflowId) errors.push('workflowId: bắt buộc, kiểu string');
  if (typeof body?.to?.subscriberId !== 'string' || !body.to.subscriberId) errors.push('to.subscriberId: bắt buộc, kiểu string');
  if (body?.transactionId !== undefined && typeof body.transactionId !== 'string') errors.push('transactionId: phải là string');
  if (body?.payload !== undefined && (typeof body.payload !== 'object' || body.payload === null)) errors.push('payload: phải là object');
  const simulate = body?.simulate ?? 'ok';
  if (!SIMULATIONS.includes(simulate)) errors.push(`simulate: một trong ${SIMULATIONS.join(', ')}`);
  if (errors.length) throw new HttpError(422, 'Dữ liệu không hợp lệ', errors);
  return {
    workflowId: body.workflowId,
    subscriberId: body.to.subscriberId,
    transactionId: body.transactionId,
    payload: body.payload ?? {},
    simulate,
  };
}
