// Log có cấu trúc (JSON một dòng). Luôn gắn requestId/jobId để truy vết xuyên service.
// Novu: dùng Pino + setContext theo class.
export function createLogger(service: string) {
  const write = (level: string) => (msg: string, fields: Record<string, unknown> = {}) =>
    console.log(JSON.stringify({ t: new Date().toISOString(), level, service, msg, ...fields }));
  return { info: write('info'), warn: write('warn'), error: write('error'), fatal: write('fatal') };
}
export type Logger = ReturnType<typeof createLogger>;
