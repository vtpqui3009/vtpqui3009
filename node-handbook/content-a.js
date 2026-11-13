/* Nội dung phần 1: ngôn ngữ, runtime, API, bảo mật.
   Mỗi chủ đề: lv = mốc kinh nghiệm (2 hoặc 5 năm), flow = quy trình [tiêu đề, giải thích], pts = điều cần nắm,
   qa = hỏi đáp, code = ví dụ chạy được trong editor. */
window.NH = window.NH || { areas: [], topics: [] };
(function (NH) {
  const nd = (id, x, y, w, h, t, tone) => ({ id, x, y, w, h, t, tone });
  NH.nd = nd;
  NH.areas.push(
    { id: 'lang', t: 'Ngôn ngữ và TypeScript', desc: 'Nền của mọi thứ: scope, async, kiểu.', m2: 'Giải thích closure, this, Promise; dùng TypeScript strict; validate dữ liệu lúc chạy.', m5: 'Thiết kế kiểu cho thư viện dùng chung, branded type, giữ hợp đồng API đồng bộ giữa client và server.' },
    { id: 'runtime', t: 'Node runtime', desc: 'Event loop, stream, lỗi, bộ nhớ, hiệu năng.', m2: 'Vẽ được event loop, tránh chặn luồng chính, xử lý lỗi và tắt êm.', m5: 'Tìm rò bộ nhớ và điểm nghẽn bằng profiler; hiểu GC, thread pool, giới hạn container.' },
    { id: 'api', t: 'API và kiến trúc', desc: 'REST, middleware, phân lớp, thiết kế API bền.', m2: 'Dựng REST API có validate, lỗi thống nhất, phân trang, tài liệu.', m5: 'Thiết kế API tương thích ngược, webhook, long-running, chọn REST hay GraphQL hay gRPC, tách service có lý do.' },
    { id: 'sec', t: 'Bảo mật', desc: 'Xác thực, phân quyền, OWASP, bí mật.', m2: 'JWT và phiên, băm mật khẩu, chống injection, kiểm tra quyền ở server.', m5: 'OAuth2/OIDC, quản lý bí mật, chuỗi cung ứng, threat modeling, SSRF, prototype pollution.' },
    { id: 'data', t: 'Dữ liệu', desc: 'SQL, transaction, cache, NoSQL, di chuyển schema.', m2: 'Pool, transaction, N+1, index, cache-aside, migration có phiên bản.', m5: 'Isolation và khóa, migration không downtime, mô hình hóa NoSQL, sharding, read replica, CQRS.' },
    { id: 'dist', t: 'Bất đồng bộ và phân tán', desc: 'Queue, idempotency, saga, chịu lỗi.', m2: 'Queue với retry và DLQ, handler idempotent, giải thích at-least-once.', m5: 'Outbox, saga, circuit breaker, khóa phân tán, event-driven và đánh đổi nhất quán.' },
    { id: 'test', t: 'Test và chất lượng', desc: 'Chiến lược test, review, quy trình.', m2: 'Unit và integration với DB thật, mock đúng chỗ, CI chặn lỗi.', m5: 'Contract test, load test, chaos, test queue và bất đồng bộ, văn hóa review.' },
    { id: 'aws', t: 'AWS và cloud', desc: 'IAM, serverless, container, IaC, chi phí.', m2: 'IAM, S3, CloudFront, Lambda + SQS + DynamoDB, IaC cơ bản.', m5: 'Chọn Lambda hay ECS hay EKS, multi-AZ và DR, kiểm soát chi phí, quyền tối thiểu theo từng service.' },
    { id: 'ops', t: 'DevOps và vận hành', desc: 'Docker, Kubernetes, CI/CD, quan sát, sự cố.', m2: 'Dockerfile tốt, đọc manifest K8s, pipeline CI/CD, log có cấu trúc.', m5: 'Chiến lược deploy, SLO và cảnh báo, xử lý sự cố và postmortem.' },
    { id: 'design', t: 'Thiết kế hệ thống', desc: 'Khung trả lời và các bài mẫu.', m2: 'Vẽ được luồng đầu cuối của một tính năng và nói được rủi ro chính.', m5: 'Ước lượng tải, nêu đánh đổi, thiết kế từ yêu cầu phi chức năng, chỉ ra điểm đơn lẻ gây lỗi.' },
    { id: 'soft', t: 'Kỹ năng và phỏng vấn', desc: 'Cách làm việc và cách trả lời.', m2: 'Trả lời trung thực theo "Đã làm, Hiểu, Đang học", kể dự án theo STAR.', m5: 'Ra quyết định có ghi lại (ADR), review như mentoring, quản lý nợ kỹ thuật, nói chuyện với người không chuyên.' },
  );
  const T = (o) => NH.topics.push(o);

  /* ================= Ngôn ngữ ================= */
  T({ id: 'closure', a: 'lang', t: 'Closure, scope và hoisting', lv: 2,
    sum: 'Hàm nhớ biến của nơi nó được tạo. Nền của callback, factory, memoize và trạng thái riêng tư.',
    flow: [['Khai báo biến', 'let n = 0 nằm trong hàm taoDem()'], ['Tạo hàm bên trong', '() => ++n tham chiếu tới n'], ['Hàm ngoài kết thúc', 'scope không bị hủy vì còn tham chiếu'], ['Gọi hàm trả về', 'đọc và ghi đúng biến n đã nhớ']],
    pts: ['<code>const</code> mặc định, <code>let</code> khi cần gán lại, bỏ <code>var</code>. <code>const</code> chỉ cấm gán lại tên biến, không làm object bất biến.', 'Block scope với <code>let/const</code>; <code>var</code> theo phạm vi hàm. Dùng biến trước dòng khai báo ở <code>let/const</code> là lỗi (temporal dead zone).', 'Hoisting: khai báo hàm được đưa lên đầu; <code>var</code> lên đầu với giá trị <code>undefined</code>.', 'Closure giữ tham chiếu, không giữ bản sao: object lớn trong closure sống lâu gây rò bộ nhớ.', 'Ứng dụng: factory, trạng thái riêng, memoize, debounce, partial application.'],
    qa: [['Closure là gì? Cho ví dụ dùng và một rủi ro.', 'Hàm giữ tham chiếu tới biến của scope nơi nó được tạo, kể cả khi scope đó đã chạy xong. Dùng cho factory, state riêng, callback. Rủi ro: giữ object lớn khiến nó không được thu hồi.'], ['Vì sao vòng for với var in ra 3 3 3 còn let in ra 0 1 2?', 'var có một biến dùng chung theo hàm nên timer chạy khi vòng lặp đã xong và i = 3. let tạo biến riêng cho mỗi lượt lặp, callback bắt đúng biến của mình.'], ['Temporal dead zone là gì?', 'Khoảng từ đầu scope đến dòng khai báo let/const. Truy cập biến trong khoảng đó ném ReferenceError, khác var trả về undefined.']],
    code: { t: 'var và let trong vòng lặp, closure đếm', lang: 'js', src: `// var và let trong vòng lặp
for (var i = 0; i < 3; i++) setTimeout(() => console.log('var', i), 0);
for (let j = 0; j < 3; j++) setTimeout(() => console.log('let', j), 0);

// closure giữ trạng thái riêng
function taoDem() { let n = 0; return () => ++n; }
const a = taoDem(), b = taoDem();
console.log(a(), a(), b());   // 1 2 1

// Thử: đổi var thành let ở vòng đầu rồi chạy lại` } });

  T({ id: 'this-proto', a: 'lang', t: 'this, prototype và class', lv: 2,
    sum: 'this phụ thuộc cách gọi hàm; class là cú pháp gọn bọc chuỗi prototype.',
    flow: [['Truy cập obj.x', 'tìm trên chính obj'], ['Không có: đi lên', 'tìm trên prototype của obj'], ['Lên tiếp chuỗi', 'đến Object.prototype'], ['Không thấy', 'trả về undefined']],
    pts: ['Quy tắc <code>this</code>: gọi thường (undefined ở strict), gọi qua object (object đó), <code>call/apply/bind</code> (chỉ định), <code>new</code> (object mới), arrow (lấy của scope ngoài).', 'Truyền method trần (<code>setTimeout(obj.m)</code>) làm mất <code>this</code>. Dùng arrow, <code>bind</code> hoặc field arrow.', 'Method của class nằm ở prototype, dùng chung; field của class nằm trên từng instance.', 'Trường riêng tư <code>#x</code> thật sự riêng, khác quy ước <code>_x</code>.', 'Ưu tiên composition hơn kế thừa nhiều tầng.'],
    qa: [['Hàm thường và arrow khác gì về this?', 'Hàm thường: this tùy cách gọi. Arrow: lấy this của scope nơi định nghĩa và không đổi được bằng call/bind, nên hợp cho callback.'], ['Class trong JavaScript là gì?', 'Cú pháp bọc lên prototype. Method nằm ở prototype dùng chung, field nằm trên instance. Không phải lớp theo nghĩa Java.']],
    code: { t: 'Mất this khi truyền method', lang: 'js', src: `class Dem { n = 0; tang() { this.n++; return this.n; } }
const d = new Dem();
const f = d.tang;                 // tách khỏi object
try { f(); } catch (e) { console.log('mất this:', e.message); }
const g = d.tang.bind(d);
console.log(g(), g());            // 1 2
// Thử: viết lại tang thành field arrow: tang = () => ++this.n;` } });

  T({ id: 'async', a: 'lang', t: 'Promise, async/await và lỗi bất đồng bộ', lv: 2,
    sum: 'Cách JavaScript biểu diễn việc chưa xong. Đa số bug async đến từ việc quên await, forEach và lỗi không được bắt.',
    flow: [['Tạo Promise', 'trạng thái pending'], ['Việc xong', 'resolve(giá trị)'], ['Hoặc thất bại', 'reject(lỗi)'], ['then / await', 'callback vào hàng microtask'], ['Đã settled', 'không đổi trạng thái nữa']],
    pts: ['<code>all</code> lỗi ngay khi một cái lỗi; <code>allSettled</code> chờ hết; <code>race</code> cái xong đầu; <code>any</code> cái thành công đầu.', '<code>forEach(async ...)</code> không chờ. Dùng <code>for...of</code> (tuần tự) hoặc <code>Promise.all(arr.map(...))</code> (song song).', 'Mọi I/O cần timeout: <code>AbortSignal.timeout(ms)</code>. <code>fetch</code> không reject khi HTTP 4xx/5xx, kiểm tra <code>res.ok</code>.', 'Promise reject không bắt làm Node (từ v15) crash. Luôn <code>await</code> hoặc <code>.catch</code>.', 'Giới hạn song song khi xử lý nhiều việc để không mở hàng nghìn kết nối cùng lúc.', 'Async iterator (<code>for await</code>) hợp với dữ liệu đến dần: stream, phân trang.'],
    qa: [['Promise.all, allSettled, race, any khác nhau thế nào?', 'all: một lỗi là lỗi ngay. allSettled: chờ hết, trả trạng thái từng cái. race: cái xong đầu tiên kể cả lỗi. any: cái thành công đầu tiên, chỉ lỗi khi tất cả lỗi.'], ['await trong forEach có chờ không?', 'Không, forEach bỏ qua Promise của callback. Dùng for...of hoặc Promise.all.'], ['Làm sao giới hạn 5 request chạy song song?', 'Một nhóm 5 worker cùng lấy việc từ một con trỏ chung (tự viết hoặc dùng p-limit). Không dùng Promise.all cho hàng nghìn việc.']],
    code: { t: 'Giới hạn việc chạy song song (pLimit)', lang: 'js', src: `const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pLimit(tasks, limit) {
  const results = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++;                 // an toàn: JS đơn luồng giữa các await
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

let running = 0, peak = 0;
const tasks = Array.from({ length: 10 }, (_, i) => async () => {
  running++; peak = Math.max(peak, running);
  await sleep(100); running--; return i;
});
const t0 = performance.now();
const r = await pLimit(tasks, 3);
console.log({ peak, r, ms: Math.round(performance.now() - t0) });   // ~400ms, peak 3` } });

  T({ id: 'ts-types', a: 'lang', t: 'TypeScript: kiểu, narrowing, generics', lv: 2,
    sum: 'Kiểu chỉ có lúc build. Dữ liệu từ bên ngoài vẫn phải validate lúc chạy.',
    flow: [['Viết TypeScript', 'có chú thích kiểu'], ['tsc kiểm tra', 'bắt lỗi kiểu lúc build'], ['Xóa kiểu', 'ra JavaScript thuần'], ['Node chạy JS', 'không còn thông tin kiểu'], ['Dữ liệu ngoài', 'validate lúc chạy (zod)']],
    pts: ['Bật <code>strict</code>. Dùng <code>unknown</code> thay <code>any</code> rồi thu hẹp kiểu (narrowing).', 'Discriminated union: mỗi biến thể có trường <code>type</code>/<code>ok</code>; compiler biết nhánh nào có trường nào.', 'Generics để viết hàm dùng cho nhiều kiểu; utility types: <code>Partial</code>, <code>Pick</code>, <code>Omit</code>, <code>Record</code>, <code>ReturnType</code>, <code>Awaited</code>.', 'Từ Node 22.18 chạy được file .ts bằng cách xóa kiểu, nhưng không kiểm tra kiểu: vẫn cần <code>tsc --noEmit</code>.', 'zod/valibot: một schema vừa validate vừa suy ra kiểu (<code>z.infer</code>).'],
    qa: [['TypeScript có kiểm tra kiểu lúc chạy không?', 'Không. Kiểu bị xóa khi build. Dữ liệu từ ngoài (request, DB, queue) phải validate lúc chạy.'], ['unknown khác any?', 'any tắt kiểm tra kiểu; unknown buộc phải thu hẹp trước khi dùng nên an toàn.'], ['interface và type?', 'Gần giống. interface gộp khai báo và mở rộng; type mạnh hơn với union, mapped và conditional type. Chọn một quy ước trong team.']],
    code: { t: 'Discriminated union (chế độ TS)', lang: 'ts', src: `type Result =
  | { ok: true; data: string }
  | { ok: false; error: Error };

function show(r: Result): string {
  if (r.ok) return r.data;          // TS biết có data
  return r.error.message;           // ở đây có error
}
console.log(show({ ok: true, data: 'xong' }));
console.log(show({ ok: false, error: new Error('lỗi') }));
// Chế độ TS chỉ xóa kiểu, không báo lỗi kiểu. Dùng tsc --noEmit để kiểm tra.` } });

  T({ id: 'ts-adv', a: 'lang', t: 'TypeScript nâng cao và hợp đồng kiểu', lv: 5,
    sum: 'Công cụ ở mức kiểu cho thư viện dùng chung, và cách giữ kiểu client và server không lệch nhau.',
    flow: [['Nguồn sự thật', 'một schema (zod / OpenAPI)'], ['Sinh kiểu', 'z.infer hoặc codegen'], ['Server dùng', 'validate và trả đúng kiểu'], ['Client dùng', 'cùng kiểu, lệch là lỗi build'], ['CI kiểm tra', 'đổi hợp đồng thì build vỡ ngay']],
    pts: ['Conditional types, <code>infer</code>, mapped types, template literal types: dùng vừa đủ, kiểu quá phức tạp làm chậm trình biên dịch và khó đọc.', 'Branded (opaque) type để không nhầm <code>UserId</code> với <code>OrderId</code> dù cùng là string.', 'Kiểm tra vét cạn bằng <code>never</code> trong switch: thêm biến thể mới mà quên xử lý thì lỗi build.', 'Hợp đồng chung: schema làm nguồn (zod, OpenAPI codegen, tRPC, ts-rest) thay vì viết kiểu tay ở hai nơi.', 'Monorepo: project references, <code>import type</code>, tách package kiểu dùng chung.', 'Đừng để <code>as</code> và <code>!</code> lan rộng: mỗi chỗ là một lời hứa không được kiểm.'],
    qa: [['Branded type giải quyết vấn đề gì?', 'Hai id cùng kiểu string dễ bị truyền nhầm. Gắn một "nhãn" ảo vào kiểu để compiler phân biệt UserId với OrderId mà không tốn gì lúc chạy.'], ['Làm sao giữ kiểu API đồng bộ giữa frontend và backend?', 'Một nguồn sự thật: schema (zod hoặc OpenAPI). Sinh kiểu và client từ đó, và để CI build cả hai nơi để lệch hợp đồng là lỗi build.']],
    code: { t: 'Branded type và kiểm tra vét cạn (chế độ TS)', lang: 'ts', src: `type Brand<T, B> = T & { readonly __brand: B };
type UserId = Brand<string, 'UserId'>;
type OrderId = Brand<string, 'OrderId'>;
const userId = (s: string) => s as UserId;
const orderId = (s: string) => s as OrderId;

function layDon(id: OrderId) { return 'don ' + id; }
// layDon(userId('u1'));   // bỏ comment: lỗi build vì nhầm id (cần tsc để thấy)
console.log(layDon(orderId('o1')));

type Shape = { kind: 'tron'; r: number } | { kind: 'vuong'; a: number };
function dienTich(s: Shape): number {
  switch (s.kind) {
    case 'tron': return Math.PI * s.r ** 2;
    case 'vuong': return s.a ** 2;
    default: { const _vetCan: never = s; return _vetCan; }   // thêm biến thể mà quên xử lý thì lỗi build
  }
}
console.log(dienTich({ kind: 'vuong', a: 3 }));` } });

  T({ id: 'modules-npm', a: 'lang', t: 'Module, npm và monorepo', lv: 2,
    sum: 'ESM và CommonJS cùng tồn tại; lockfile và chuỗi cung ứng là phần dễ bị xem nhẹ.',
    flow: [['npm install', 'cập nhật lockfile khi phát triển'], ['Commit lockfile', 'khóa phiên bản chính xác'], ['CI: npm ci', 'cài đúng theo lockfile'], ['npm audit', 'kiểm tra lỗ hổng đã biết'], ['Phát hành', 'semver, changelog, provenance']],
    pts: ['CommonJS (<code>require</code>, đồng bộ) và ESM (<code>import</code>, tĩnh, top-level await). Dự án mới dùng ESM: <code>"type": "module"</code>.', '<code>^1.2.3</code> cho phép minor và patch; <code>~1.2.3</code> chỉ patch. <code>npm ci</code> cho CI.', 'Trường <code>exports</code> kiểm soát API công khai của package; <code>engines</code> và <code>.nvmrc</code> cố định bản Node.', 'Monorepo: workspaces (npm, pnpm), Turborepo hoặc Nx để cache build; tách package dùng chung có ranh giới rõ.', 'Chuỗi cung ứng: ít phụ thuộc, đọc kỹ gói lạ, bật audit trong CI, cân nhắc <code>--ignore-scripts</code>, bật 2FA và provenance khi phát hành.'],
    qa: [['CommonJS và ESM khác gì?', 'CJS: require, đồng bộ, có __dirname. ESM: import, tĩnh, bất đồng bộ, top-level await, chuẩn của ngôn ngữ. Dự án mới nên dùng ESM nhưng phải đọc được CJS.'], ['npm ci khác npm install?', 'npm ci cài đúng theo lockfile, nhanh, lỗi nếu lệch; dùng cho CI. npm install có thể cập nhật lockfile; dùng khi phát triển.'], ['Rủi ro chuỗi cung ứng npm là gì?', 'Gói phụ thuộc bị chiếm hoặc chèn mã xấu, script cài đặt chạy mã tùy ý. Giảm: ít phụ thuộc, khóa phiên bản, audit, cân nhắc tắt script cài đặt, review cập nhật.']] });

  /* ================= Runtime ================= */
  T({ id: 'event-loop', a: 'runtime', t: 'Event loop và thứ tự thực thi', lv: 2, sim: true,
    sum: 'Một luồng chạy JavaScript; việc chờ I/O giao cho hệ điều hành. Hiểu thứ tự thực thi là câu hỏi nền tảng nhất.',
    flow: [['Script chính', 'code đồng bộ chạy hết trước'], ['nextTick', 'xả hàng đợi process.nextTick'], ['Microtask', 'Promise.then và phần sau await'], ['Timers', 'setTimeout đến hạn'], ['Poll (I/O)', 'callback của file, mạng đã xong'], ['Check', 'setImmediate']],
    dgs: [{ w: 640, h: 300, nodes: [nd('a', 20, 12, 290, 50, 'Code của bạn (JS/TS)', 'a'), nd('b', 20, 82, 290, 50, 'V8\nchạy JavaScript', 'm'), nd('c', 20, 152, 290, 50, 'Node core APIs\nfs · http · crypto · stream', 'm'), nd('d', 20, 222, 290, 56, 'libuv\nevent loop + thread pool', 'info'), nd('e', 360, 152, 260, 56, 'Thread pool (mặc định 4)\nfs · crypto · zlib · dns.lookup', 'warn'), nd('f', 360, 226, 260, 52, 'Hệ điều hành\nepoll · kqueue · IOCP (socket)', 'ok')], edges: [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e', 'việc blocking'], ['d', 'f', 'I/O mạng']] }],
    pts: ['Sau mỗi callback Node xả <code>nextTick</code> rồi microtask, lặp đến hết, rồi mới sang việc kế tiếp.', 'Vòng lặp theo pha: timers, poll, check. Trong callback I/O thì <code>setImmediate</code> luôn trước <code>setTimeout</code>.', 'Trong script chính, <code>setTimeout(0)</code> và <code>setImmediate</code> không có thứ tự đảm bảo.', 'Đệ quy <code>nextTick</code> hoặc microtask liên tục làm đói I/O: event loop không bao giờ tới pha poll.', 'Socket mạng dùng epoll/kqueue; file, DNS lookup, crypto, zlib dùng thread pool (mặc định 4 luồng, <code>UV_THREADPOOL_SIZE</code>).'],
    qa: [['Node đơn luồng, sao phục vụ được nhiều kết nối?', 'JS chạy một luồng nhưng I/O không chặn: giao việc chờ cho hệ điều hành hoặc thread pool và đăng ký callback. Event loop chạy callback khi việc xong.'], ['Thứ tự nextTick, Promise, setTimeout, setImmediate?', 'Sau code đồng bộ: nextTick, microtask (Promise), rồi vòng lặp: timers, poll, check. Sau mỗi callback lại xả nextTick và microtask.'], ['Việc gì làm event loop bị đói?', 'Đệ quy nextTick hoặc Promise vô hạn, vòng lặp CPU nặng. Việc khác (kể cả I/O) không có cơ hội chạy.']],
    code: { t: 'Thứ tự thực thi kiểu Node', lang: 'js', src: `console.log('A');
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));
Promise.resolve().then(() => console.log('promise'));
process.nextTick(() => console.log('nextTick'));
console.log('B');
// Node: A B nextTick promise timeout immediate
// (editor mô phỏng nextTick và setImmediate; thứ tự timeout/immediate có thể khác Node thật)` } });

  T({ id: 'blocking', a: 'runtime', t: 'Chặn event loop, thread pool và worker threads', lv: 2,
    sum: 'Lỗi hiệu năng số một của Node: một việc nặng CPU làm mọi request khác đứng.',
    flow: [['Request đến', 'handler bắt đầu chạy'], ['Việc nặng CPU', 'vòng lặp, JSON lớn, regex xấu'], ['Luồng JS bị chiếm', 'không callback nào chạy được'], ['Request khác chờ', 'ping cũng bị trễ, health check lỗi'], ['Giải pháp', 'worker thread, queue hoặc tách service']],
    pts: ['Thủ phạm: vòng lặp CPU nặng, <code>JSON.parse</code>/<code>stringify</code> khổng lồ, regex thảm họa (ReDoS), API <code>*Sync</code> trong request, băm đồng bộ.', '<code>worker_threads</code>: luồng JS riêng cho việc CPU; dùng pool (ví dụ piscina) thay vì tạo worker mỗi request.', '<code>child_process</code>: chạy chương trình khác. <code>cluster</code>: nhiều process chung cổng; trong container thường 1 process/container và scale bằng orchestrator.', 'Đo độ trễ event loop (<code>perf_hooks.monitorEventLoopDelay</code>) và cảnh báo khi p99 tăng.', 'Việc dài hơn vài trăm ms: đưa ra queue, trả 202 và xử lý nền.'],
    qa: [['Khi nào dùng worker_threads, child_process, cluster?', 'worker_threads: việc CPU nặng trong cùng process. child_process: chương trình ngoài. cluster: tận dụng nhiều lõi bằng nhiều process chung cổng; trong container thường scale ngang thay vì cluster.'], ['Một endpoint đột nhiên làm cả server chậm, bạn kiểm tra gì?', 'Độ trễ event loop, profile CPU (--cpu-prof), tìm vòng lặp/regex/JSON lớn hoặc hàm Sync trên đường nóng. Sau đó tách khỏi luồng chính.']],
    code: { t: 'Thấy timer bị trễ khi luồng bị chặn', lang: 'js', src: `const t0 = Date.now();
setTimeout(() => console.log('timer chạy sau', Date.now() - t0, 'ms (mong muốn 10ms)'), 10);

const end = Date.now() + 300;
while (Date.now() < end) {}            // chặn luồng chính 300ms
console.log('xong vòng lặp chặn');
// Thử: bỏ vòng while rồi chạy lại, timer sẽ đúng hạn` } });

  T({ id: 'streams', a: 'runtime', t: 'Stream, Buffer và backpressure', lv: 2,
    sum: 'Xử lý dữ liệu theo từng mảnh nên bộ nhớ không đổi dù dữ liệu lớn đến đâu.',
    flow: [['Nguồn đọc (Readable)', 'file, request, con trỏ DB'], ['Biến đổi (Transform)', 'parse, nén, lọc từng mảnh'], ['Đích ghi (Writable)', 'socket, file, response'], ['Đích chậm', 'buffer đầy, write() trả false'], ['Backpressure', 'nguồn tạm dừng đến "drain"']],
    pts: ['Bốn loại: Readable, Writable, Duplex, Transform. Dùng <code>pipeline</code> (stream/promises) thay <code>pipe</code> để lỗi được truyền và tài nguyên được dọn.', '<code>for await (const chunk of stream)</code> đọc từng mảnh, tự tôn trọng backpressure.', '<code>readFile</code> nạp cả file vào RAM; file lớn thì dùng stream. Express trả file bằng <code>res</code> là một Writable.', 'Buffer là khối byte thô: <code>Buffer.byteLength</code> khác <code>length</code> của chuỗi có ký tự nhiều byte; luôn nói rõ encoding.', 'Web Streams (<code>ReadableStream</code>) có trong Node và trình duyệt, dùng với <code>fetch</code>.'],
    qa: [['Backpressure là gì?', 'Nơi ghi chậm báo cho nguồn đọc tạm dừng để không tràn bộ nhớ: write() trả false, nguồn dừng đến sự kiện drain.'], ['Xử lý file log 5 GB thế nào?', 'Stream: createReadStream + readline hoặc Transform, đọc từng dòng, bộ nhớ gần như không đổi. Không dùng readFile.']],
    code: { t: 'Async generator như một pipeline stream', lang: 'js', src: `async function* nguon() {
  for (let i = 1; i <= 5; i++) {
    await new Promise((r) => setTimeout(r, 50));
    yield 'dòng ' + i;
  }
}
async function* hoa(src) { for await (const x of src) yield x.toUpperCase(); }
async function* danhSo(src) { let n = 0; for await (const x of src) yield (++n) + ': ' + x; }

for await (const x of danhSo(hoa(nguon()))) console.log(x);
// Mỗi mảnh đi qua từng bước rồi mới tới mảnh sau: bộ nhớ không phình.
// Thử: thêm bước lọc chỉ giữ dòng chẵn` } });

  T({ id: 'errors', a: 'runtime', t: 'Lỗi, process và tắt êm', lv: 2,
    sum: 'Phân biệt lỗi vận hành với lỗi lập trình, xử lý lỗi ở một chỗ và tắt êm khi deploy.',
    flow: [['Nhận SIGTERM', 'deploy hoặc scale-in'], ['Ngừng nhận mới', 'server.close(), readiness = fail'], ['Chờ request đang chạy', 'có chốt chặn timeout cứng'], ['Đóng tài nguyên', 'DB, queue, flush log'], ['Thoát mã 0', 'không bị SIGKILL (137)']],
    pts: ['Lỗi vận hành (DB mất kết nối, input sai, timeout): bắt, trả mã lỗi, retry. Lỗi lập trình (bug): log fatal rồi thoát, orchestrator khởi động lại.', 'Một error handler tập trung biến lỗi thành phản hồi; lỗi có <code>code</code> ổn định; không lộ stack cho client; gắn <code>requestId</code>.', 'Dùng <code>new Error(msg, { cause })</code> để giữ chuỗi nguyên nhân.', '<code>unhandledRejection</code> và <code>uncaughtException</code>: log rồi thoát, đừng tiếp tục chạy trong trạng thái không rõ.', 'Tắt êm cần app nhận được SIGTERM: gọi <code>node</code> trực tiếp, không dùng <code>npm start</code> làm PID 1.'],
    qa: [['Tắt êm làm những gì?', 'Nhận SIGTERM, ngừng nhận kết nối mới, chờ request đang chạy, đóng DB và queue, thoát. Có timeout cứng để không treo.'], ['Vì sao nên crash khi có unhandledRejection?', 'Trạng thái ứng dụng không còn đáng tin. Log rõ rồi thoát để orchestrator khởi động lại sạch, hơn là chạy tiếp với dữ liệu có thể hỏng.'], ['Exit code 137 nghĩa là gì?', 'Process bị SIGKILL: thường do không tắt kịp sau SIGTERM hoặc hết bộ nhớ (OOMKilled).']],
    code: { t: 'Lỗi có nguyên nhân (cause) và mã ổn định', lang: 'js', src: `class AppError extends Error {
  constructor(code, message, options) { super(message, options); this.name = 'AppError'; this.code = code; }
}
async function layDon(id) {
  try { throw new Error('ECONNREFUSED 10.0.0.5:5432'); }
  catch (e) { throw new AppError('DB_DOWN', 'Không đọc được đơn ' + id, { cause: e }); }
}
try { await layDon(7); }
catch (e) { console.log(e.name, e.code, '<-', e.cause.message); }
// Thử: thêm lỗi NOT_FOUND và ánh xạ code sang mã HTTP trong một hàm` } });

  T({ id: 'memory', a: 'runtime', t: 'Bộ nhớ, GC và tìm rò rỉ', lv: 5,
    sum: 'RSS tăng dần rồi bị OOMKilled là sự cố kinh điển. Biết cách chứng minh và tìm nguồn rò.',
    flow: [['Triệu chứng', 'RSS hoặc heapUsed tăng dần, GC dày'], ['Xác nhận', 'đo heapUsed theo thời gian dưới tải'], ['Heap snapshot', '--inspect, chụp hai lần và so sánh'], ['Tìm đường giữ tham chiếu', 'retainers của object tăng bất thường'], ['Sửa', 'gỡ listener, giới hạn cache, WeakMap'], ['Kiểm chứng', 'chạy lại tải, heap phẳng']],
    pts: ['V8 chia heap: young (scavenge nhanh) và old (mark-sweep/compact). Object sống sót nhiều lần được đẩy sang old.', 'Giới hạn heap: <code>--max-old-space-size</code>. Trong container, RSS còn gồm Buffer, native và thread: đặt heap thấp hơn giới hạn bộ nhớ của container.', 'Nguồn rò quen thuộc: cache không giới hạn, listener không gỡ, biến toàn cục, closure giữ object lớn, timer không clear, mảng log trong RAM.', '<code>WeakMap</code>/<code>WeakRef</code> cho dữ liệu gắn vào vòng đời object khác; cache dùng LRU có trần.', 'Theo dõi <code>process.memoryUsage()</code> (heapUsed, rss, external) và số lần GC trong metric.'],
    qa: [['Bạn tìm rò bộ nhớ thế nào?', 'Xác nhận bằng đồ thị heapUsed dưới tải; chụp hai heap snapshot qua --inspect và so sánh; xem retainers của loại object tăng; sửa nguồn giữ tham chiếu; chạy lại tải để kiểm chứng.'], ['heapUsed khác rss thế nào?', 'heapUsed là phần heap V8 đang dùng. rss là toàn bộ bộ nhớ process chiếm, gồm cả Buffer, mã native, stack của thread. Container bị kill theo rss.']],
    code: { t: 'Cache không giới hạn so với LRU', lang: 'js', src: `class LRU {
  constructor(max) { this.max = max; this.m = new Map(); }
  get(k) { if (!this.m.has(k)) return; const v = this.m.get(k); this.m.delete(k); this.m.set(k, v); return v; }
  set(k, v) {
    this.m.delete(k); this.m.set(k, v);
    if (this.m.size > this.max) this.m.delete(this.m.keys().next().value);   // bỏ phần tử cũ nhất
  }
}
const khongTran = new Map(), lru = new LRU(1000);
for (let i = 0; i < 100000; i++) { khongTran.set('k' + i, { i }); lru.set('k' + i, { i }); }
console.log('cache không giới hạn:', khongTran.size, '| LRU có trần:', lru.m.size);` } });

  T({ id: 'perf', a: 'runtime', t: 'Hiệu năng: đo, profile, tối ưu', lv: 5,
    sum: 'Tối ưu theo số đo, không theo cảm giác. Biết tìm điểm nghẽn thật và giải thích bằng số.',
    flow: [['Đặt mục tiêu', 'ví dụ p95 dưới 300ms ở 200 rps'], ['Đo cơ sở', 'load test (autocannon, k6)'], ['Tìm điểm nghẽn', 'profile CPU, query, event loop lag'], ['Sửa một thứ', 'rồi đo lại, mỗi lần một thay đổi'], ['Chốt', 'ghi số trước và sau, thêm cảnh báo']],
    pts: ['Nhìn percentile (p50, p95, p99), không nhìn trung bình. Tail latency làm người dùng thấy chậm.', 'Thứ tự nghi ngờ: query DB (N+1, thiếu index), gọi dịch vụ ngoài, chặn event loop, bộ nhớ và GC, kích thước phản hồi.', 'Công cụ: <code>--cpu-prof</code> và flamegraph, <code>clinic</code>/<code>0x</code>, <code>--inspect</code>, <code>autocannon</code>, <code>k6</code>.', 'Cách tăng tốc phổ biến: gom (batch) và song song hóa I/O độc lập, cache, connection reuse (keep-alive), nén, phân trang, chọn trường.', 'Cẩn thận tối ưu sớm: đo trước, và ưu tiên thay đổi kiến trúc hơn vi chỉnh code.'],
    qa: [['Một API chậm, bạn làm gì?', 'Tái hiện và đo (p95), xem trace/log theo requestId để biết thời gian nằm ở đâu: DB, dịch vụ ngoài, CPU. Sửa nguyên nhân lớn nhất, đo lại, và chốt bằng số.'], ['Vì sao p99 quan trọng?', 'Một request người dùng thường gọi nhiều dịch vụ; tail latency nhân lên. Trung bình che mất những lần chậm nhất.']],
    code: { t: 'Tuần tự và song song', lang: 'js', src: `const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const items = Array.from({ length: 10 }, (_, i) => i);

let t = performance.now();
for (const i of items) await sleep(50);                   // 10 việc độc lập, chạy nối đuôi
console.log('tuần tự :', Math.round(performance.now() - t), 'ms');

t = performance.now();
await Promise.all(items.map(() => sleep(50)));            // chạy cùng lúc
console.log('song song:', Math.round(performance.now() - t), 'ms');
// Thử: giới hạn song song bằng pLimit và đo lại` } });

  T({ id: 'node-misc', a: 'runtime', t: 'Bộ công cụ lõi: EventEmitter, AsyncLocalStorage, AbortController', lv: 2,
    sum: 'Những mảnh nhỏ của Node xuất hiện trong mọi dự án thật.',
    flow: [['Request vào', 'middleware tạo requestId'], ['als.run(ngữ cảnh)', 'bọc phần còn lại của request'], ['Gọi hàm sâu bên trong', 'không truyền requestId qua tham số'], ['Log và gọi dịch vụ', 'als.getStore() lấy lại requestId'], ['Phản hồi', 'ngữ cảnh kết thúc cùng request']],
    pts: ['<code>EventEmitter</code>: sự kiện <code>error</code> không có listener sẽ ném lỗi và có thể crash process; cảnh báo khi quá nhiều listener là dấu hiệu rò.', '<code>AsyncLocalStorage</code> giữ ngữ cảnh (requestId, user) đi theo chuỗi gọi bất đồng bộ, nền của log truy vết và OpenTelemetry.', '<code>AbortController</code>/<code>AbortSignal.timeout</code> hủy fetch, stream, timer.', 'Cờ hay dùng: <code>--watch</code>, <code>--env-file</code>, <code>--inspect</code>, <code>--cpu-prof</code>, <code>--max-old-space-size</code>.', 'Chọn bản LTS đang hoạt động và kiểm tra lịch phát hành trên nodejs.org; ghim bằng <code>engines</code> và <code>.nvmrc</code>.'],
    qa: [['AsyncLocalStorage để làm gì?', 'Giữ ngữ cảnh theo từng request đi qua mọi lần await, để log và hàm sâu bên trong lấy requestId mà không phải truyền tham số.'], ['Làm sao hủy một fetch đang chạy?', 'Truyền signal của AbortController (hoặc AbortSignal.timeout) vào fetch rồi gọi abort().']],
    code: { t: 'EventEmitter và AbortController', lang: 'js', src: `import { EventEmitter } from 'node:events';
const bus = new EventEmitter();
bus.on('don-moi', (d) => console.log('gửi email cho đơn', d.id));
bus.on('don-moi', (d) => console.log('trừ kho cho đơn', d.id));
bus.emit('don-moi', { id: 1 });

try { bus.emit('error', new Error('nổ')); }
catch (e) { console.log('error không có listener ->', e.message); }

const ac = new AbortController();
ac.signal.addEventListener('abort', () => console.log('đã hủy:', ac.signal.reason));
ac.abort('hết giờ');` } });

  /* ================= API ================= */
  T({ id: 'http-rest', a: 'api', t: 'HTTP và REST đúng cách', lv: 2,
    sum: 'Phương thức, mã trạng thái, header và quy ước lỗi là ngôn ngữ chung giữa client và server.',
    flow: [['Client gửi request', 'method, path, header, body'], ['Gateway / load balancer', 'TLS, định tuyến, rate limit'], ['Ứng dụng', 'middleware, validate, nghiệp vụ'], ['Lưu và đẩy việc', 'DB, queue'], ['Trả lời', 'mã trạng thái đúng nghĩa + requestId']],
    pts: ['GET/PUT/DELETE idempotent; POST không. Tạo bằng POST trả <code>201</code> + <code>Location</code>, xử lý nền trả <code>202</code>.', 'Mã: 400/422 dữ liệu sai, 401 chưa xác thực, 403 không có quyền, 404, 409 xung đột, 429 kèm <code>Retry-After</code>, 5xx lỗi phía server, 503 tạm thời.', 'Định dạng lỗi thống nhất: <code>{ error: { code, message, details }, requestId }</code>; client xử lý theo <code>code</code>.', 'Phân trang cursor cho bảng lớn; lọc và sắp xếp có whitelist; giới hạn kích thước body.', 'Cache HTTP: <code>Cache-Control</code>, <code>ETag</code> và <code>If-None-Match</code>. CORS là cơ chế của trình duyệt, không phải bảo mật server.'],
    qa: [['PUT, PATCH, POST khác gì?', 'POST tạo hoặc thực hiện hành động, không idempotent. PUT thay thế toàn bộ, idempotent. PATCH sửa một phần.'], ['401 khác 403?', '401: chưa xác thực hoặc token sai. 403: đã xác thực nhưng không có quyền.'], ['CORS giải quyết vấn đề gì?', 'Trình duyệt chặn trang gọi API khác origin trừ khi server cho phép bằng header CORS. Nó bảo vệ người dùng trình duyệt, không thay cho xác thực phía server.']] });

  T({ id: 'middleware', a: 'api', t: 'Middleware và framework (Express, Fastify, NestJS)', lv: 2,
    sum: 'Mọi framework là một chuỗi bước có thứ tự cộng một chỗ bắt lỗi.',
    flow: [['requestId + log', 'gắn id, đo thời gian'], ['Đọc body', 'giới hạn kích thước'], ['Xác thực', 'JWT, API key'], ['Rate limit', 'chặn lạm dụng'], ['Validate', 'zod / schema'], ['Handler (use case)', 'nghiệp vụ'], ['Error handler', 'mọi lỗi về một chỗ']],
    pts: ['Thứ tự có lý do: xác thực trước validate để không tốn tài nguyên cho request không có quyền.', 'Express 5 tự chuyển lỗi/reject của handler async vào error handler; middleware lỗi có 4 tham số, đặt cuối.', 'Fastify: schema JSON validate và serialize nhanh, hệ plugin có encapsulation. NestJS: module, DI, guard, pipe, interceptor, filter (giống Spring).', 'Controller mỏng; nghiệp vụ ở service không biết HTTP.', 'Học một API bằng Express/Fastify trước để hiểu lớp mà NestJS che đi.'],
    qa: [['Middleware là gì, thứ tự quan trọng ra sao?', 'Hàm (req, res, next) chạy theo thứ tự đăng ký. Đặt id và log đầu tiên, xác thực trước validate, middleware lỗi cuối cùng.'], ['Chọn Express, Fastify hay NestJS?', 'Express: tối giản, phổ biến. Fastify: hiệu năng, schema. NestJS: cấu trúc, DI, hợp dự án lớn và người quen Spring.']],
    code: { t: 'Tự viết compose middleware (kiểu Koa)', lang: 'js', src: `function compose(mws) {
  return (ctx) => {
    let i = -1;
    const dispatch = async (n) => {
      if (n <= i) throw new Error('next() bị gọi nhiều lần');
      i = n;
      const fn = mws[n];
      if (fn) await fn(ctx, () => dispatch(n + 1));
    };
    return dispatch(0);
  };
}
const nhatKy = [];
const app = compose([
  async (c, next) => { nhatKy.push('requestId'); await next(); nhatKy.push('response ' + c.status); },
  async (c, next) => { if (!c.user) { c.status = 401; return; } nhatKy.push('auth ok'); await next(); },
  async (c) => { nhatKy.push('handler'); c.status = 200; },
]);
await app({ user: 'an' });   console.log(nhatKy.join(' > '));
nhatKy.length = 0;
await app({});               console.log(nhatKy.join(' > '));   // dừng ở auth` } });

  T({ id: 'validation', a: 'api', t: 'Validate đầu vào, cấu hình và lỗi', lv: 2,
    sum: 'Không tin dữ liệu từ ngoài. Cấu hình sai thì dừng ngay lúc khởi động.',
    flow: [['Dữ liệu vào', 'body, query, header, env'], ['Validate ở biên', 'schema, giới hạn, kiểu'], ['Sai thì dừng sớm', '422 hoặc không khởi động'], ['Dữ liệu đã tin cậy', 'có kiểu rõ ràng'], ['Nghiệp vụ', 'chạy trên dữ liệu sạch']],
    pts: ['Validate tại biên hệ thống bằng schema (zod, valibot, JSON schema), rồi dùng kiểu suy ra từ schema.', 'Cấu hình qua biến môi trường, validate lúc khởi động và in mọi lỗi một lượt (fail fast).', 'Giới hạn kích thước body, độ dài chuỗi, số phần tử mảng, độ sâu object.', 'Đừng trả nguyên entity DB ra ngoài: dùng DTO để không lộ trường nội bộ.', 'Lỗi validation trả <code>422</code> với danh sách trường sai rõ ràng.'],
    qa: [['Vì sao validate env lúc khởi động?', 'Fail fast: sai cấu hình lộ ra lúc deploy, không phải lúc đang phục vụ người dùng.'], ['Validate ở đâu: controller hay service?', 'Ở biên (controller/middleware) cho hình dạng dữ liệu; quy tắc nghiệp vụ ở service. Service nhận dữ liệu đã được tin cậy.']],
    code: { t: 'Validator tự viết trả mọi lỗi một lượt', lang: 'js', src: `function validate(body) {
  const loi = [];
  if (typeof body?.email !== 'string' || !/^[^@\\s]+@[^@\\s]+$/.test(body.email)) loi.push('email: không hợp lệ');
  if (!Number.isInteger(body?.age) || body.age < 0) loi.push('age: phải là số nguyên >= 0');
  if (body?.tags !== undefined && (!Array.isArray(body.tags) || body.tags.length > 5)) loi.push('tags: mảng tối đa 5 phần tử');
  return loi.length ? { ok: false, loi } : { ok: true, data: body };
}
console.log(validate({ email: 'an@x.vn', age: 20 }));
console.log(validate({ email: 'sai', age: -1, tags: [1, 2, 3, 4, 5, 6] }));` } });

  T({ id: 'layered', a: 'api', t: 'Phân lớp, DI, monolith và microservices', lv: 5,
    sum: 'Chia code theo ranh giới nghiệp vụ; tách service khi có lý do đo được, không phải theo mốt.',
    flow: [['Controller', 'HTTP: parse, mã trạng thái'], ['Use case / service', 'nghiệp vụ, không biết HTTP'], ['Repository / adapter', 'DB, queue, dịch vụ ngoài'], ['Hạ tầng', 'PostgreSQL, Redis, provider'], ['Kiểm thử', 'thay adapter bằng bản giả']],
    dgs: [{ w: 600, h: 214, nodes: [nd('a', 20, 12, 230, 44, 'Controller / route\nHTTP: parse, mã trạng thái', 'a'), nd('b', 20, 76, 230, 44, 'Use case / service\nnghiệp vụ, không biết HTTP', 'ok'), nd('c', 20, 140, 230, 44, 'Repository\ntruy vấn DB', 'm'), nd('d', 340, 140, 230, 44, 'PostgreSQL', 'info'), nd('e', 340, 76, 230, 44, 'Queue · provider ngoài', 'warn')], edges: [['a', 'b'], ['b', 'c'], ['c', 'd'], ['b', 'e']] }],
    pts: ['Phụ thuộc đi một chiều vào trong (hexagonal / ports and adapters): nghiệp vụ định nghĩa interface, hạ tầng thực hiện.', 'DI: truyền dependency qua constructor để thay bản giả khi test. Không cần framework DI, nhưng NestJS có sẵn.', '<b>Modular monolith trước</b>: ranh giới module rõ, một deploy. Tách microservice khi có lý do: đội độc lập, tải khác biệt, ranh giới triển khai.', 'Anti-pattern: nhiều service dùng chung một DB (monolith phân tán), gọi đồng bộ chuỗi dài, mỗi service tự do một công nghệ.', 'Di chuyển hệ thống cũ không downtime: <b>strangler fig</b>, chuyển dần từng route sang hệ thống mới sau một lớp định tuyến, chạy song song và so sánh.', 'Conway: kiến trúc phản ánh cách tổ chức đội.'],
    qa: [['Khi nào nên tách microservice?', 'Khi có lý do cụ thể: đội làm việc độc lập, tải hoặc yêu cầu mở rộng khác biệt, ranh giới nghiệp vụ ổn định. Bắt đầu bằng modular monolith, chi phí vận hành microservices (mạng, quan sát, nhất quán) là thật.'], ['Chuyển hệ thống PHP cũ sang Node mà không downtime?', 'Strangler fig: đặt proxy phía trước, chuyển từng route sang service mới, chạy song song, so sánh kết quả, chuyển dần traffic, dùng feature flag để lùi nhanh.'], ['DI giúp gì?', 'Tách logic khỏi hạ tầng, thay bản giả khi test, đổi cài đặt không sửa nghiệp vụ.']],
    code: { t: 'DI thủ công và test với repo giả', lang: 'js', src: `class OrderService {
  constructor(repo, clock) { this.repo = repo; this.clock = clock; }
  async dat(userId, items) {
    if (!items.length) throw new Error('đơn rỗng');
    const don = { userId, items, at: this.clock() };
    await this.repo.save(don);
    return don;
  }
}
// bản giả: không DB, giờ cố định
const daLuu = [];
const svc = new OrderService({ save: async (d) => daLuu.push(d) }, () => '2026-01-01T00:00:00Z');
console.log(await svc.dat('u1', [{ sku: 'a', qty: 1 }]));
try { await svc.dat('u1', []); } catch (e) { console.log('lỗi nghiệp vụ:', e.message); }
console.log('số đơn đã lưu:', daLuu.length);` } });

  T({ id: 'api-adv', a: 'api', t: 'Thiết kế API bền: idempotency, webhook, versioning, rate limit', lv: 5,
    sum: 'API công khai sống nhiều năm: phải tương thích ngược, an toàn khi gửi lại và tự bảo vệ.',
    flow: [['Client gửi kèm Idempotency-Key', 'cùng key cho mọi lần thử lại'], ['Server giành khóa', 'SET NX, chỉ một request thắng'], ['Xử lý và lưu kết quả', 'lưu response theo key'], ['Gửi lại cùng key', 'trả đúng kết quả cũ'], ['Khác body cùng key', 'trả 422']],
    pts: ['Tương thích ngược: chỉ thêm, không đổi nghĩa; deprecate có thời hạn và cảnh báo qua header; version trong đường dẫn hoặc header.', 'Thao tác dài: trả <code>202</code> + tài nguyên trạng thái hoặc webhook thay vì giữ kết nối.', 'Webhook: ký (HMAC) kèm timestamp chống replay, retry với backoff, id sự kiện để người nhận chống trùng, cho xem lịch sử giao.', 'Rate limit: token bucket, leaky bucket, sliding window; trả 429 kèm <code>Retry-After</code>; giới hạn theo key/người dùng/IP; chia sẻ trạng thái qua Redis khi nhiều instance.', 'Pagination cursor ổn định; bulk endpoint có giới hạn; OpenAPI là hợp đồng, kiểm tra trong CI.'],
    qa: [['Thiết kế webhook an toàn thế nào?', 'Ký payload bằng HMAC kèm timestamp để người nhận xác thực và chống replay; gửi event id để dedupe; retry với backoff; người nhận trả 2xx nhanh rồi xử lý nền; có log giao và cho phép gửi lại.'], ['Các thuật toán rate limit?', 'Token bucket (cho bùng nổ có kiểm soát), leaky bucket (đầu ra đều), fixed window (đơn giản, bị dồn ở rìa), sliding window (chính xác hơn, tốn bộ nhớ hơn).'], ['Làm sao thay đổi API mà không phá client cũ?', 'Chỉ thêm trường/endpoint, không đổi nghĩa hay xóa; thay đổi phá vỡ thì version mới, giữ bản cũ đủ lâu và thông báo deprecation.']],
    code: { t: 'Token bucket với đồng hồ giả', lang: 'js', src: `class TokenBucket {
  constructor(cap, perSec, now = () => Date.now()) { this.cap = cap; this.perSec = perSec; this.now = now; this.tokens = cap; this.last = now(); }
  take(n = 1) {
    const t = this.now();
    this.tokens = Math.min(this.cap, this.tokens + ((t - this.last) / 1000) * this.perSec);
    this.last = t;
    if (this.tokens < n) return { ok: false, retryAfter: Math.ceil((n - this.tokens) / this.perSec) };
    this.tokens -= n; return { ok: true };
  }
}
let gio = 0;
const b = new TokenBucket(3, 1, () => gio);        // dung lượng 3, nạp 1 token/giây
console.log([1, 2, 3, 4].map(() => b.take().ok));  // true true true false
gio += 2000;                                       // 2 giây sau
console.log(b.take(), b.take(), b.take());        // 2 lần ok, lần 3 bị chặn` } });

  T({ id: 'graphql-grpc', a: 'api', t: 'GraphQL, gRPC và khi nào dùng', lv: 5,
    sum: 'Chọn giao thức theo người dùng của nó: bên ngoài, giao diện nhiều màn hình, hay nội bộ giữa service.',
    flow: [['Resolver gọi load(id) N lần', 'mỗi ô dữ liệu một lần'], ['DataLoader gom lại', 'đợi hết tick hiện tại'], ['Một truy vấn gộp', 'WHERE id IN (...)'], ['Chia kết quả về từng resolver', 'đúng thứ tự khóa'], ['Cache theo request', 'cùng khóa không gọi lại']],
    pts: ['<b>REST</b>: đơn giản, cache HTTP tốt, hợp API công khai. <b>GraphQL</b>: client chọn trường, hợp giao diện nhiều nhu cầu; cần chống N+1 (DataLoader), giới hạn độ sâu/độ phức tạp, khó cache hơn.', '<b>gRPC</b>: protobuf, hợp đồng chặt, streaming, deadline; hợp giao tiếp nội bộ giữa service, ít hợp trình duyệt trực tiếp.', '<b>BFF</b> (backend for frontend): một lớp riêng cho mỗi loại client để gom dữ liệu.', 'Dù chọn gì: version, deadline/timeout, lỗi có cấu trúc, quan sát từng lời gọi.'],
    qa: [['GraphQL có vấn đề N+1 không, xử lý thế nào?', 'Có: mỗi resolver con gọi DB riêng. Dùng DataLoader để gom các lời gọi trong cùng tick thành một truy vấn rồi chia kết quả.'], ['Khi nào chọn gRPC thay vì REST?', 'Giao tiếp nội bộ giữa service cần hợp đồng chặt, hiệu năng và streaming. Với API công khai và trình duyệt, REST thường hợp hơn.']],
    code: { t: 'DataLoader tự viết: gom N lời gọi thành 1', lang: 'js', src: `function dataLoader(batchFn) {
  let queue = [], scheduled = false;
  return {
    load(key) {
      return new Promise((resolve, reject) => {
        queue.push({ key, resolve, reject });
        if (scheduled) return;
        scheduled = true;
        queueMicrotask(async () => {              // chờ hết tick hiện tại rồi gom
          const batch = queue; queue = []; scheduled = false;
          try { const vals = await batchFn(batch.map((b) => b.key)); batch.forEach((b, i) => b.resolve(vals[i])); }
          catch (e) { batch.forEach((b) => b.reject(e)); }
        });
      });
    },
  };
}
let lanGoiDB = 0;
const users = dataLoader(async (ids) => { lanGoiDB++; return ids.map((id) => ({ id, ten: 'user' + id })); });
const kq = await Promise.all([1, 2, 3, 4, 5].map((id) => users.load(id)));
console.log(kq.length, 'user, số lần gọi DB:', lanGoiDB);   // 5 user, 1 lần` } });

  T({ id: 'realtime', a: 'api', t: 'Realtime: polling, SSE, WebSocket và cách scale', lv: 5,
    sum: 'Đẩy dữ liệu xuống client; điểm khó là giữ kết nối khi có nhiều instance.',
    flow: [['Client kết nối', 'WebSocket/SSE, xác thực khi bắt tay'], ['Instance giữ kết nối', 'trạng thái nằm trong RAM'], ['Sự kiện phát sinh', 'worker đẩy lên pub/sub'], ['Pub/sub chia tới các instance', 'Redis, SNS, dịch vụ quản lý'], ['Instance đẩy xuống đúng client', 'theo phòng hoặc user']],
    pts: ['Polling đơn giản; SSE một chiều server tới client, tự nối lại, đi qua proxy tốt; WebSocket hai chiều, cần quản lý kết nối.', 'Heartbeat/ping để phát hiện kết nối chết; client nối lại với backoff có jitter và gửi <code>Last-Event-ID</code> để không mất tin.', 'Scale ngang: kết nối nằm ở instance cụ thể, nên cần pub/sub chung (Redis, SNS) hoặc dịch vụ quản lý (API Gateway WebSocket).', 'Client chậm gây backpressure: giới hạn hàng đợi gửi và ngắt kết nối khi quá tải.', 'Graceful shutdown: báo client nối lại trước khi tắt instance.'],
    qa: [['WebSocket scale ngang thế nào?', 'Mỗi kết nối nằm ở một instance, nên cần pub/sub chung để mọi instance nhận sự kiện và đẩy tới client của mình. Load balancer cần hỗ trợ giữ kết nối dài; khi tắt instance cần để client nối lại.'], ['SSE và WebSocket chọn cái nào?', 'Chỉ cần server đẩy xuống thì SSE đơn giản hơn (HTTP thường, tự nối lại). Cần giao tiếp hai chiều độ trễ thấp thì WebSocket.']],
    code: { t: 'Backoff mũ có jitter cho việc nối lại', lang: 'js', src: `function backoff(attempt, base = 500, cap = 30000) {
  const exp = Math.min(cap, base * 2 ** attempt);
  return Math.round(Math.random() * exp);          // "full jitter": ngẫu nhiên trong [0, exp]
}
for (let i = 0; i < 8; i++) console.log('lần', i + 1, '-> chờ tối đa', Math.min(30000, 500 * 2 ** i), 'ms, chọn', backoff(i), 'ms');
// Vì sao jitter: để hàng nghìn client không cùng nối lại một lúc sau sự cố` } });

  /* ================= Bảo mật ================= */
  T({ id: 'authn-authz', a: 'sec', t: 'Xác thực, phân quyền, JWT, OAuth2', lv: 2,
    sum: 'Biết bạn là ai (xác thực) khác với bạn được làm gì (phân quyền). Lỗi phân quyền là loại lỗi nghiêm trọng phổ biến nhất.',
    flow: [['Đăng nhập', 'kiểm tra mật khẩu đã băm'], ['Phát token', 'access (ngắn) + refresh (dài)'], ['Gọi API', 'Authorization: Bearer'], ['Server verify', 'chữ ký, hạn, thuật toán đã ghim'], ['Kiểm tra quyền', 'trên từng tài nguyên'], ['Hết hạn', 'dùng refresh để lấy access mới']],
    pts: ['JWT stateless nên khó thu hồi: access token vài phút, refresh token xoay vòng và phát hiện dùng lại, lưu phía server.', 'Verify phải ghim thuật toán; payload chỉ được ký, không mã hóa, không để dữ liệu nhạy cảm.', 'Mật khẩu: băm chậm có salt (argon2, bcrypt); giới hạn đăng nhập sai; hỗ trợ MFA.', 'OAuth2 Authorization Code + PKCE cho SPA và mobile; OIDC thêm lớp danh tính (ID token). Đừng tự thiết kế giao thức.', 'Cookie: <code>HttpOnly</code>, <code>Secure</code>, <code>SameSite</code>; lưu token trong localStorage dễ bị XSS đánh cắp.', 'Phân quyền: RBAC (vai trò) hoặc ABAC (thuộc tính); luôn kiểm tra quyền sở hữu tài nguyên ở server (chống IDOR).'],
    qa: [['JWT bị đánh cắp thì thu hồi thế nào?', 'JWT stateless nên khó thu hồi trước hạn. Thiết kế: access token ngắn, refresh token xoay vòng lưu phía server (thu hồi được), và danh sách chặn khi cần.'], ['Luồng OAuth2 Authorization Code với PKCE?', 'Client tạo code_verifier và gửi code_challenge khi chuyển hướng tới nhà cung cấp; nhận code; đổi code lấy token kèm code_verifier. PKCE ngăn kẻ chặn code dùng được nó.'], ['IDOR là gì?', 'Server tin id do client gửi mà không kiểm tra người dùng có sở hữu tài nguyên đó không. Phòng bằng kiểm tra quyền trên từng tài nguyên.']],
    code: { t: 'JWT thủ công: ký HMAC và phát hiện giả mạo', lang: 'js', src: `const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
const b64s = (s) => b64(enc.encode(s));
async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}
async function sign(payload, secret) {
  const h = b64s(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), p = b64s(JSON.stringify(payload));
  return h + '.' + p + '.' + await hmac(secret, h + '.' + p);
}
async function verify(token, secret) {
  const [h, p, s] = token.split('.');
  if (s !== await hmac(secret, h + '.' + p)) throw new Error('chữ ký sai');
  const payload = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
  if (payload.exp < Date.now() / 1000) throw new Error('token hết hạn');
  return payload;
}
const token = await sign({ sub: 'u1', role: 'user', exp: Math.floor(Date.now() / 1000) + 60 }, 'bi-mat');
console.log('token:', token.slice(0, 40) + '...');
console.log('hợp lệ:', await verify(token, 'bi-mat'));
const [h, , s] = token.split('.');
const gia = h + '.' + b64s(JSON.stringify({ sub: 'u1', role: 'admin', exp: 9999999999 })) + '.' + s;   // tự nâng quyền
try { await verify(gia, 'bi-mat'); } catch (e) { console.log('token giả mạo bị từ chối:', e.message); }` } });

  T({ id: 'owasp', a: 'sec', t: 'OWASP, bí mật, chuỗi cung ứng và threat modeling', lv: 5,
    sum: 'Bảo mật là thói quen thiết kế và vận hành, không phải một tính năng thêm vào cuối.',
    flow: [['Xác định tài sản', 'dữ liệu nào đáng bảo vệ'], ['Vẽ luồng dữ liệu', 'ranh giới tin cậy'], ['Liệt kê mối đe dọa', 'STRIDE cho từng ranh giới'], ['Chọn biện pháp', 'giảm hoặc chấp nhận có lý do'], ['Kiểm chứng', 'test, review, quét phụ thuộc']],
    pts: ['Injection: query tham số hóa; validate input; không nối chuỗi vào SQL/lệnh.', 'SSRF: không gọi URL do người dùng cung cấp mà không lọc (chặn dải IP nội bộ và metadata của cloud).', 'Prototype pollution: gộp object không kiểm khóa <code>__proto__</code>; dùng <code>Map</code> hoặc <code>Object.create(null)</code>.', 'ReDoS, body/zip bomb: giới hạn kích thước, độ dài, thời gian.', 'Bí mật: Secrets Manager/SSM, không để trong repo hay image, xoay vòng, quyền tối thiểu, đừng log.', 'Chuỗi cung ứng: khóa phiên bản, quét phụ thuộc, review cập nhật, SBOM, CI dùng OIDC thay khóa dài hạn.', 'Mã hóa khi truyền (TLS) và khi lưu; log sự kiện bảo mật (đăng nhập, đổi quyền) và cảnh báo bất thường.'],
    qa: [['Prototype pollution là gì?', 'Kẻ tấn công chèn khóa __proto__ qua JSON để hàm gộp object ghi vào Object.prototype, làm mọi object có thuộc tính do họ đặt. Phòng: bỏ qua khóa nguy hiểm, dùng Map hoặc Object.create(null), validate schema.'], ['SSRF là gì và phòng thế nào?', 'Server bị lừa gọi tới địa chỉ do kẻ tấn công chọn, ví dụ endpoint metadata nội bộ của cloud. Phòng: whitelist đích, chặn dải IP nội bộ, tắt chuyển hướng không cần, dùng IMDSv2.'], ['Quản lý bí mật thế nào?', 'Lưu trong Secrets Manager hoặc SSM Parameter Store, nạp lúc chạy, không commit, phân quyền tối thiểu, xoay vòng định kỳ, không ghi vào log.']],
    code: { t: 'Prototype pollution và cách phòng', lang: 'js', src: `function merge(t, s) {
  for (const k in s) {
    if (typeof s[k] === 'object' && s[k] !== null) t[k] = merge(t[k] || {}, s[k]);
    else t[k] = s[k];
  }
  return t;
}
const doc = JSON.parse('{"__proto__": {"admin": true}}');
merge({}, doc);
console.log('({}).admin =', ({}).admin);          // true: Object.prototype bị ô nhiễm

function mergeAnToan(t, s) {
  for (const k of Object.keys(s)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    t[k] = typeof s[k] === 'object' && s[k] !== null ? mergeAnToan(t[k] ?? {}, s[k]) : s[k];
  }
  return t;
}
// Lưu ý: ở trên Object.prototype đã bị ô nhiễm trong lần chạy này; chạy lại để thấy bản an toàn.
console.log(mergeAnToan(Object.create(null), doc));` } });
})(window.NH);
