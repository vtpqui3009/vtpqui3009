# Học Node.js microservice qua Novu (open-source)

> Nguồn: code thật của `novuhq/novu` (clone nông, ngày 2026-11-13).
> Quy ước: **[Đọc]** = tôi đã mở file và thấy trong code. **[Suy ra]** = tôi đoán lý do, chưa có bằng chứng trong code.
> Novu là hệ thống gửi thông báo (email, SMS, push, in-app). Dùng nó vì có nhiều service Node + TypeScript chạy riêng, tổ chức như một dự án thật.

---

## 1. Bức tranh tổng thể

```
 Client ──HTTP──► [ api ] ──đẩy job──► ( Queue: Redis/BullMQ hoặc SQS ) ──► [ worker ]
                    │                                                         │
                    │                                                         ├─► gửi email/SMS/push
                    ▼                                                         ▼
                 MongoDB  ◄──────────── cả hai cùng đọc/ghi ───────────────  MongoDB
                                                                              │
 Browser ◄──WebSocket── [ ws ] ◄──── queue "web-sockets" ◄────────────────────┘
 Nhà cung cấp ──webhook──► [ webhook ]
```

| Service | Thư mục | Làm gì |
|---|---|---|
| **api** | `apps/api` | Nhận request, kiểm tra, ghi DB, **đẩy job vào queue rồi trả lời ngay** |
| **worker** | `apps/worker` | Lấy job từ queue, làm việc nặng (render, gửi), retry khi lỗi |
| **ws** | `apps/ws` | Giữ kết nối WebSocket (socket.io) để đẩy thông báo thời gian thực |
| **webhook** | `apps/webhook` | Nhận webhook gửi vào hệ thống |
| **libs/application-generic** | `libs/application-generic` | Code dùng chung: queue, cache, logging, health, throttle… |
| **libs/dal** | `libs/dal` | Lớp truy cập DB (repository) |
| **packages/shared** | `packages/shared` | Type, enum dùng chung |

**Ý chính cần nhớ:** API **không** làm việc nặng. Nó nhận, ghi, đẩy job, trả lời. Worker làm phần còn lại. Nhờ vậy API luôn nhanh và job lỗi có thể thử lại.

---

## 2. Một request đi qua hệ thống (trigger thông báo)

```
POST /v1/events/trigger
   │
   ▼
[Middleware]  RequestId ─► helmet ─► CORS ─► body-parser (giới hạn theo route)
   ▼
[Guard]       Xác thực + RequirePermissions(EVENT_WRITE) + Throttler (rate limit)
   ▼
[Interceptor] Idempotency (POST/PATCH) ─► Response wrapper
   ▼
[Pipe]        ValidationPipe (class-validator)
   ▼
[Controller]  events.controller.ts  (mỏng, chỉ gọi use case)
   ▼
[UseCase]     ParseEventRequest ─► kiểm tra payload theo schema ─► đẩy job vào queue
   ▼
   trả 200 ngay            ← worker xử lý ở phía sau
```

**[Đọc]** `apps/api/src/app/events/events.controller.ts` (decorator `@ThrottlerCategory`, `@RequirePermissions`, `@Post('/trigger')`) và `parse-event-request.command.ts` (Command có `@IsDefined`, `@IsString`…).

---

## 3. Best practices rút ra từ code (kèm chỗ để xem)

### 3.1 Cấu trúc code
| # | Practice | Bằng chứng |
|---|---|---|
| 1 | **Monorepo**, mỗi service một app, code dùng chung ở `libs/` | `apps/*`, `libs/*`, `pnpm-workspace.yaml`, `nx.json` |
| 2 | **Use case + Command**: mỗi hành động nghiệp vụ là một class; input là Command có validate | `events/usecases/parse-event-request/*` |
| 3 | **Controller mỏng**, logic nằm ở use case | `events.controller.ts` |
| 4 | **Repository** cho DB, không gọi DB rải rác | `libs/dal/src/repositories` |
| 5 | Thư viện dùng chung gom một chỗ để service nào cũng dùng cùng một cách | `libs/application-generic` |

