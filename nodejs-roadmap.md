# Roadmap Node.js: từ chưa có kinh nghiệm đến mức kiến thức của dev ~2 năm

> Giả định: bạn đã có nền backend (Java/Spring, SQL, Docker, AWS cơ bản) nên **không học lại từ số 0**, chỉ chuyển sang hệ sinh thái Node.
> Thực tế cần nói thẳng: lộ trình này giúp bạn **có kiến thức và phản xạ** của dev 2 năm. Nó không thay thế được 2 năm làm thật. Cách bù là làm sản phẩm thật nhỏ mỗi tuần và tự giải thích lại.
> Giả định thời gian: ~2 giờ mỗi ngày làm việc, 8 tuần. Cần nhanh hơn thì xem "Đường tắt 2 tuần" ở cuối.

---

## 1. "Dev 2 năm Node" biết và làm được gì?

```
 Nền tảng          Làm API           Dữ liệu          Chất lượng        Vận hành
 ────────          ───────           ───────          ──────────        ────────
 JS/TS sâu         Express/Fastify   SQL + ORM        Unit + API test   Log, metric
 Event loop        / NestJS          Transaction      Mock đúng chỗ     Docker, CI
 Async/stream      Validate, auth    Index, N+1       Code review       Config, secret
 Lỗi, memory       Lỗi chuẩn hóa     Redis cache      Debug production  AWS Lambda/SQS
                                     Migration
                      └───────── Hàng đợi, retry, idempotency (mini-novu) ─────────┘
```

Dấu hiệu bạn đạt mức này: không chỉ *viết được*, mà **giải thích được vì sao**, và **đoán được chỗ nào sẽ hỏng**.

---

## 2. Kế hoạch 8 tuần

| Tuần | Chủ đề | Bắt buộc học | Sản phẩm nộp (vào repo) |
|---|---|---|---|
| **1** | JS/TS cốt lõi | closure, `this`, prototype, Promise, async/await, event loop; TS: type narrowing, generics, utility types, `unknown` vs `any` | CLI nhỏ gọi API song song có giới hạn (tự viết hàm `pLimit`) |
| **2** | Node runtime | CJS vs ESM, `fs`, **stream** và backpressure, Buffer, `EventEmitter`, `process` signal, `worker_threads`, xử lý lỗi | Đọc file log 1 GB bằng stream, đếm lỗi theo giờ, không tràn RAM |
| **3** | HTTP API | Express **hoặc** Fastify, middleware, validate bằng zod, format lỗi chuẩn, auth JWT, phân trang, OpenAPI | REST API "orders" có auth, validate, lỗi chuẩn |
| **4** | Dữ liệu | Postgres + Prisma (hoặc `pg`), transaction, index, N+1, migration, Redis cache, kết nối pool | Mở rộng API tuần 3: transaction đặt hàng, cache, migration |
| **5** | Test và chất lượng | Vitest/Jest, supertest, mock vs fake, test với DB thật (container), coverage hợp lý, ESLint/Prettier, pino log | Bộ test cho API tuần 3-4, chạy được trong CI |
| **6** | Bất đồng bộ và queue | BullMQ hoặc SQS, retry/backoff, idempotency, DLQ, outbox, graceful shutdown | **Làm lại 1 phần `mini-novu` từ trắng** (không nhìn code) rồi thêm tính năng "digest" |
| **7** | AWS cho Node | Lambda + API Gateway + SQS + DynamoDB bằng SAM hoặc CDK, cold start, IAM tối thiểu, CloudWatch | Triển khai API nhỏ lên AWS bằng IaC, có DLQ |
| **8** | Hiệu năng, bảo mật, ôn tập | profiling (`--cpu-prof`, clinic), memory leak, OWASP top 10, `npm audit`, rate limit, ôn phỏng vấn | Sửa 1 lỗi hiệu năng cố ý, viết bài tổng kết kiến trúc 1 trang |

**Nhịp mỗi ngày (2 giờ):** 20 phút đọc, 80 phút code, 20 phút tự giải thích lại bằng lời. Mỗi tuần tick một lần ở mục 4.

---

## 3. Chi tiết theo từng mảng (để biết "đủ sâu" là gì)

### 3.1 JS/TS và event loop
- Phải giải thích được thứ tự: `console.log` → `process.nextTick` → microtask (Promise) → `setTimeout` → `setImmediate`.
- Vì sao vòng lặp CPU nặng làm cả server đứng? Cách xử lý: `worker_threads`, tách service, queue.
- TS: `strict`, discriminated union, `satisfies`, `Awaited`, `Pick/Omit/Partial`, type guard.

### 3.2 Node runtime
- Stream, backpressure, `pipeline`. `Buffer` và encoding.
- `unhandledRejection` và `uncaughtException`: vì sao nên log fatal rồi thoát (đã thấy trong Novu).
- Tắt êm: `SIGTERM`, đóng server, chờ request đang chạy.
- Rò bộ nhớ: closure giữ tham chiếu, listener không gỡ, cache không giới hạn.

