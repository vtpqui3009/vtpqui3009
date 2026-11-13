# mini-novu: học luồng microservice bằng cách chạy thật

Workspace nhỏ mô phỏng cách Novu (`novuhq/novu`) tổ chức `api -> queue -> worker -> ws`.
**Không cần cài thư viện runtime** (Node.js >= 22.18 chạy TypeScript trực tiếp). Chỉ có `typescript` để kiểm tra kiểu.

## Chạy

```bash
npm run dev      # bật 4 service, mở http://localhost:3002 để xem dashboard
npm test         # 10 test end-to-end cho mọi kịch bản
npm run typecheck
```

Gọi thử bằng curl:

```bash
curl -i -X POST localhost:3000/v1/events/trigger \
  -H 'authorization: ApiKey demo-key' -H 'content-type: application/json' \
  -d '{"workflowId":"welcome","to":{"subscriberId":"alice"}}'
```

## Kiến trúc

```
                       ┌──────────────── infra :4000 (giả lập Redis/SQS + Mongo) ────────────────┐
                       │   queue "standard"      queue "web-sockets"      DB (notifications)     │
                       │   KV có TTL (khóa idempotency, transactionId, "đã gửi")                 │
                       └───▲───────────▲─────────────▲──────────────▲────────────────────────────┘
                           │           │             │              │
 Client ──HTTP──► api :3000┘   worker :3001 ─────────┘     ws :3002 ┘──SSE──► Trình duyệt / dashboard
                  │   (đẩy job)   (lấy job, gửi, ack/fail,      (lấy tin, đẩy realtime,
                  │                retry, đẩy tin sang ws)        phục vụ dashboard)
          Chuỗi xử lý request:
          requestId → giới hạn body → auth → rate limit → idempotency → validate → use case → 202
```

| Service | Thư mục | Việc chính | Tương ứng trong Novu |
|---|---|---|---|
| infra | `src/infra` | queue (retry/DLQ/visibility timeout), DB, KV | Redis + BullMQ/SQS + MongoDB |
| api | `src/api` | nhận request, đẩy job, trả 202 | `apps/api` |
| worker | `src/worker` | xử lý job, retry, gửi | `apps/worker` |
| ws | `src/ws` | đẩy realtime + dashboard | `apps/ws` |
| shared | `src/shared` | config, log, router, client | `libs/application-generic` |

## Vòng đời một job

```
 enqueue ─► waiting ─pull─► active ─ack──────────────────────► (xóa)
                ▲             │
                │             ├─fail, còn lượt ─► waiting (chờ backoff × 2^(n-1))
                │             ├─fail, hết lượt / lỗi không thể retry ─► dead (DLQ)
                └─────────────┴─quá visibility timeout (worker chết) ─► coi như fail
```

## 8 kịch bản (bấm trong dashboard, hoặc xem trong `test/e2e.test.ts`)

| # | Kịch bản | Học được gì | Xem ở code |
|---|---|---|---|
| 1 | Bình thường | API trả 202 ngay, việc nặng ở worker | `api/main.ts`, `worker/run-job.usecase.ts` |
| 2 | `flaky` | Retry + backoff mũ, thành công ở lần 3 | `infra/main.ts` `failJob` |
| 3 | `fatal` | Lỗi không thể retry đi thẳng DLQ | `UnrecoverableError` |
| 4 | `always-fail` | Hết lượt thì vào DLQ | `maxAttempts` |
| 5 | `crash` | Worker chết, job không mất (visibility timeout) | reaper trong `infra/main.ts` |
| 6 | Idempotency-Key | Chống trùng ở tầng HTTP | `api/middlewares.ts` |
| 7 | transactionId | Chống trùng ở tầng nghiệp vụ | `api/trigger-event.usecase.ts` |
| 8 | 15 request liền | Rate limit, bảo vệ hệ thống phía sau | `throttle` |

Ba lớp chống trùng, từ ngoài vào trong: **Idempotency-Key** (HTTP) → **transactionId** (nghiệp vụ) → **jobId** (queue).

## Các ý quan trọng

- **At-least-once**: queue có thể giao một job hai lần (worker chết sau khi gửi, trước khi ack). Vì vậy việc gửi phải idempotent: xem `sent:<id>` trong `run-job.usecase.ts`.
- **Ack có receipt**: ack muộn từ worker cũ bị từ chối (409) vì job đã giao cho worker khác.
- **Ack sau khi làm xong**, không ack trước.
- **Tắt êm**: ngừng nhận việc mới, chờ việc đang chạy xong (`main.ts` của mỗi service).
- **Fail fast**: cấu hình sai thì dừng ngay và in hết lỗi (`shared/config.ts`).
- **Health**: `/health/live` (còn sống?) khác `/health` (sẵn sàng nhận traffic, kiểm tra phụ thuộc).

## Khác với Novu thật (đừng nhầm)

- `infra` là bản **giả lập trong một process**, dữ liệu mất khi tắt. Novu dùng Redis/SQS + MongoDB thật.
- Rate limit ở đây nằm trong RAM của một api instance. Chạy nhiều instance thì phải để ở Redis dùng chung.
- ws dùng SSE thay vì socket.io; không có xác thực JWT cho subscriber.
- Không có multi-tenant, workflow nhiều bước, digest, delay, provider thật.
- Router/middleware tự viết cho dễ đọc; dự án thật thường dùng NestJS/Express/Fastify.

## Bài tập gợi ý

1. Đặt `MAX_ATTEMPTS=5 BACKOFF_MS=200`, chạy kịch bản 4 và đếm thời gian chờ giữa các lần.
2. Tắt `infra` khi đang chạy: api và worker xử lý thế nào? `/health` trả gì?
3. Thêm kênh `sms` song song với `email` trong `run-job.usecase.ts`, giữ nguyên tính idempotent.
4. Thêm job `digest` có `availableAt` ở tương lai (job trễ).
5. Chạy hai worker (`WORKER_PORT` khác nhau) và quan sát job được chia thế nào.