### 3.2 Khởi động an toàn (`apps/api/src/bootstrap.ts`)
| # | Practice | Ghi chú |
|---|---|---|
| 6 | **Kiểm tra biến môi trường lúc khởi động** (envalid), thiếu là dừng ngay | `config/env.validators.ts` **[Đọc]** |
| 7 | **Nạp secret trước, rồi mới nạp app** | `main.ts`: `runWithHydratedSecrets` **[Đọc]** |
| 8 | **Bật giám sát trước mọi thứ** (`import './instrument'` dòng đầu) để đo được từ đầu | **[Đọc]** |
| 9 | **Unhandled rejection → log mức fatal rồi `process.exit(1)`** | Comment trong code giải thích: trạng thái app không còn đáng tin **[Đọc]** |
| 10 | `enableShutdownHooks()` để tắt êm khi deploy | **[Đọc]** |
| 11 | `keepAliveTimeout` 61s, `headersTimeout` 65s | **[Suy ra]** đặt lớn hơn timeout 60s của load balancer để tránh lỗi 502 ngẫu nhiên |
| 12 | Giới hạn body riêng cho route cần (30 MB), còn lại mặc định | `extendedBodySizeRoutes` **[Đọc]** |
| 13 | TLS tùy chọn qua cấu hình | `loadNovuTlsConfig` **[Đọc]** |

### 3.3 Bảo vệ API
| # | Practice | Bằng chứng |
|---|---|---|
| 14 | `helmet()`, CORS cấu hình riêng | `bootstrap.ts` |
| 15 | **Versioning bằng URI** (`/v1/...`) | `app.enableVersioning` |
| 16 | **Request ID** gắn từ sớm để truy vết log | `RequestIdMiddleware` |
| 17 | **Rate limit theo loại và chi phí** (bulk tốn hơn) | `@ThrottlerCategory`, `@ThrottlerCost` |
| 18 | **Phân quyền khai báo trên route** | `@RequirePermissions(PermissionsEnum.EVENT_WRITE)` |
| 19 | **Idempotency**: POST/PATCH lặp lại không chạy hai lần; lưu trạng thái `in-progress` / `success` / `error`, cache 24h (đang xử lý: 5 phút) | `idempotency.interceptor.ts` **[Đọc]** |
| 20 | **`transactionId`** để loại trigger trùng | mô tả trong controller **[Đọc]** |
| 21 | Bộ lọc lỗi toàn cục + format phản hồi thống nhất | `AllExceptionsFilter`, `ResponseInterceptor` |

### 3.4 Queue và xử lý nền (phần quan trọng nhất)
| # | Practice | Bằng chứng |
|---|---|---|
| 22 | **Tách theo hàng đợi riêng**: standard, workflow, subscriber-process, web-sockets, inbound-parse | `services/queues/*` **[Đọc]** |
| 23 | **Chọn backend queue bằng cấu hình** (BullMQ/Redis hoặc SQS), có hàm kiểm tra cấu hình lúc boot | `assertQueueBackendConfig` **[Đọc]** |
| 24 | **Retry có giới hạn + backoff**: inbound-parse thử 5 lần, nền 4000 ms | `inbound-parse-queue.service.ts` **[Đọc]** |
| 25 | **SQS redrive `maxReceiveCount=3` khớp với `attempts: 3`** để hai cơ chế retry không lệch nhau | comment trong `standard.worker.ts` **[Đọc]** |
| 26 | **`jobId` mặc định = tên job** để job trùng bị loại | `standard-queue.service.ts` **[Đọc]** |
| 27 | `removeOnComplete/removeOnFail: true` để Redis không phình | `bull-mq.service.ts` **[Đọc]** |
| 28 | Worker phân biệt lỗi **không thể retry** (`UnrecoverableError`) và lỗi tạm thời | `standard.worker.ts` **[Đọc]** |
| 29 | **Worker có HTTP port** (health) và bước "cold start" khởi tạo hạ tầng trước khi nhận job | `prepareAppInfra` / `startAppInfra` **[Đọc]** |