### 3.3 API
- Express middleware chạy theo thứ tự; lỗi async phải được chuyển vào `next(err)` (Express 5 tự bắt).
- Chọn framework: **Express** (phổ biến nhất), **Fastify** (nhanh, schema), **NestJS** (cấu trúc kiểu Spring, Novu dùng). Bạn quen Spring nên **NestJS dễ vào nhất**, nhưng hãy làm một API bằng Express/Fastify trước để hiểu bên dưới.
- Chuẩn hóa: mã lỗi, `requestId`, validate đầu vào, versioning, rate limit, idempotency key.

### 3.4 Dữ liệu
- Bạn đã biết SQL: tập trung vào **cách Node giữ kết nối** (pool), transaction trong ORM, và **N+1 trong Prisma/TypeORM**.
- Redis: cache có TTL, khóa phân tán đơn giản, `SET NX`.
- Migration: không sửa DB tay, luôn có đường lùi.

### 3.5 Test
- Pyramid: nhiều unit nhanh, ít integration, rất ít e2e.
- Mock ranh giới ngoài (HTTP, queue), **không mock DB** nếu chạy được container.
- Test thời gian bằng fake timer (retry/backoff).

### 3.6 Queue và hệ phân tán (phần bạn đã có mini-novu)
- At-least-once nghĩa là phải idempotent. Ba lớp chống trùng. Visibility timeout. Backoff mũ.
- Outbox pattern: ghi DB và đẩy event không mất một trong hai.

### 3.7 AWS với Node/TS
- Lambda: cold start, tái sử dụng kết nối ngoài handler, timeout nhỏ hơn visibility timeout của SQS (ít nhất bằng 6 lần là khuyến nghị thường gặp, hãy tra tài liệu AWS hiện hành để chắc).
- IaC: SAM hoặc CDK (TypeScript hợp với bạn), không click tay trên console.
- Quyền tối thiểu cho IAM role.

### 3.8 Vận hành
- Log có cấu trúc (pino), gắn requestId. Health: live khác ready. Config qua env và kiểm tra lúc khởi động.
- Docker multi-stage, chạy không dùng root, `node` chứ không `npm start` làm PID 1 (tín hiệu tắt).

---

## 4. Checklist theo tuần (tick khi tự giải thích được, không nhìn tài liệu)

- [ ] **T1** Giải thích event loop trong 2 phút và dự đoán đúng thứ tự in ra của 5 đoạn code mẫu
- [ ] **T2** Giải thích backpressure; chạy được bài stream 1 GB dưới 100 MB RAM
- [ ] **T3** API có auth, validate, lỗi chuẩn; có tài liệu OpenAPI
- [ ] **T4** Chỉ ra và sửa một N+1; có transaction đặt hàng đúng
- [ ] **T5** Test chạy trong CI; mock đúng chỗ
- [ ] **T6** Làm lại mini-novu không nhìn code; giải thích 3 lớp chống trùng
- [ ] **T7** Deploy Lambda+SQS+DLQ bằng IaC, gọi thật và xem log
- [ ] **T8** Bài tổng kết 1 trang + phỏng vấn thử 20 câu

## 5. Tự kiểm tra đầu vào (làm ngay hôm nay, 15 phút, ghi lại câu nào chưa chắc)

1. `await` trong `forEach` có chờ không? Vì sao?
2. Khác nhau `Promise.all`, `allSettled`, `race`, `any`?
3. Thứ tự: `setTimeout(0)`, `setImmediate`, `process.nextTick`, `Promise.then`?
4. `require` vs `import`: khác gì khi chạy Node?
5. Một request làm vòng lặp 5 giây, các request khác bị sao?
6. Stream giải quyết vấn đề gì so với `readFile`?
7. `unknown` khác `any` thế nào? Khi nào dùng generics?
8. Làm sao tắt server êm khi nhận SIGTERM?
9. Cách phát hiện N+1?
10. Vì sao job queue phải idempotent?

Gửi tôi các câu bạn trả lời sai hoặc không chắc, tôi sẽ chỉnh lộ trình tập trung vào đó.

---

## 6. Đường tắt 2 tuần (nếu dự án bắt đầu sớm)

```
 Ngày 1-3   JS/TS + event loop + async      (bắt buộc, nền của mọi thứ)
 Ngày 4-6   Express/Nest API + validate + lỗi
 Ngày 7-9   Postgres/ORM + transaction + N+1
 Ngày 10-11 Jest/Vitest + supertest
 Ngày 12-14 Queue + retry + idempotency (mini-novu) + Lambda cơ bản
```
Bỏ qua tạm: worker_threads, CDK, profiling sâu. Bổ sung sau khi vào dự án.

## 7. Tài liệu (nên tra phiên bản hiện hành trước khi học)

- Node.js docs và hướng dẫn chính thức: nodejs.org/learn
- TypeScript Handbook: typescriptlang.org/docs
- MDN: Promise, async/await, event loop
- Sách: *Node.js Design Patterns* (Casciaro, Mammino), *You Don't Know JS Yet*
- AWS: tài liệu Lambda, SQS (mục "Best practices"), SAM/CDK

## 8. Về CV

CV hiện ghi dự án có Node.js/TypeScript. Bạn nên chuẩn bị để **giải thích rõ phần mình thật sự đã làm** và phần mình đang học thêm. Nói đúng mức độ sẽ an toàn hơn trong phỏng vấn, và lộ trình này giúp bạn phủ khoảng trống đó.
