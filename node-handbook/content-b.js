/* Nội dung phần 2: dữ liệu, bất đồng bộ và phân tán, test. */
(function (NH) {
  const nd = NH.nd;
  const T = (o) => NH.topics.push(o);

  /* ================= Dữ liệu ================= */
  T({ id: 'sql-core', a: 'data', t: 'SQL từ Node: pool, transaction, N+1, index', lv: 2,
    sum: 'Phần lớn sự cố hiệu năng backend nằm ở đây: kết nối, truy vấn lặp, thiếu index.',
    flow: [['Request cần dữ liệu', 'nhiều request đồng thời'], ['Lấy kết nối từ pool', 'hết thì xếp hàng chờ'], ['Chạy query', 'tham số hóa, có timeout'], ['Transaction nếu cần', 'BEGIN … COMMIT trên cùng kết nối'], ['Trả kết nối', 'release trong finally']],
    dgs: [{ w: 720, h: 150, nodes: [nd('a', 10, 20, 340, 52, '1 query lấy 100 đơn hàng\n+ 100 query lấy user từng đơn = 101 query', 'bad'), nd('b', 370, 20, 340, 52, '1 query JOIN\nhoặc 2 query: đơn + WHERE id IN (...)', 'ok'), nd('c', 10, 90, 700, 44, 'Mỗi query tốn một vòng mạng tới DB. 101 vòng mạng chậm hơn 1 vòng nhiều lần dù mỗi query rất nhanh.', 'm')] }],
    pts: ['Pool: tái sử dụng kết nối. Tổng kết nối = pool × số instance, không được vượt giới hạn DB (dùng pgbouncer/RDS Proxy khi nhiều instance).', 'Luôn <code>release()</code> trong <code>finally</code>; transaction phải dùng cùng một kết nối; giữ transaction ngắn, không gọi HTTP bên ngoài bên trong.', 'N+1: phát hiện bằng đếm query mỗi request (bật log query); sửa bằng JOIN, <code>IN (...)</code>, <code>include</code> của ORM hoặc DataLoader.', 'Index cho cột lọc, join, sắp xếp; thứ tự cột trong index kép quan trọng; kiểm chứng bằng <code>EXPLAIN ANALYZE</code>. Index làm chậm ghi và tốn dung lượng.', 'Luôn query tham số hóa. Đặt <code>statement_timeout</code> để một query xấu không giữ kết nối mãi.', 'ORM tiện nhưng che SQL: biết SQL nó sinh ra, và dùng SQL thuần cho truy vấn phức tạp.'],
    qa: [['N+1 query là gì?', '1 query lấy danh sách rồi N query lấy chi tiết từng phần tử. Sửa bằng JOIN, hoặc 2 query với WHERE id IN (...), hoặc DataLoader / include của ORM.'], ['Connection pool để làm gì và đặt kích thước thế nào?', 'Tái sử dụng kết nối thay vì mở mới mỗi query. Kích thước theo giới hạn DB chia cho số instance, cộng thêm biên an toàn.'], ['Khi nào thêm index?', 'Cột hay lọc, join, sắp xếp. Kiểm bằng EXPLAIN ANALYZE (Seq Scan sang Index Scan). Đổi lại ghi chậm hơn và tốn dung lượng.']],
    code: { t: 'Thấy N+1 qua số query (DB giả)', lang: 'js', src: `let soQuery = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const db = {
  async orders() { soQuery++; await sleep(5); return Array.from({ length: 30 }, (_, i) => ({ id: i, userId: i % 5 })); },
  async user(id) { soQuery++; await sleep(5); return { id, ten: 'user' + id }; },
  async usersIn(ids) { soQuery++; await sleep(5); return ids.map((id) => ({ id, ten: 'user' + id })); },
};
let t = performance.now(); soQuery = 0;
const ds = await db.orders();
for (const o of ds) o.user = await db.user(o.userId);                        // N+1
console.log('N+1  :', soQuery, 'query,', Math.round(performance.now() - t), 'ms');

t = performance.now(); soQuery = 0;
const ds2 = await db.orders();
const us = await db.usersIn([...new Set(ds2.map((o) => o.userId))]);         // 2 query
const theoId = new Map(us.map((u) => [u.id, u]));
for (const o of ds2) o.user = theoId.get(o.userId);
console.log('Batch:', soQuery, 'query,', Math.round(performance.now() - t), 'ms');` } });

  T({ id: 'isolation', a: 'data', t: 'Isolation, khóa, optimistic locking và deadlock', lv: 5,
    sum: 'Hai request cùng sửa một dòng là bài toán thật. Biết chọn khóa hay phiên bản và xử lý xung đột.',
    flow: [['Đọc dòng kèm version', 'version = 7'], ['Tính toán', 'trong bộ nhớ'], ['UPDATE ... WHERE id AND version = 7', 'tăng version thành 8'], ['Số dòng bị ảnh hưởng = 1', 'thành công'], ['Số dòng = 0', 'có người sửa trước: đọc lại và thử lại']],
    pts: ['Postgres mặc định <b>Read Committed</b>; MySQL InnoDB mặc định <b>Repeatable Read</b>. Serializable an toàn nhất nhưng phải retry khi lỗi serialization.', 'Hiện tượng: dirty read, non-repeatable read, phantom, write skew. Mức cao hơn ngăn nhiều hiện tượng hơn, đổi lấy xung đột nhiều hơn.', '<b>Optimistic</b> (cột version, so sánh khi ghi): hợp xung đột hiếm. <b>Pessimistic</b> (<code>SELECT ... FOR UPDATE</code>): hợp xung đột thường xuyên, nhưng giữ khóa lâu.', '<code>FOR UPDATE SKIP LOCKED</code> cho hàng đợi việc trong DB; advisory lock cho khóa theo khóa nghiệp vụ.', 'Deadlock: khóa theo thứ tự nhất quán, giữ transaction ngắn, và thử lại khi DB báo deadlock.', 'Ràng buộc unique là công cụ chống trùng mạnh và rẻ.'],
    qa: [['Optimistic và pessimistic locking?', 'Optimistic: không khóa, đọc kèm version và chỉ ghi nếu version chưa đổi; xung đột thì thử lại. Hợp khi xung đột hiếm. Pessimistic: khóa dòng khi đọc (FOR UPDATE); hợp khi xung đột nhiều nhưng giảm thông lượng.'], ['Làm sao tránh bán trùng hàng tồn kho?', 'UPDATE có điều kiện nguyên tử (stock = stock - 1 WHERE stock > 0), hoặc khóa dòng, hoặc ràng buộc CHECK; kiểm số dòng bị ảnh hưởng.'], ['Phòng deadlock thế nào?', 'Khóa tài nguyên theo cùng một thứ tự ở mọi nơi, transaction ngắn, và retry khi gặp deadlock.']],
    code: { t: 'Optimistic locking với bảng giả', lang: 'js', src: `const bang = new Map([[1, { id: 1, soDu: 100, version: 1 }]]);
const doc = (id) => ({ ...bang.get(id) });
function ghi(id, moi, versionDaDoc) {                         // giống UPDATE ... WHERE version = ?
  const cur = bang.get(id);
  if (cur.version !== versionDaDoc) return 0;                  // 0 dòng bị ảnh hưởng
  bang.set(id, { ...moi, version: cur.version + 1 });
  return 1;
}
async function rut(id, soTien, ten) {
  for (let lan = 1; lan <= 5; lan++) {
    const r = doc(id);
    await new Promise((res) => setTimeout(res, Math.random() * 10));   // giả lập độ trễ giữa đọc và ghi
    if (ghi(id, { ...r, soDu: r.soDu - soTien }, r.version)) { console.log(ten, 'thành công ở lần', lan); return; }
  }
  throw new Error('xung đột quá nhiều');
}
await Promise.all([rut(1, 10, 'A'), rut(1, 20, 'B'), rut(1, 30, 'C')]);
console.log(bang.get(1));        // soDu = 40 và không mất cập nhật nào` } });

  T({ id: 'migrations', a: 'data', t: 'Migration không downtime', lv: 5,
    sum: 'Đổi schema khi hệ thống đang chạy và có nhiều phiên bản code cùng lúc (rolling deploy).',
    flow: [['Expand', 'thêm cột mới (nullable), chưa dùng'], ['Deploy code ghi cả hai', 'đọc cột cũ, ghi cột cũ và mới'], ['Backfill', 'điền dữ liệu cũ theo lô nhỏ'], ['Chuyển đọc sang cột mới', 'kiểm chứng, giữ đường lùi'], ['Contract', 'dừng ghi cột cũ rồi xóa']],
    pts: ['Mỗi bước phải tương thích với cả phiên bản code cũ và mới đang chạy song song.', 'Postgres: thêm cột với default hằng số nhanh (từ PG 11); <code>CREATE INDEX CONCURRENTLY</code> để không khóa ghi; tránh thay đổi kiểu cột lớn trong một lần.', 'Backfill theo lô, có nghỉ giữa các lô, chạy ngoài giờ cao điểm, có thể dừng và tiếp tục.', 'Không sửa migration đã áp dụng; lùi thường là migration tiến mới (forward fix).', 'Thử trên dữ liệu cỡ production; đặt <code>lock_timeout</code> để migration không chờ khóa vô hạn.', 'Kết hợp feature flag để bật/tắt đường đọc mới.'],
    qa: [['Đổi tên một cột đang dùng mà không downtime?', 'Expand/contract: thêm cột mới, ghi cả hai, backfill, chuyển đọc sang cột mới, ngừng ghi cột cũ rồi xóa. Không đổi tên trực tiếp vì code cũ đang chạy sẽ lỗi.'], ['Vì sao migration có thể gây downtime dù chỉ là ALTER?', 'Một số ALTER giữ khóa mạnh trên bảng lớn; câu lệnh khác chờ khóa và xếp hàng sau nó. Dùng lock_timeout, các lệnh CONCURRENTLY và chia nhỏ.']] });

  T({ id: 'caching', a: 'data', t: 'Cache: chiến lược, vô hiệu hóa, stampede', lv: 2,
    sum: '"Có hai việc khó trong khoa học máy tính: vô hiệu hóa cache và đặt tên." Chỉ cache khi đã đo thấy cần.',
    flow: [['Đọc cache', 'theo khóa'], ['Hit', 'trả ngay'], ['Miss: đọc DB', 'chỉ một request nạp lại (singleflight)'], ['Ghi cache có TTL', 'TTL kèm jitter'], ['Khi ghi DB', 'xóa hoặc cập nhật cache']],
    pts: ['Mẫu: cache-aside (phổ biến nhất), read-through, write-through, write-behind (có rủi ro mất dữ liệu).', 'Stampede: key nóng hết hạn, nhiều request cùng đọc DB. Giảm bằng singleflight/khóa, làm mới sớm, TTL ngẫu nhiên.', 'Vô hiệu hóa: TTL ngắn, xóa khi ghi, sự kiện thay đổi; chấp nhận dữ liệu cũ trong khoảng đã định.', 'Cache âm (negative caching) cho kết quả không tồn tại; cache cục bộ (LRU) và phân tán (Redis) đều có chỗ.', 'HTTP/CDN: <code>Cache-Control</code>, <code>ETag</code>, <code>stale-while-revalidate</code>.', 'Key nóng và dữ liệu lớn trong Redis có thể làm nghẽn một node.'],
    qa: [['Cache stampede là gì và cách giảm?', 'Key nóng hết hạn và nhiều request cùng lúc đọc DB. Giảm bằng singleflight/khóa, làm mới trước khi hết hạn, TTL có jitter.'], ['Cache-aside là gì?', 'Ứng dụng đọc cache; miss thì đọc DB rồi ghi cache có TTL; khi ghi DB thì xóa hoặc cập nhật cache.'], ['Khi nào không nên cache?', 'Dữ liệu thay đổi liên tục và yêu cầu chính xác tức thời, hoặc khi chưa đo thấy điểm nghẽn: cache thêm độ phức tạp và nguy cơ dữ liệu cũ.']],
    code: { t: 'Singleflight: gộp các lần nạp trùng', lang: 'js', src: `function singleflight(fn) {
  const dangChay = new Map();
  return (key) => {
    if (dangChay.has(key)) return dangChay.get(key);          // dùng chung Promise đang chạy
    const p = fn(key).finally(() => dangChay.delete(key));
    dangChay.set(key, p);
    return p;
  };
}
let lanDocDB = 0;
const docDB = async (k) => { lanDocDB++; await new Promise((r) => setTimeout(r, 30)); return 'giá trị của ' + k; };
const lay = singleflight(docDB);
await Promise.all(Array.from({ length: 100 }, () => lay('san-pham:1')));
console.log('100 request, số lần đọc DB:', lanDocDB);          // 1
// Thử: bỏ singleflight (gọi docDB trực tiếp) để thấy 100 lần đọc` } });

  T({ id: 'nosql', a: 'data', t: 'NoSQL và mô hình hóa dữ liệu', lv: 5,
    sum: 'Chọn kho dữ liệu theo cách truy cập và yêu cầu nhất quán, rồi mô hình hóa theo cách truy cập đó.',
    flow: [['Liệt kê cách truy cập', 'đọc gì, theo khóa nào, tần suất'], ['Thiết kế khóa', 'partition key và sort key'], ['Thêm chỉ mục phụ', 'GSI cho cách truy cập khác'], ['Kiểm bằng truy vấn thật', 'không cần Scan'], ['Theo dõi', 'partition nóng, chi phí']],
    pts: ['SQL là mặc định hợp lý. Chọn NoSQL khi truy cập chủ yếu theo khóa, cần quy mô rất lớn hoặc dữ liệu dạng tài liệu.', '<b>MongoDB</b>: embed khi luôn đọc cùng nhau và bị chặn kích thước, tham chiếu khi tách rời hoặc tăng không giới hạn; index và giới hạn transaction đa tài liệu.', '<b>DynamoDB</b>: thiết kế theo cách truy cập; <code>Query</code> theo khóa, tránh <code>Scan</code>; GSI cho cách truy cập khác; partition nóng; ghi có điều kiện cho idempotency; TTL.', '<b>Redis</b>: cấu trúc dữ liệu (string, hash, sorted set, stream); dữ liệu nằm RAM, không thay DB chính.', 'Đánh đổi nhất quán: nhiều kho cho đọc cuối cùng nhất quán (eventually consistent) trừ khi yêu cầu đọc mạnh.', 'Tiến hóa schema: thêm trường tùy chọn, version tài liệu, di chuyển dần.'],
    qa: [['Khi nào chọn DynamoDB thay vì Postgres?', 'Truy cập chủ yếu theo khóa đã biết trước, cần quy mô lớn và độ trễ ổn định, ít cần truy vấn linh hoạt hay join. Phải thiết kế theo cách truy cập và chấp nhận ít linh hoạt.'], ['Embed hay reference trong MongoDB?', 'Embed khi dữ liệu luôn đọc cùng và kích thước bị chặn. Reference khi dữ liệu con lớn lên không giới hạn hoặc được dùng độc lập.'], ['Partition nóng là gì?', 'Một khóa nhận phần lớn traffic nên một partition quá tải trong khi các partition khác rảnh. Giảm bằng khóa phân tán đều hơn hoặc thêm hậu tố ngẫu nhiên.']] });

  T({ id: 'scale-data', a: 'data', t: 'Mở rộng dữ liệu: replica, sharding, CQRS, tìm kiếm', lv: 5,
    sum: 'Khi một DB không đủ: đọc nhiều thì replica, ghi nhiều thì sharding, truy vấn khác nhau thì tách mô hình đọc.',
    flow: [['Ghi vào DB chính', 'nguồn sự thật'], ['Sự kiện thay đổi', 'outbox hoặc CDC'], ['Cập nhật mô hình đọc', 'replica, chỉ mục tìm kiếm, cache'], ['Truy vấn đọc', 'từ mô hình đọc'], ['Chấp nhận độ trễ', 'đọc có thể cũ một chút']],
    pts: ['<b>Read replica</b>: nhân bản bất đồng bộ nên có độ trễ (replication lag); chú ý read-your-writes (đọc ngay sau khi ghi có thể thấy dữ liệu cũ).', '<b>Sharding</b>: chia dữ liệu theo khóa; khó ở chỗ chọn khóa, truy vấn xuyên shard, resharding. Trì hoãn càng lâu càng tốt; trước đó tối ưu index, cache, replica, phân vùng bảng.', '<b>CQRS</b>: tách mô hình ghi và đọc khi nhu cầu đọc rất khác; đổi lại độ phức tạp và nhất quán cuối cùng.', 'Tìm kiếm văn bản: Elasticsearch/OpenSearch (chỉ mục đảo), đồng bộ từ DB chính qua outbox/CDC; không dùng làm nguồn sự thật.', 'OLTP và OLAP: phân tích nặng không chạy trên DB giao dịch; dùng kho dữ liệu (Redshift, BigQuery) hoặc Athena trên S3.'],
    qa: [['Đọc nhiều làm DB chính quá tải, bạn làm gì?', 'Đo trước (index, N+1), cache, rồi read replica cho truy vấn đọc chịu được độ trễ. Chú ý read-your-writes. Sharding là phương án sau cùng vì phức tạp.'], ['Sharding có vấn đề gì?', 'Chọn khóa sai gây shard nóng; truy vấn và transaction xuyên shard khó; resharding tốn kém; mất ràng buộc toàn cục.']] });

  /* ================= Bất đồng bộ & phân tán ================= */
  T({ id: 'queues', a: 'dist', t: 'Queue: at-least-once, retry, DLQ', lv: 2,
    sum: 'API nhận và đẩy việc, worker xử lý ở ngoài request. Điều cần thuộc: queue giao ít nhất một lần.',
    flow: [['Producer đẩy job', 'API trả 202 ngay'], ['Job chờ (waiting)', 'worker lấy khi rảnh'], ['Worker lấy job', 'queue bắt đầu đếm visibility timeout'], ['Xử lý (active)', 'job bị ẩn với các worker khác'], ['Thành công: ack', 'queue xóa job'], ['Lỗi: backoff hoặc DLQ', 'chờ rồi thử lại; hết lượt thì vào DLQ để người xem']],
    fail: [3, 'Worker chết', 'hết visibility timeout, job được giao lại'],
    dgs: [{ w: 660, h: 240, nodes: [nd('w', 14, 78, 140, 52, 'Waiting\nchờ worker lấy', 'info'), nd('a', 250, 78, 140, 52, 'Active\nworker đang giữ', 'a'), nd('ok', 490, 14, 150, 48, 'Xong (ack)\nxóa khỏi queue', 'ok'), nd('d', 490, 130, 150, 52, 'DLQ\nhết lượt / lỗi không retry', 'bad'), nd('r', 250, 176, 140, 50, 'Chờ backoff\nsau đó quay lại', 'warn')], edges: [['w', 'a', 'worker lấy'], ['a', 'ok', 'ack'], ['a', 'd', 'hết lượt'], ['a', 'r', 'lỗi / timeout'], ['r', 'w', 'hết backoff']] }],
    pts: ['<b>Ack sau khi làm xong</b>, không trước. Worker chết trước khi ack thì job được giao lại.', '<b>Visibility timeout</b> phải lớn hơn thời gian xử lý tối đa, nếu không job bị giao hai lần.', 'Retry có giới hạn, <b>backoff mũ</b> <code>cơ sở × 2^(n-1)</code> kèm jitter; lỗi không thể retry (dữ liệu sai) đi thẳng DLQ.', 'DLQ có cảnh báo; có công cụ đẩy lại. Poison message (job làm worker crash mãi) cần giới hạn lượt thử.', 'Chọn công cụ: BullMQ (Redis), SQS, RabbitMQ, Kafka (xem chủ đề event-driven).', 'Theo dõi độ sâu queue, tuổi job cũ nhất, số lỗi, kích thước DLQ; scale worker theo độ sâu queue.'],
    qa: [['At-least-once là gì, hệ quả?', 'Mỗi message được giao ít nhất một lần, có thể nhiều lần. Hệ quả: handler phải idempotent.'], ['Visibility timeout đặt quá ngắn thì sao?', 'Job bị giao cho worker khác khi worker cũ vẫn đang xử lý, dẫn tới xử lý trùng. Đặt lớn hơn thời gian xử lý tối đa (SQS + Lambda: tài liệu AWS khuyến nghị ít nhất 6 lần timeout của function).'], ['DLQ để làm gì?', 'Giữ message hỏng (hết lượt thử hoặc lỗi không retry) để người vận hành xem, sửa, đẩy lại; cần cảnh báo khi có message.']],
    code: { t: 'Queue nhỏ: retry, backoff và DLQ', lang: 'js', src: `const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
class Queue {
  constructor({ maxAttempts = 3, baseMs = 20 } = {}) { this.jobs = []; this.dlq = []; this.maxAttempts = maxAttempts; this.baseMs = baseMs; }
  push(data) { this.jobs.push({ data, attempts: 0 }); }
  async run(handler) {
    while (this.jobs.length) {
      const job = this.jobs.shift(); job.attempts++;
      try { await handler(job.data, job.attempts); console.log('ack', JSON.stringify(job.data), 'sau', job.attempts, 'lần'); }
      catch (e) {
        if (e.retryable === false || job.attempts >= this.maxAttempts) { this.dlq.push({ ...job, loi: e.message }); console.log('-> DLQ', JSON.stringify(job.data), e.message); }
        else { const cho = this.baseMs * 2 ** (job.attempts - 1); console.log('lỗi lần', job.attempts, '- thử lại sau', cho, 'ms'); await sleep(cho); this.jobs.push(job); }
      }
    }
  }
}
const q = new Queue();
q.push({ id: 1 }); q.push({ id: 2 }); q.push({ id: 3 });
await q.run(async (d, lan) => {
  if (d.id === 2 && lan < 3) throw new Error('provider 503');                       // lỗi tạm thời, lần 3 thành công
  if (d.id === 3) throw Object.assign(new Error('số điện thoại sai'), { retryable: false });
});
console.log('DLQ:', q.dlq.map((j) => j.data.id));` } });

  T({ id: 'idem-outbox', a: 'dist', t: 'Idempotency và outbox pattern', lv: 5,
    sum: 'Ba lớp chống trùng và cách ghi DB cùng sự kiện mà không mất cái nào.',
    flow: [['Một transaction', 'ghi đơn + một dòng outbox'], ['Relay đọc outbox', 'các dòng chưa gửi'], ['Đẩy lên queue', 'có thể đẩy trùng nếu chết giữa chừng'], ['Đánh dấu đã gửi', 'sent_at'], ['Consumer chống trùng', 'inbox hoặc khóa theo event id']],
    pts: ['Ba lớp từ ngoài vào: <b>Idempotency-Key</b> (HTTP), <b>transactionId</b> (nghiệp vụ), <b>jobId</b> (queue), và cuối cùng <b>handler idempotent</b>.', 'Handler idempotent: đánh dấu "đã làm" (khóa <code>SET NX</code>, ràng buộc unique, ghi có điều kiện) trước hoặc cùng lúc với hiệu ứng phụ.', 'Outbox tránh "ghi DB xong nhưng đẩy queue lỗi" và ngược lại; relay bằng polling hoặc CDC.', '"Exactly-once" thực tế là at-least-once cộng xử lý idempotent.', 'Thứ tự: queue thường không đảm bảo; cần thứ tự thì dùng khóa phân vùng (Kafka partition, SQS FIFO message group).', 'Lưu kết quả theo idempotency key để trả đúng kết quả cũ khi client gửi lại.'],
    qa: [['Outbox pattern giải quyết gì?', 'Việc ghi DB và đẩy sự kiện không thể nằm trong một transaction chung. Ghi sự kiện vào bảng outbox cùng transaction với dữ liệu, relay đọc rồi đẩy lên queue; consumer vẫn idempotent.'], ['Làm sao để một email chỉ gửi một lần dù job chạy hai lần?', 'Đánh dấu "đã gửi" bằng thao tác nguyên tử (SET NX, unique constraint) trước khi gửi; lần chạy lại thấy dấu và bỏ qua.'], ['Có "exactly-once" không?', 'Về mặt thực tế thì không ở tầng truyền thông; ta đạt hiệu quả exactly-once bằng at-least-once cộng handler idempotent.']],
    code: { t: 'Handler idempotent với bộ nhớ dedupe', lang: 'js', src: `const daXuLy = new Set();                 // bản thật: Redis SET NX hoặc unique constraint
let soEmail = 0;
async function guiEmail(job) {
  const khoa = 'email:' + job.notificationId;
  if (daXuLy.has(khoa)) { console.log('bỏ qua (đã gửi)', job.notificationId); return; }
  daXuLy.add(khoa);                       // giành quyền trước khi gửi
  soEmail++;
  console.log('gửi email', job.notificationId);
}
// queue giao trùng cùng một job
await guiEmail({ notificationId: 'n1' });
await guiEmail({ notificationId: 'n1' });
await guiEmail({ notificationId: 'n2' });
console.log('số email thật sự gửi:', soEmail);        // 2` } });

  T({ id: 'consistency', a: 'dist', t: 'Nhất quán, saga và CAP', lv: 5,
    sum: 'Khi một nghiệp vụ trải qua nhiều service, không có transaction chung: dùng saga với bước bù.',
    flow: [['Tạo đơn (pending)', 'ghi vào DB'], ['Giữ hàng', 'service kho'], ['Thanh toán', 'service thanh toán'], ['Xác nhận đơn', 'hoàn tất'], ['Có bước lỗi', 'chạy các bước bù theo thứ tự ngược']],
    fail: [2, 'Thanh toán thất bại', 'hủy giữ hàng, đánh dấu đơn bị hủy'],
    pts: ['ACID trong một DB; giữa nhiều service chỉ có nhất quán cuối cùng (eventual consistency). Tránh 2PC giữa service.', '<b>Saga</b>: chuỗi bước cục bộ, mỗi bước có hành động bù. <b>Orchestration</b> (một bộ điều phối giữ trạng thái) hay <b>choreography</b> (service phản ứng với sự kiện).', 'Hành động bù và từng bước phải idempotent; trạng thái saga được lưu bền để tiếp tục sau khi crash.', 'Thiết kế trải nghiệm quanh trạng thái trung gian (pending, đang xử lý) thay vì giả vờ tức thời.', 'CAP: khi mạng bị chia cắt phải chọn nhất quán hay sẵn sàng. PACELC bổ sung đánh đổi độ trễ so với nhất quán khi không có chia cắt.', 'Timeout và bước bù cho cả trường hợp "không biết kết quả" (gọi thanh toán timeout).'],
    qa: [['Saga là gì, khác gì transaction?', 'Chuỗi các bước cục bộ trên nhiều service, mỗi bước có hành động bù để hoàn tác khi một bước sau thất bại. Không cô lập như ACID: trạng thái trung gian nhìn thấy được.'], ['Orchestration và choreography?', 'Orchestration: một bộ điều phối ra lệnh từng bước và giữ trạng thái, dễ theo dõi. Choreography: service phát và nghe sự kiện, ít điểm trung tâm nhưng khó nhìn toàn cục.'], ['Gọi thanh toán bị timeout, không biết đã trừ tiền chưa?', 'Dùng idempotency key khi gọi lại hoặc truy vấn trạng thái giao dịch; không tự bù khi chưa biết kết quả; đối soát định kỳ.']],
    code: { t: 'Saga có bước bù', lang: 'js', src: `async function saga(buoc) {
  const daLam = [];
  try {
    for (const b of buoc) { console.log('làm:', b.ten); await b.lam(); daLam.push(b); }
    console.log('hoàn tất');
  } catch (e) {
    console.log('lỗi:', e.message, '-> bù ngược');
    for (const b of daLam.reverse()) { console.log('bù:', b.ten); await b.bu(); }
  }
}
await saga([
  { ten: 'giữ hàng',   lam: async () => {}, bu: async () => {} },
  { ten: 'thanh toán', lam: async () => { throw new Error('thẻ bị từ chối'); }, bu: async () => {} },
  { ten: 'xác nhận',   lam: async () => {}, bu: async () => {} },
]);
// Thử: cho bước thanh toán thành công và xem 'hoàn tất'` } });

  T({ id: 'resilience', a: 'dist', t: 'Chịu lỗi: timeout, retry, circuit breaker, bulkhead', lv: 5,
    sum: 'Một dịch vụ phụ thuộc chậm hoặc chết không được kéo theo cả hệ thống.',
    flow: [['Gọi phụ thuộc', 'luôn có timeout'], ['Lỗi tạm thời', 'retry có giới hạn, backoff, jitter'], ['Quá nhiều lỗi', 'circuit breaker mở, thất bại nhanh'], ['Cô lập tài nguyên', 'bulkhead: pool riêng cho mỗi phụ thuộc'], ['Hạ cấp', 'fallback hoặc phản hồi rút gọn']],
    pts: ['Mọi lời gọi ra ngoài cần timeout; deadline nên được truyền xuyên chuỗi gọi.', 'Chỉ retry thao tác idempotent và lỗi tạm thời; có ngân sách retry để tránh nhân tải khi hệ thống đang yếu (retry storm).', '<b>Circuit breaker</b>: đóng, mở (thất bại nhanh), nửa mở (thử vài request). Giúp phụ thuộc có thời gian hồi phục.', '<b>Bulkhead</b>: giới hạn song song theo từng phụ thuộc để một nơi chậm không chiếm hết luồng/kết nối.', 'Load shedding: từ chối bớt khi quá tải thay vì sập hoàn toàn; backpressure ngược về phía gọi.', 'Chaos/fault injection để kiểm chứng.'],
    qa: [['Circuit breaker hoạt động thế nào?', 'Theo dõi tỉ lệ lỗi. Quá ngưỡng thì mở: thất bại ngay không gọi phụ thuộc. Sau một khoảng thì nửa mở cho vài request thử; thành công thì đóng lại.'], ['Retry có thể gây hại khi nào?', 'Khi hệ thống đã quá tải: mọi client retry làm tải tăng gấp bội (retry storm). Cần backoff, jitter, giới hạn lượt và ngân sách retry.'], ['Bulkhead là gì?', 'Cô lập tài nguyên theo từng phụ thuộc (pool, giới hạn song song riêng) để sự cố ở một nơi không lan ra toàn bộ.']],
    code: { t: 'Circuit breaker', lang: 'js', src: `class Breaker {
  constructor(fn, { nguong = 3, nghiMs = 200 } = {}) { this.fn = fn; this.nguong = nguong; this.nghiMs = nghiMs; this.loi = 0; this.state = 'dong'; this.moLuc = 0; }
  async call(...a) {
    if (this.state === 'mo') {
      if (Date.now() - this.moLuc < this.nghiMs) throw new Error('breaker mở: thất bại nhanh');
      this.state = 'nua-mo';
    }
    try { const r = await this.fn(...a); this.loi = 0; this.state = 'dong'; return r; }
    catch (e) { this.loi++; if (this.state === 'nua-mo' || this.loi >= this.nguong) { this.state = 'mo'; this.moLuc = Date.now(); } throw e; }
  }
}
let phuThuocHong = true;
const b = new Breaker(async () => { if (phuThuocHong) throw new Error('503'); return 'ok'; });
for (let i = 1; i <= 6; i++) { try { await b.call(); } catch (e) { console.log(i, b.state, '-', e.message); } }
phuThuocHong = false; await new Promise((r) => setTimeout(r, 250));      // phụ thuộc hồi phục
console.log('sau khi nghỉ:', await b.call(), '| trạng thái:', b.state);` } });

  T({ id: 'locks-sched', a: 'dist', t: 'Khóa phân tán, scheduler và leader election', lv: 5,
    sum: 'Nhiều instance cùng chạy thì "chỉ một nơi làm việc này" không còn miễn phí.',
    flow: [['Instance muốn làm việc', 'ví dụ chạy cron'], ['Giành khóa', 'SET key token NX PX ttl'], ['Thắng: làm việc', 'gắn fencing token'], ['Gia hạn nếu lâu', 'hoặc làm xong trong TTL'], ['Giải phóng', 'chỉ khi token còn khớp']],
    fail: [1, 'Thua: bỏ qua', 'instance khác đang làm'],
    pts: ['Khóa Redis: <code>SET key token NX PX ttl</code>; giải phóng chỉ khi token khớp (script Lua) để không xóa khóa của người khác.', 'Khóa có TTL (lease) có thể hết hạn khi tiến trình bị treo: dùng <b>fencing token</b> để tài nguyên từ chối bên cầm khóa cũ.', 'Redlock còn tranh luận về độ an toàn; việc cần đúng tuyệt đối nên dựa vào ràng buộc của DB.', 'Cron khi nhiều instance: chạy ở một nơi (EventBridge Scheduler + Lambda, BullMQ repeatable job, hoặc khóa DB/Redis); job phải idempotent.', 'Leader election: K8s Lease, etcd, hoặc dòng trong DB với heartbeat.', 'Đồng hồ giữa máy không tin được: không dựa vào so sánh thời gian giữa nút khác nhau.'],
    qa: [['Cron chạy trên 3 instance thì bị chạy 3 lần, xử lý?', 'Chạy lịch ở một nơi duy nhất (dịch vụ scheduler hoặc repeatable job của queue) hoặc dùng khóa phân tán; và viết job idempotent phòng khi vẫn chạy trùng.'], ['Fencing token là gì?', 'Số tăng dần cấp kèm mỗi lần giành khóa; tài nguyên bảo vệ từ chối thao tác mang token cũ hơn, chặn bên cầm khóa đã hết hạn nhưng chưa biết.']],
    code: { t: 'Khóa có TTL và fencing token', lang: 'js', src: `class KhoaGia {
  constructor() { this.giu = null; this.dem = 0; }
  gianh(chu, ttlMs) {
    const now = Date.now();
    if (this.giu && this.giu.hetHan > now) return null;                   // người khác đang giữ
    this.giu = { chu, token: ++this.dem, hetHan: now + ttlMs };
    return this.giu.token;
  }
}
const khoa = new KhoaGia();
const tai = { tokenCaoNhat: 0 };
function ghiVaoTaiNguyen(token, noiDung) {
  if (token < tai.tokenCaoNhat) return console.log('từ chối token cũ', token, ':', noiDung);
  tai.tokenCaoNhat = token; console.log('ghi với token', token, ':', noiDung);
}
const tA = khoa.gianh('A', 50);                       // A giành được
console.log('B giành khi A đang giữ:', khoa.gianh('B', 50));
await new Promise((r) => setTimeout(r, 80));          // A bị treo quá TTL
const tB = khoa.gianh('B', 50);                       // B giành được, token mới
ghiVaoTaiNguyen(tB, 'B làm việc');
ghiVaoTaiNguyen(tA, 'A tỉnh dậy, vẫn nghĩ mình giữ khóa');   // bị fencing chặn` } });

  T({ id: 'event-driven', a: 'dist', t: 'Event-driven: Kafka, SQS/SNS, event sourcing, CQRS', lv: 5,
    sum: 'Các service giao tiếp bằng sự kiện để lỏng lẻo hơn, đổi lại khó theo dõi và nhất quán cuối cùng.',
    flow: [['Producer phát sự kiện', 'đã xảy ra: OrderCreated'], ['Broker lưu và phân phối', 'topic, queue'], ['Nhiều consumer độc lập', 'mỗi nơi một nhóm'], ['Mỗi consumer xử lý', 'idempotent, có DLQ'], ['Mô hình đọc / hệ quả', 'email, kho, tìm kiếm, phân tích']],
    pts: ['Sự kiện (đã xảy ra, bất biến) khác lệnh (yêu cầu làm). Đặt tên bằng thì quá khứ.', '<b>SNS + SQS fan-out</b>: một sự kiện tới nhiều hàng đợi, mỗi consumer một hàng. <b>EventBridge</b>: định tuyến theo quy tắc, lịch, tích hợp SaaS.', '<b>Kafka</b>: nhật ký bền, phát lại được, thứ tự trong một partition, consumer group; hợp thông lượng lớn và stream processing. <b>SQS</b>: hàng đợi quản lý đơn giản. <b>RabbitMQ</b>: định tuyến linh hoạt.', 'Schema sự kiện là hợp đồng: tiến hóa tương thích (thêm trường tùy chọn), có version, registry nếu cần.', '<b>Event sourcing</b>: lưu chuỗi sự kiện làm nguồn sự thật; <b>CQRS</b>: tách mô hình ghi và đọc. Mạnh nhưng phức tạp, chỉ dùng khi có lý do (audit, tái dựng trạng thái).', 'Quan sát: correlation id/trace id đi cùng sự kiện để theo dõi luồng.'],
    qa: [['Kafka khác SQS thế nào?', 'Kafka là nhật ký bền có phát lại, thứ tự trong partition, nhiều consumer group đọc độc lập, thông lượng rất lớn; vận hành nặng hơn. SQS là hàng đợi quản lý: mỗi message xử lý rồi xóa, đơn giản, không phát lại.'], ['Event sourcing có đáng dùng không?', 'Chỉ khi cần lịch sử bất biến, audit hoặc tái dựng trạng thái. Chi phí: truy vấn khó hơn, tiến hóa schema sự kiện, nhất quán cuối cùng. Phần lớn dịch vụ CRUD không cần.'], ['Đảm bảo thứ tự thế nào?', 'Queue thường không đảm bảo. Cần thứ tự theo thực thể thì dùng khóa phân vùng (Kafka partition key, SQS FIFO message group) và xử lý tuần tự trong từng khóa.']] });

  /* ================= Test ================= */
  T({ id: 'test-strategy', a: 'test', t: 'Chiến lược test cho backend', lv: 2,
    sum: 'Test để tự tin đổi code. Test nhanh, đúng chỗ và không flaky quan trọng hơn con số coverage.',
    flow: [['Viết thay đổi', 'kèm test cho hành vi'], ['Unit test', 'logic thuần, vài mili giây'], ['Integration', 'API + DB thật trong container'], ['CI chạy mọi test', 'chặn merge nếu đỏ'], ['Smoke sau deploy', 'vài luồng quan trọng nhất']],
    dgs: [{ w: 560, h: 196, nodes: [nd('a', 200, 8, 160, 50, 'E2E\nít, chậm, đắt', 'bad'), nd('b', 130, 68, 300, 52, 'Integration\nAPI + DB thật (container)', 'warn'), nd('c', 40, 130, 480, 52, 'Unit\nnhiều, nhanh, logic thuần', 'ok')] }],
    pts: ['Mock ranh giới ngoài (HTTP bên thứ ba, email, queue). <b>Đừng mock DB</b> nếu chạy được container: mock che mất lỗi SQL, transaction, constraint.', 'Thiết kế dễ test: truyền dependency (clock, sleep, repo) thay vì import cứng.', 'Test độc lập, tự dọn dữ liệu, không phụ thuộc thứ tự; không dùng <code>setTimeout</code> thật để chờ.', 'Công cụ: <code>node:test</code> (có sẵn), Vitest, Jest; gọi API thật qua <code>fetch</code> hoặc supertest; Testcontainers.', 'Coverage là chỉ báo, không phải mục tiêu; test hành vi, không test chi tiết cài đặt.', 'Test flaky là nợ: cô lập nguyên nhân (thời gian, thứ tự, dữ liệu dùng chung) rồi sửa, đừng chỉ chạy lại.'],
    qa: [['Mock hay dùng DB thật trong test?', 'Mock ranh giới ngoài; dùng DB thật (container) cho test tích hợp vì mock che mất lỗi SQL, transaction, constraint.'], ['Làm sao tránh test flaky?', 'Không dựa vào thời gian thật (inject sleep/clock), mỗi test tự dọn dữ liệu, không phụ thuộc thứ tự, dùng cổng ngẫu nhiên, và cô lập tài nguyên dùng chung.']],
    code: { t: 'Test với node:test (editor có runner mô phỏng)', lang: 'js', src: `import { test } from 'node:test';
import assert from 'node:assert/strict';

async function retry(fn, { attempts = 3, baseMs = 100, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  for (let i = 1; ; i++) {
    try { return await fn(); }
    catch (e) { if (i >= attempts) throw e; await sleep(baseMs * 2 ** (i - 1)); }
  }
}
test('thử lại với backoff mũ rồi thành công', async () => {
  const delays = []; let calls = 0;
  const sleep = async (ms) => { delays.push(ms); };          // không chờ thật
  const r = await retry(async () => { if (++calls < 3) throw new Error('x'); return 'ok'; }, { sleep });
  assert.equal(r, 'ok'); assert.equal(calls, 3);
  assert.deepEqual(delays, [100, 200]);
});
test('hết lượt thì ném lỗi', async () => {
  await assert.rejects(retry(async () => { throw new Error('x'); }, { sleep: async () => {} }));
});` } });

  T({ id: 'test-adv', a: 'test', t: 'Contract test, load test, chaos và test bất đồng bộ', lv: 5,
    sum: 'Test ở mức hệ thống: hợp đồng giữa service, hành vi dưới tải và dưới lỗi.',
    flow: [['Định nghĩa SLO', 'p95 dưới 300ms, lỗi dưới 0,1%'], ['Contract test', 'consumer và provider cùng kiểm hợp đồng'], ['Load test', 'k6/autocannon ở môi trường giống production'], ['Fault injection', 'làm chậm hoặc làm hỏng phụ thuộc'], ['Đo và so sánh', 'kết quả với SLO, ghi lại']],
    pts: ['Contract test (Pact, OpenAPI diff): phát hiện thay đổi phá vỡ giữa các service mà không cần dựng toàn hệ thống.', 'Load test có kịch bản thật, dữ liệu cỡ production, đo percentile; tìm điểm gãy và hành vi khi quá tải.', 'Chaos/fault injection: tắt phụ thuộc, tiêm độ trễ, kiểm tra timeout, retry, breaker thật sự hoạt động.', 'Test queue và bất đồng bộ: kiểm trạng thái cuối bằng polling có timeout, kiểm idempotency (gửi trùng), kiểm DLQ.', 'Property-based testing (fast-check) cho logic có nhiều tổ hợp đầu vào; mutation testing để đo chất lượng test.', 'Kiểm thử trong production an toàn: canary, feature flag, quan sát và rollback tự động.'],
    qa: [['Contract testing giải quyết gì?', 'Hai service phát triển độc lập mà vẫn biết khi thay đổi của một bên phá vỡ bên kia, qua hợp đồng được kiểm ở cả hai phía, không cần môi trường tích hợp đầy đủ.'], ['Bạn load test như thế nào?', 'Chọn kịch bản theo traffic thật, môi trường và dữ liệu giống production, tăng tải dần, đo p95/p99 và tỉ lệ lỗi, tìm điểm gãy, so với SLO và ghi lại để so sánh lần sau.']],
    code: { t: 'Property-style: kiểm bất biến với đầu vào ngẫu nhiên', lang: 'js', src: `import { test } from 'node:test';
import assert from 'node:assert/strict';

const sapXep = (a) => [...a].sort((x, y) => x - y);
const ngauNhien = () => Array.from({ length: Math.floor(Math.random() * 20) }, () => Math.floor(Math.random() * 100) - 50);

test('sắp xếp: kết quả tăng dần và giữ đủ phần tử (200 mẫu ngẫu nhiên)', () => {
  for (let i = 0; i < 200; i++) {
    const a = ngauNhien(), s = sapXep(a);
    assert.equal(s.length, a.length);
    for (let k = 1; k < s.length; k++) assert.ok(s[k - 1] <= s[k]);
    assert.deepEqual(sapXep(s), s);                 // sắp xếp lần hai không đổi (idempotent)
  }
});
// Thử: cố ý làm sapXep sai (dùng sort() mặc định theo chữ) để test bắt lỗi` } });

  T({ id: 'code-quality', a: 'test', t: 'Chất lượng code: lint, review, CI, quy trình', lv: 2,
    sum: 'Quy trình tốt biến chất lượng thành thói quen: máy kiểm cái máy kiểm được, người review cái cần phán đoán.',
    flow: [['Nhánh ngắn hạn', 'trunk-based, PR nhỏ'], ['Máy kiểm', 'format, lint, typecheck, test'], ['Review', 'thiết kế, rủi ro, dễ đọc'], ['Merge khi CI xanh', 'không bỏ qua cổng chất lượng'], ['Deploy nhỏ, thường xuyên', 'dễ lùi, dễ tìm lỗi']],
    pts: ['PR nhỏ, một mục đích, mô tả rõ lý do; review trong vòng một ngày.', 'Tự động hóa: Prettier/Biome/ESLint, <code>tsc --noEmit</code>, test, <code>npm audit</code>; commit theo quy ước nếu cần changelog tự động.', 'Review tập trung vào: đúng hành vi, rủi ro (bảo mật, dữ liệu, hiệu năng), khả năng đọc và test; không tranh luận định dạng (đã có công cụ).', 'Cập nhật phụ thuộc đều đặn (Renovate/Dependabot) thay vì dồn một lần.', 'Tài liệu sống: README chạy được, ADR cho quyết định lớn, runbook cho vận hành.'],
    qa: [['Một code review tốt gồm gì?', 'Kiểm đúng hành vi và rủi ro (bảo mật, dữ liệu, hiệu năng), thiết kế và khả năng đọc, test đủ; nêu lý do và gợi ý, phân biệt chặn merge với gợi ý; để máy lo định dạng.'], ['Vì sao PR nhỏ?', 'Dễ review kỹ, ít xung đột, dễ lùi, tìm lỗi nhanh hơn, deploy thường xuyên hơn.']] });
})(window.NH);