### 3.5 Vận hành
| # | Practice | Bằng chứng |
|---|---|---|
| 30 | **Health check theo từng phụ thuộc**: DB, cache, từng queue | `libs/application-generic/src/health/*` **[Đọc]** |
| 31 | Log có cấu trúc (Pino), ngữ cảnh gắn theo class | `PinoLogger.setContext` **[Đọc]** |
| 32 | Chạy local bằng docker-compose: Mongo + Redis + LocalStack (giả lập S3) | `docker/local/docker-compose.yml` **[Đọc]** |
| 33 | Test: `*.spec.ts` (unit) tách khỏi `*.e2e.ts` | khắp repo **[Đọc]** |

---

## 4. Vòng đời một job (cần nắm cho phỏng vấn và debug)

```
 api đẩy job ──► [WAITING] ──worker lấy──► [ACTIVE] ──ok──► [COMPLETED] ──► xóa (removeOnComplete)
                                              │
                                             lỗi
                                              ▼
                          còn lượt thử? ──có──► chờ backoff ──► [WAITING] lại
                                │
                               không
                                ▼
                    [FAILED] ──► log + đánh dấu job lỗi (SetJobAsFailed)
```

Câu hỏi tự kiểm tra:
1. Worker chết giữa chừng thì job đi đâu?
2. Hai worker có xử lý cùng một job không? Vì sao `jobId` cố định giúp ích?
3. Gửi trigger 2 lần liên tiếp thì chuyện gì xảy ra? (idempotency vs `transactionId`)
4. Vì sao API trả lời trước khi gửi xong email?

---

## 5. Nếu dự án mới không dùng NestJS

Khái niệm giống nhau, chỉ khác tên:

| Novu (NestJS) | Express/Fastify thuần |
|---|---|
| Guard | middleware xác thực/phân quyền |
| Interceptor | middleware bọc request/response |
| Pipe + class-validator | zod / joi / ajv |
| Module + DI | tự nối dependency, hoặc tsyringe/awilix |
| Use case + Command | giữ nguyên: một hàm/class cho mỗi hành động |

---

## 6. Lộ trình đọc code (nên đi đúng thứ tự)

```
 Giờ 1   apps/api/src/main.ts → bootstrap.ts          (app khởi động thế nào)
 Giờ 2   events.controller.ts → parse-event-request   (một request đi qua đâu)
 Giờ 3   libs/application-generic/src/services/queues (đẩy job)
 Giờ 4   apps/worker/.../standard.worker.ts           (nhận job, retry, lỗi)
 Giờ 5   idempotency.interceptor.ts                   (chống chạy trùng)
 Giờ 6   health/*  + docker/local                     (vận hành và chạy local)
```

## 7. Ngày đầu ở dự án mới: danh sách việc

- [ ] Tìm: service nào đẩy job, service nào xử lý job, queue là gì (Redis/SQS/Kafka).
- [ ] Tìm file khởi động, xem cách validate env và xử lý lỗi toàn cục.
- [ ] Tìm chỗ xử lý idempotency và retry. Hỏi: "job lỗi thì đi đâu?"
- [ ] Chạy local bằng docker-compose, gọi thử một API và xem log theo request ID.
- [ ] Đọc một use case/handler hoàn chỉnh và viết lại sơ đồ luồng bằng lời của mình.
- [ ] Viết một unit test nhỏ theo mẫu có sẵn trước khi sửa code thật.

---

## 8. Chưa kiểm chứng

- Chưa chạy Novu, chỉ đọc code. Các điểm **[Suy ra]** cần kiểm tra nếu muốn chắc.
- Chưa đọc kỹ tên header của idempotency và chi tiết khóa cache.
- Chưa xem `apps/ws` và `apps/webhook` sâu; mới thấy cấu trúc và gateway socket.io.
- Novu là hệ thống thông báo; dự án của bạn có thể khác miền nghiệp vụ. Hãy lấy **mẫu thiết kế**, không lấy chi tiết riêng của Novu.
