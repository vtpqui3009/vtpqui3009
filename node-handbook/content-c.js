/* Nội dung phần 3: AWS, DevOps, thiết kế hệ thống, kỹ năng. */
(function (NH) {
  const nd = NH.nd;
  const T = (o) => NH.topics.push(o);

  /* ================= AWS ================= */
  T({ id: 'aws-core', a: 'aws', t: 'AWS cốt lõi: IAM, VPC, S3, CloudFront, tính toán, DB', lv: 2,
    sum: 'Những dịch vụ gặp ở mọi dự án AWS và cách chúng nối với nhau.',
    flow: [['Người dùng', 'trình duyệt, mobile'], ['Route 53 + CloudFront', 'DNS, CDN, TLS (ACM)'], ['Load balancer (ALB)', 'phân tải, kiểm tra sức khỏe'], ['Ứng dụng', 'ECS/EC2/Lambda trong subnet riêng'], ['RDS / DynamoDB / S3', 'dữ liệu, trong mạng riêng']],
    pts: ['<b>IAM</b>: ưu tiên role (quyền tạm thời) hơn user và khóa dài hạn; policy theo quyền tối thiểu; Deny luôn thắng Allow; CI dùng OIDC thay khóa tĩnh.', '<b>VPC</b>: subnet public (có đường ra Internet) và private; app và DB ở private; <b>Security Group</b> có trạng thái, gắn với tài nguyên; <b>NACL</b> không trạng thái, gắn với subnet; NAT Gateway cho đường ra từ private (tốn phí đáng kể).', '<b>S3</b>: không công khai bucket; presigned URL để upload/download có hạn; versioning, lifecycle; với CloudFront dùng OAC.', '<b>CloudFront</b>: cache theo behavior, vô hiệu hóa (invalidation) tốn kém: đặt tên file có hash.', '<b>RDS</b>: Multi-AZ là dự phòng chuyển đổi dự phòng (failover), không phải để mở rộng đọc; read replica mới tăng đọc (bất đồng bộ).', 'Bí mật ở Secrets Manager/SSM Parameter Store; log và metric ở CloudWatch.'],
    qa: [['Security Group và NACL khác gì?', 'Security Group có trạng thái (cho phép phản hồi tự động), gắn vào tài nguyên, chỉ có quy tắc cho phép. NACL không trạng thái, gắn vào subnet, có cả cho phép và từ chối, cần quy tắc cho cả hai chiều.'], ['Multi-AZ và read replica khác gì?', 'Multi-AZ: bản chờ ở AZ khác để failover tự động, tập trung vào sẵn sàng. Read replica: bản sao bất đồng bộ để chia tải đọc, có độ trễ nhân bản.'], ['Role và user IAM?', 'Role dùng quyền tạm thời được khoác bởi dịch vụ hoặc người, không có khóa dài hạn. Ưu tiên role; user với access key dài hạn là rủi ro khi lộ.']] });

  T({ id: 'serverless', a: 'aws', t: 'Serverless: Lambda, API Gateway, SQS, DynamoDB', lv: 2,
    sum: 'Cùng tư duy với queue ở trên, chạy trên dịch vụ quản lý: API ghi và đẩy job, Lambda xử lý, DLQ nhận job hỏng.',
    flow: [['Client gọi API Gateway', 'xác thực, throttling'], ['Lambda API', 'validate, ghi DynamoDB'], ['Gửi job vào SQS', 'trả 202'], ['Lambda worker', 'nhận batch, xử lý'], ['Lỗi một phần', 'trả batchItemFailures'], ['Quá maxReceiveCount', 'job vào DLQ']],
    dgs: [{ w: 780, h: 290, nodes: [nd('c', 6, 74, 100, 48, 'Client', 'm'), nd('g', 136, 74, 120, 48, 'API Gateway', 'info'), nd('l', 290, 74, 120, 48, 'Lambda API\nvalidate, ghi', 'a'), nd('d', 560, 14, 150, 48, 'DynamoDB', 'ok'), nd('q', 470, 124, 130, 48, 'SQS queue', 'warn'), nd('w', 640, 124, 130, 48, 'Lambda worker\nxử lý job', 'a'), nd('x', 470, 222, 130, 48, 'DLQ', 'bad')], edges: [['c', 'g'], ['g', 'l'], ['l', 'd'], ['l', 'q', 'gửi job'], ['q', 'w', 'trigger batch'], ['w', 'd'], ['q', 'x', 'quá maxReceiveCount']] }],
    pts: ['Lambda: cold start (giảm bằng bundle nhỏ, khởi tạo client ngoài handler, tăng memory); có timeout tối đa; reserved/provisioned concurrency; kết nối DB cần proxy/pool phù hợp.', 'SQS + Lambda: bật <b>ReportBatchItemFailures</b> để chỉ thử lại message lỗi; visibility timeout lớn hơn nhiều timeout của function (tài liệu AWS khuyến nghị ít nhất 6 lần, hãy kiểm tra lại); DLQ với <code>maxReceiveCount</code>.', 'SQS Standard: at-least-once, thứ tự không đảm bảo. FIFO: thứ tự theo message group, khử trùng, thông lượng thấp hơn.', 'API Gateway: REST API (nhiều tính năng) và HTTP API (rẻ, nhanh); authorizer (JWT/Lambda); throttling.', '<b>DynamoDB</b>: truy vấn theo khóa; ghi có điều kiện cho idempotency; tránh Scan; GSI; TTL.', 'Việc dài hơn giới hạn Lambda: Step Functions hoặc container; EventBridge cho định tuyến sự kiện và lịch.', 'Quan sát: log có cấu trúc, X-Ray hoặc OpenTelemetry, cảnh báo trên DLQ và độ tuổi message cũ nhất.'],
    qa: [['Một Lambda nhận batch 5 message SQS, message thứ 3 lỗi, chuyện gì xảy ra?', 'Nếu không cấu hình thì cả batch bị thử lại, kể cả 4 message đã xong, gây xử lý trùng. Bật ReportBatchItemFailures và trả danh sách id message lỗi để chỉ thử lại những message đó (và handler vẫn phải idempotent).'], ['Lambda cold start là gì, giảm thế nào?', 'Thời gian khởi tạo môi trường ở lần đầu. Giảm: bundle nhỏ (esbuild), khởi tạo client ngoài handler, tăng memory (tăng CPU), provisioned concurrency khi cần.'], ['Chọn Lambda hay container?', 'Lambda: tải thất thường, việc ngắn, ít vận hành. Container (ECS/EKS): chạy dài, kết nối bền (websocket), cần kiểm soát runtime, tải ổn định và cao.']],
    code: { t: 'Xử lý batch SQS với báo lỗi từng phần (mô phỏng)', lang: 'js', src: `// Mô phỏng handler của Lambda nhận một batch SQS
async function handler(event) {
  const batchItemFailures = [];
  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body);
      if (body.poison) throw new Error('poison');
      console.log('đã xử lý', record.messageId);
    } catch {
      batchItemFailures.push({ itemIdentifier: record.messageId });   // chỉ message này bị thử lại
    }
  }
  return { batchItemFailures };
}
const event = { Records: [
  { messageId: 'm1', body: '{"a":1}' },
  { messageId: 'm2', body: '{"poison":true}' },
  { messageId: 'm3', body: '{"a":3}' },
] };
console.log(await handler(event));
// Thử: thêm kiểm tra idempotency bằng Set các messageId đã xử lý` } });

  T({ id: 'iac', a: 'aws', t: 'Hạ tầng bằng code và quyền tối thiểu', lv: 2,
    sum: 'Hạ tầng mô tả trong file, review như code, dựng lại được, không có "cấu hình bấm tay không ai nhớ".',
    flow: [['Sửa template / code hạ tầng', 'trong nhánh git'], ['Plan / synth / diff', 'xem trước thay đổi'], ['Review PR', 'cả code và hạ tầng'], ['Deploy bằng CI', 'role OIDC, không khóa dài hạn'], ['Phát hiện drift', 'so trạng thái thật với mô tả']],
    pts: ['SAM: serverless thuần, YAML gọn, chạy thử cục bộ. CDK: viết bằng TypeScript, tái sử dụng, vòng lặp, sinh quyền tối thiểu (<code>grantXxx</code>). CloudFormation là nền của cả hai. Terraform: đa đám mây, state riêng cần bảo vệ.', 'Quyền tối thiểu: đúng hành động trên đúng tài nguyên (ARN cụ thể); tránh <code>*</code>; mỗi service một role riêng.', 'Tách môi trường (dev, staging, prod) bằng tài khoản hoặc stack riêng; tham số hóa chứ không sao chép.', 'Bí mật không nằm trong template; tham chiếu Secrets Manager/SSM.', 'Đặt DLQ, cảnh báo và retention log ngay trong IaC.', 'ARN: <code>arn:aws:dịch-vụ:region:tài-khoản:tên</code>; S3 và IAM bỏ trống region/tài khoản.'],
    qa: [['Vì sao dùng IaC thay vì bấm console?', 'Dựng lại được, review được, có lịch sử trong git, tránh drift và cấu hình thủ công không ai nhớ.'], ['SAM, CDK hay Terraform?', 'SAM: serverless thuần và đơn giản. CDK: muốn dùng ngôn ngữ lập trình, tái sử dụng. Terraform: đa đám mây hoặc tổ chức đã dùng sẵn. Chọn theo kỹ năng đội và phạm vi.'], ['Cho CI quyền deploy lên AWS thế nào cho an toàn?', 'Dùng OIDC của nhà cung cấp CI để khoác một role có thời hạn ngắn, thay vì lưu access key dài hạn trong CI.']] });

  T({ id: 'containers', a: 'aws', t: 'Chọn nền tảng chạy: Lambda, ECS/Fargate, EKS, EC2', lv: 5,
    sum: 'Câu hỏi quyết định kiến trúc: ai vận hành, tải thế nào, ràng buộc gì.',
    flow: [['Đặc điểm tải', 'thất thường hay ổn định, thời gian chạy'], ['Ràng buộc', 'kết nối bền, GPU, đa đám mây'], ['Năng lực đội', 'ai vận hành K8s?'], ['Chọn nền tảng', 'Lambda, Fargate, EKS, EC2'], ['Đo chi phí và vận hành', 'xem lại khi thay đổi']],
    pts: ['<b>Lambda</b>: ít vận hành, trả theo lượt gọi, hợp tải thất thường; giới hạn thời gian và mô hình lập trình.', '<b>ECS Fargate</b>: container không quản máy, đơn giản hơn K8s; hợp đa số dịch vụ web.', '<b>EKS</b>: Kubernetes quản lý, hệ sinh thái lớn, khả năng di động; đổi lại độ phức tạp (nâng cấp, mạng, bảo mật, IRSA/Pod Identity).', '<b>EC2</b>: kiểm soát tối đa, tự vận hành (vá, scale, image).', 'Autoscaling theo CPU, độ sâu queue, hoặc số kết nối; kiểm tra thời gian khởi động.', 'Service discovery, ALB, secrets inject qua task role, mạng riêng.'],
    qa: [['Chọn ECS hay EKS?', 'ECS Fargate đơn giản, ít vận hành, hợp đa số dịch vụ. EKS khi cần hệ sinh thái Kubernetes, di động giữa đám mây hoặc tính năng đặc thù; chấp nhận chi phí vận hành cao hơn.'], ['Khi nào Lambda không hợp?', 'Việc chạy dài, kết nối bền (websocket), tải cao và ổn định (chi phí cao hơn container), phụ thuộc runtime đặc biệt, hoặc cần kiểm soát độ trễ khởi động chặt.']] });

  T({ id: 'cost-reliability', a: 'aws', t: 'Độ tin cậy, DR và chi phí', lv: 5,
    sum: 'Thiết kế cho lỗi phần cứng và lỗi người; biết tiền đi đâu.',
    flow: [['Xác định RPO và RTO', 'mất tối đa bao nhiêu dữ liệu, dừng bao lâu'], ['Chọn chiến lược DR', 'backup, pilot light, warm standby, active-active'], ['Sao lưu và nhân bản', 'đa AZ, đa vùng nếu cần'], ['Diễn tập khôi phục', 'restore thử định kỳ'], ['Theo dõi chi phí', 'gắn thẻ, ngân sách, cảnh báo']],
    pts: ['Chạy đa AZ cho dịch vụ quan trọng; điểm lỗi đơn lẻ (một instance, một NAT, một AZ) cần được nhận diện.', 'DR: backup/restore (rẻ, RTO lâu) → pilot light → warm standby → active-active (đắt, RTO thấp). Chọn theo RPO/RTO mà nghiệp vụ chịu được.', '<b>Backup chưa thử khôi phục thì chưa phải backup.</b>', 'Chi phí: right-size, Savings Plans/Reserved cho tải ổn định, Spot cho tải chịu gián đoạn, S3 storage class và lifecycle, chú ý NAT Gateway và truyền dữ liệu giữa vùng, retention log.', 'Gắn thẻ (tag) tài nguyên theo đội và dịch vụ; ngân sách và cảnh báo bất thường chi phí.', 'Well-Architected: vận hành, bảo mật, tin cậy, hiệu năng, chi phí, bền vững.'],
    qa: [['RPO và RTO là gì?', 'RPO: lượng dữ liệu tối đa chấp nhận mất (tính bằng thời gian). RTO: thời gian tối đa chấp nhận hệ thống ngừng. Hai số này quyết định chiến lược DR và chi phí.'], ['Làm sao giảm hóa đơn AWS mà không giảm chất lượng?', 'Đo trước: right-size tài nguyên thừa, Savings Plans cho tải ổn định, lifecycle cho S3, giảm retention log, kiểm NAT và truyền dữ liệu, tắt môi trường không dùng; gắn thẻ để biết ai tiêu bao nhiêu.']] });

  /* ================= DevOps ================= */
  T({ id: 'docker', a: 'ops', t: 'Docker: image tốt, an toàn và nhận đúng tín hiệu', lv: 2,
    sum: 'Image nhỏ, chạy không phải root, và tắt êm được là ba điểm đầu tiên.',
    flow: [['Giai đoạn build', 'npm ci, build TypeScript'], ['Giai đoạn chạy', 'chỉ thư viện production + dist'], ['USER node', 'không chạy root'], ['CMD ["node", ...]', 'node là PID 1, nhận SIGTERM'], ['Health check / probe', 'orchestrator kiểm tra']],
    pts: ['Multi-stage: image cuối không chứa công cụ build; <code>npm ci --omit=dev</code>; <code>.dockerignore</code>.', 'Thứ tự lớp để tận dụng cache: chép <code>package*.json</code> và cài thư viện trước, chép mã nguồn sau.', 'Không dùng <code>npm start</code> làm PID 1: tín hiệu có thể không tới app. Dùng dạng mảng <code>CMD ["node", ...]</code> (hoặc init như tini).', 'Bí mật không nằm trong image hay biến build; ghim phiên bản base image (tag hoặc digest); quét lỗ hổng.', 'Giới hạn bộ nhớ container và <code>--max-old-space-size</code> phải khớp nhau.'],
    qa: [['Vì sao container Node bị kill 10 giây sau docker stop?', 'App không nhận được SIGTERM nên bị SIGKILL sau thời hạn (exit 137). Thường do npm start làm PID 1 hoặc không xử lý tín hiệu.'], ['Image Node tốt trông thế nào?', 'Multi-stage, base nhỏ và ghim phiên bản, cài thư viện đúng lockfile cho production, chạy user không root, CMD gọi node trực tiếp, có health check, không chứa bí mật.']],
    code: { t: 'Mẫu Dockerfile (chỉ để đọc, editor chạy JS)', lang: 'js', src: `// Editor chạy JavaScript. Dưới đây là Dockerfile mẫu, đặt trong chuỗi để bạn so với dự án của mình.
const dockerfile = \`FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]\`;
console.log(dockerfile);
console.log('--- tự kiểm tra ---');
for (const [ten, ok] of [
  ['multi-stage', dockerfile.split('FROM').length > 2],
  ['không chạy root', dockerfile.includes('USER node')],
  ['cài đúng lockfile', dockerfile.includes('npm ci')],
  ['gọi node trực tiếp', /CMD \\["node"/.test(dockerfile)],
]) console.log(ok ? 'đạt  ' : 'CHƯA ', ten);` } });

  T({ id: 'k8s', a: 'ops', t: 'Kubernetes: đọc manifest, probe, tài nguyên, rolling update', lv: 2,
    sum: 'Đủ để đọc manifest, gỡ lỗi pod và hiểu vì sao pod bị khởi động lại.',
    flow: [['Apply Deployment mới', 'tạo ReplicaSet mới'], ['Pod mới khởi động', 'readiness chưa đạt: chưa nhận traffic'], ['Readiness đạt', 'Service chuyển traffic tới pod mới'], ['Pod cũ nhận SIGTERM', 'tắt êm trong terminationGracePeriod'], ['Lặp đến hết', 'maxSurge, maxUnavailable giới hạn tốc độ']],
    pts: ['Pod là đơn vị chạy; Deployment giữ đủ số bản và cập nhật cuốn chiếu; Service cho địa chỉ ổn định; Ingress cho cổng HTTP; HPA tự scale theo tải.', '<b>Liveness</b> fail thì khởi động lại; <b>readiness</b> fail thì ngừng chuyển traffic; <b>startup</b> probe cho app khởi động chậm.', '<code>requests</code> dùng để xếp lịch, <code>limits</code> là trần: vượt bộ nhớ thì bị <b>OOMKilled</b>; vượt CPU thì bị throttling (chậm chứ không bị kill).', 'PodDisruptionBudget giữ đủ bản khi bảo trì node; cấu hình qua ConfigMap, bí mật qua Secret (hoặc trình quản lý ngoài).', 'Gỡ lỗi: <code>kubectl describe pod</code>, <code>logs -f</code>, <code>exec</code>; <code>CrashLoopBackOff</code> = app thoát liên tục, <code>ImagePullBackOff</code> = không kéo được image.', 'EKS: IRSA hoặc Pod Identity để pod có quyền AWS riêng, không dùng khóa tĩnh.'],
    qa: [['Liveness và readiness khác nhau thế nào?', 'Liveness: process còn sống không (không thì khởi động lại). Readiness: sẵn sàng nhận traffic chưa, kiểm tra phụ thuộc như DB (chưa thì tạm ngừng chuyển traffic, không khởi động lại).'], ['Pod bị OOMKilled là gì?', 'Dùng bộ nhớ vượt limit nên bị kernel kill. Kiểm tra rò bộ nhớ, đặt limit và --max-old-space-size hợp lý, nhớ rằng RSS gồm cả Buffer và native.'], ['Rolling update diễn ra thế nào?', 'Tạo pod mới và chờ readiness đạt trước khi tắt pod cũ, theo maxSurge và maxUnavailable. Pod cũ tắt êm nhờ SIGTERM và grace period.']] });

  T({ id: 'cicd', a: 'ops', t: 'CI/CD và chiến lược deploy', lv: 5,
    sum: 'Deploy nhỏ, thường xuyên, lùi được. Tách deploy (đưa code lên) khỏi release (bật cho người dùng).',
    flow: [['Commit / PR', 'chạy kiểm tra'], ['Lint, typecheck, test', 'cổng chất lượng'], ['Build image bất biến', 'gắn tag theo commit'], ['Deploy staging + smoke', 'kiểm tra luồng chính'], ['Deploy production dần', 'canary hoặc rolling'], ['Quan sát và lùi', 'tự động lùi nếu SLO xấu đi']],
    pts: ['<b>Rolling</b>: thay dần, mặc định, cần tương thích hai phiên bản. <b>Blue-green</b>: hai môi trường, đổi traffic cùng lúc, lùi tức thì, tốn gấp đôi tài nguyên. <b>Canary</b>: một phần nhỏ traffic trước, mở rộng dần theo số đo.', 'Artifact bất biến, cùng một image đi từ staging tới production; cấu hình đến từ môi trường.', 'Migration DB trong pipeline phải tương thích ngược (expand/contract); chạy trước hoặc sau theo từng bước.', '<b>Feature flag</b>: tách deploy khỏi release, bật dần theo nhóm, tắt nhanh khi sự cố; dọn flag cũ.', 'GitOps (Argo CD, Flux): trạng thái mong muốn trong git, bộ điều khiển đồng bộ.', 'Bảo mật pipeline: OIDC, quyền tối thiểu, quét phụ thuộc và image, ký artifact.'],
    qa: [['Blue-green và canary khác gì?', 'Blue-green: hai môi trường đầy đủ, chuyển toàn bộ traffic cùng lúc, lùi tức thì, tốn gấp đôi. Canary: chuyển một phần nhỏ traffic sang bản mới, quan sát số đo rồi mở rộng, phát hiện lỗi sớm với tác động nhỏ.'], ['Lùi (rollback) khi có migration DB thì sao?', 'Vì thế migration phải tương thích ngược theo expand/contract. Code cũ vẫn chạy được trên schema mới; dữ liệu đã ghi thường xử lý bằng sửa tiến (forward fix).'], ['Feature flag để làm gì?', 'Tách deploy khỏi release: đưa code lên an toàn, bật dần cho nhóm nhỏ, tắt ngay khi có sự cố, không cần deploy lại.']] });

  T({ id: 'observability', a: 'ops', t: 'Quan sát: log, metric, trace, SLO, cảnh báo', lv: 2,
    sum: 'Ba loại tín hiệu trả lời ba câu hỏi: chuyện gì xảy ra, hệ thống khỏe không, chậm ở đâu.',
    flow: [['Cảnh báo kích hoạt', 'vi phạm SLO, triệu chứng người dùng thấy'], ['Xem metric', 'RED: rate, errors, duration'], ['Theo trace', 'dịch vụ nào chậm'], ['Đọc log theo requestId', 'nguyên nhân cụ thể'], ['Sửa và ghi lại', 'runbook, cảnh báo cải tiến']],
    pts: ['<b>Log</b>: JSON có cấu trúc, requestId/traceId, đúng mức, che bí mật và dữ liệu cá nhân (pino <code>redact</code>).', '<b>Metric</b>: RED cho dịch vụ (rate, errors, duration percentile), USE cho tài nguyên; thêm độ trễ event loop, độ sâu queue, DLQ, kích thước pool.', '<b>Trace</b>: OpenTelemetry; truyền ngữ cảnh qua header <code>traceparent</code> và qua message queue.', '<b>SLI/SLO</b>: đo điều người dùng cảm nhận (tỉ lệ thành công, độ trễ); ngân sách lỗi cho phép đánh đổi tốc độ phát hành và độ ổn định.', 'Cảnh báo theo triệu chứng (người dùng bị ảnh hưởng) hơn là nguyên nhân; mỗi cảnh báo phải hành động được; tránh cảnh báo gây mệt.', 'Cẩn thận cardinality của nhãn metric (id người dùng làm nhãn sẽ làm nổ chi phí).'],
    qa: [['SLI, SLO và error budget là gì?', 'SLI: số đo thực tế (ví dụ tỉ lệ request thành công). SLO: mục tiêu cho SLI (99,9%). Error budget: phần còn được phép lỗi; dùng nó để quyết định giữa phát hành nhanh và ổn định.'], ['Cảnh báo tốt là gì?', 'Dựa trên triệu chứng người dùng thấy, hành động được, có runbook, ngưỡng hợp lý để không gây mệt; không cảnh báo cho mọi nguyên nhân có thể.'], ['Làm sao theo dõi một request qua nhiều service?', 'Truyền trace id (traceparent) qua mọi lời gọi và message, ghi nó trong log và trace để nối các đoạn lại.']],
    code: { t: 'Log JSON kèm requestId (closure thay cho AsyncLocalStorage)', lang: 'js', src: `function taoLogger(boiCanh) {
  const ghi = (muc) => (msg, extra = {}) => console.log(JSON.stringify({ t: 0, muc, msg, ...boiCanh, ...extra }));
  return { info: ghi('info'), error: ghi('error'), con: (them) => taoLogger({ ...boiCanh, ...them }) };
}
const goc = taoLogger({ service: 'orders' });
async function xuLyRequest(req) {
  const log = goc.con({ requestId: req.id });
  log.info('nhận request', { path: req.path });
  try { throw new Error('DB timeout'); }
  catch (e) { log.error('xử lý lỗi', { err: e.message }); }
}
await xuLyRequest({ id: 'r-1', path: '/orders' });
await xuLyRequest({ id: 'r-2', path: '/orders/7' });
// Mọi dòng log của một request mang cùng requestId: lọc một id là thấy cả chuỗi.` } });

  T({ id: 'incident', a: 'ops', t: 'Xử lý sự cố và postmortem', lv: 5,
    sum: 'Khi hệ thống hỏng: dừng chảy máu trước, tìm nguyên nhân sau, rút bài học không đổ lỗi.',
    flow: [['Phát hiện', 'cảnh báo hoặc báo cáo'], ['Đánh giá mức độ', 'người dùng nào bị ảnh hưởng'], ['Giảm thiểu', 'lùi bản, tắt flag, scale, chuyển hướng'], ['Truyền thông', 'cập nhật trạng thái đều đặn'], ['Điều tra nguyên nhân gốc', 'sau khi đã ổn định'], ['Postmortem không đổ lỗi', 'hành động khắc phục có người phụ trách']],
    pts: ['Ưu tiên khôi phục dịch vụ hơn tìm nguyên nhân: lùi bản gần nhất hoặc tắt feature flag là nước đi đầu.', 'Có người điều phối sự cố, người xử lý kỹ thuật và người truyền thông; ghi timeline trong lúc xử lý.', 'Runbook cho các sự cố đã biết; on-call có quyền và công cụ để hành động.', 'Postmortem: timeline, tác động, nguyên nhân gốc (5 whys), điều làm tốt, điều cần cải thiện, hành động có chủ và hạn.', 'Văn hóa không đổ lỗi: hỏi "hệ thống cho phép điều này xảy ra thế nào" thay vì "ai làm".', 'Đo MTTD (phát hiện) và MTTR (khôi phục).'],
    qa: [['Kể về một sự cố bạn đã xử lý.', 'Dùng STAR: tình huống và tác động, vai trò của bạn, các bước giảm thiểu rồi điều tra, kết quả và hành động khắc phục. Nêu phần bạn thật sự làm và bài học; nếu chưa có sự cố lớn, kể một sự cố nhỏ hoặc cách bạn chuẩn bị (runbook, cảnh báo).'], ['Sự cố đang diễn ra, bạn làm gì đầu tiên?', 'Đánh giá tác động, giảm thiểu nhanh (lùi bản, tắt flag), thông báo, rồi mới điều tra nguyên nhân gốc khi đã ổn định.']] });

  /* ================= Thiết kế hệ thống ================= */
  T({ id: 'design-framework', a: 'design', t: 'Khung trả lời thiết kế hệ thống và ước lượng', lv: 5,
    sum: 'Đừng nhảy vào vẽ hộp. Làm rõ yêu cầu và ước lượng trước, nói đánh đổi trong từng lựa chọn.',
    flow: [['Làm rõ yêu cầu', 'chức năng, phi chức năng, ngoài phạm vi'], ['Ước lượng', 'tải, dữ liệu, băng thông'], ['API và mô hình dữ liệu', 'điểm vào, bảng chính'], ['Kiến trúc tổng thể', 'luồng đầu cuối'], ['Đào sâu điểm khó', 'nghẽn, nhất quán, lỗi'], ['Rủi ro và đo lường', 'cảnh báo, cách mở rộng']],
    pts: ['Hỏi: bao nhiêu người dùng, đọc nhiều hay ghi nhiều, độ trễ chấp nhận, cần đảm bảo không mất, ưu tiên nhất quán hay sẵn sàng.', 'Ước lượng nhanh: 1 triệu request/ngày ≈ 12 request/giây trung bình; đỉnh thường gấp 3 đến 10 lần. 100.000/ngày ≈ 1,2/giây.', 'Dung lượng: số bản ghi × kích thước × thời gian lưu × hệ số nhân bản; luôn nêu giả định.', 'Mỗi lựa chọn nêu đánh đổi (nhất quán so với sẵn sàng, đơn giản so với linh hoạt).', 'Kết thúc bằng rủi ro: điểm lỗi đơn lẻ, thứ gì hỏng đầu tiên khi tải tăng 10 lần, và cách bạn sẽ biết.'],
    qa: [['Bạn bắt đầu một câu hỏi thiết kế hệ thống thế nào?', 'Làm rõ yêu cầu chức năng và phi chức năng, hỏi quy mô, ước lượng tải và dữ liệu, rồi mới phác API, dữ liệu và kiến trúc. Nêu đánh đổi và rủi ro ở cuối.'], ['Tải trung bình 12 rps, đỉnh 10 lần, bạn xử lý thế nào?', '120 rps là mức một vài instance Node xử lý được nếu chủ yếu I/O; nghẽn thường ở DB, nên đo và dựng cache/replica/queue theo nhu cầu, không thiết kế quá mức.']] });

  T({ id: 'design-notify', a: 'design', t: 'Bài mẫu: dịch vụ thông báo (kiểu Novu)', lv: 5,
    sum: 'API nhận nhanh, queue tách lỗi của nhà cung cấp, worker gửi có retry, kết quả đẩy realtime.',
    flow: [['POST /trigger', 'xác thực, rate limit, idempotency, validate'], ['Ghi notification (queued)', 'DB'], ['Đẩy job vào queue', 'trả 202 ngay'], ['Worker lấy job', 'render template, chọn kênh'], ['Gửi qua provider', 'retry với backoff, đánh dấu đã gửi'], ['Cập nhật trạng thái', 'sent / failed'], ['Đẩy realtime', 'queue riêng tới dịch vụ WebSocket']],
    fail: [4, 'Provider lỗi', 'retry; hết lượt thì DLQ và cảnh báo'],
    dgs: [{ w: 780, h: 250, nodes: [nd('c', 6, 90, 100, 48, 'Client', 'm'), nd('a', 140, 90, 130, 48, 'API\nauth·limit·idem', 'a'), nd('db', 330, 20, 140, 48, 'Database\nnotifications', 'info'), nd('q', 330, 110, 140, 48, 'Queue\nstandard', 'warn'), nd('d', 330, 195, 140, 44, 'DLQ + cảnh báo', 'bad'), nd('w', 530, 110, 130, 48, 'Worker\nretry·backoff', 'a'), nd('p', 700, 110, 76, 48, 'Provider', 'm'), nd('ws', 530, 195, 130, 44, 'WS realtime', 'ok')], edges: [['c', 'a'], ['a', 'db'], ['a', 'q', '202'], ['q', 'w'], ['w', 'p'], ['q', 'd'], ['w', 'ws']] }],
    pts: ['Yêu cầu: không được mất thông báo; email trễ vài giây chấp nhận được; hàng triệu người dùng; có ưu tiên (OTP gấp hơn bản tin).', 'Tách queue theo mức ưu tiên để thông báo hàng loạt không làm chậm OTP.', 'Ba lớp chống trùng (Idempotency-Key, transactionId, jobId) và handler idempotent; lưu trạng thái từng kênh.', 'Tùy chọn của người dùng (kênh, giờ yên lặng), digest/gộp, giới hạn tần suất theo người nhận.', 'Quy mô: scale worker theo độ sâu queue; provider có giới hạn tốc độ nên cần rate limit phía gửi; circuit breaker cho provider.', 'Quan sát: độ sâu queue, tuổi job cũ nhất, tỉ lệ gửi thành công theo provider, DLQ; truy vết theo notificationId.', 'Code tham khảo mini-novu trong thư mục của bạn: chạy được và có mô phỏng từng kịch bản lỗi.'],
    qa: [['Provider email ngừng 30 phút, hệ thống xử lý thế nào?', 'Queue giữ job, worker retry với backoff, circuit breaker ngừng gọi khi lỗi liên tục; hết lượt thì vào DLQ để đẩy lại khi provider phục hồi; có cảnh báo. Người dùng không thấy lỗi ở API vì đã trả 202.'], ['Làm sao OTP không bị chậm khi gửi bản tin hàng loạt?', 'Tách queue và nhóm worker theo mức ưu tiên, giới hạn tốc độ riêng cho tin hàng loạt.']] });

  T({ id: 'design-ratelimiter', a: 'design', t: 'Bài mẫu: rate limiter phân tán', lv: 5,
    sum: 'Giới hạn tần suất theo khóa với nhiều instance: cần trạng thái chung và thao tác nguyên tử.',
    flow: [['Request đến', 'xác định khóa (API key, user, IP)'], ['Hỏi kho chung', 'Redis, một script nguyên tử'], ['Tính token / cửa sổ', 'cập nhật và quyết định'], ['Cho phép', 'xử lý tiếp, trả header còn lại bao nhiêu'], ['Từ chối', '429 + Retry-After']],
    fail: [1, 'Redis không phản hồi', 'quyết định mở hay đóng khi lỗi (fail-open / fail-closed)'],
    pts: ['Thuật toán: token bucket (cho bùng nổ có kiểm soát), sliding window counter (cân bằng chính xác và chi phí), fixed window (đơn giản, dồn ở rìa).', 'Nguyên tử: một script Lua hoặc lệnh đơn để tránh race giữa đọc và ghi.', 'Fail-open (cho qua) giữ dịch vụ sống nhưng mất bảo vệ; fail-closed an toàn hơn nhưng có thể chặn nhầm. Chọn theo giá trị cần bảo vệ.', 'Giới hạn nhiều tầng: theo IP ở biên (CDN/WAF), theo API key ở gateway, theo thao tác tốn kém ở ứng dụng.', 'Trả header cho client: giới hạn, còn lại, thời điểm đặt lại, <code>Retry-After</code>.', 'Hot key: một khóa nhận quá nhiều gây nghẽn node Redis.'],
    qa: [['Thiết kế rate limiter cho nhiều instance?', 'Trạng thái nằm ở Redis, mỗi request chạy một script nguyên tử (token bucket hoặc sliding window), trả quyết định và header. Quyết định trước về fail-open/closed và giới hạn nhiều tầng.'], ['Token bucket và fixed window khác gì?', 'Token bucket nạp token đều và cho bùng nổ tới dung lượng; fixed window đếm theo khung cố định nên có thể dồn gấp đôi ở rìa hai khung.']],
    code: { t: 'Sliding window counter', lang: 'js', src: `class SlidingWindow {
  constructor(gioiHan, cuaSoMs, now = () => Date.now()) { this.gioiHan = gioiHan; this.cuaSoMs = cuaSoMs; this.now = now; this.dem = new Map(); }
  cho(khoa) {
    const t = this.now(), cs = Math.floor(t / this.cuaSoMs), pos = (t % this.cuaSoMs) / this.cuaSoMs;
    const hienTai = this.dem.get(khoa + ':' + cs) ?? 0, truoc = this.dem.get(khoa + ':' + (cs - 1)) ?? 0;
    const uocLuong = truoc * (1 - pos) + hienTai;                 // ước lượng số request trong cửa sổ trượt
    if (uocLuong >= this.gioiHan) return false;
    this.dem.set(khoa + ':' + cs, hienTai + 1); return true;
  }
}
let gio = 0;
const rl = new SlidingWindow(5, 1000, () => gio);
console.log('5 request đầu:', [1, 2, 3, 4, 5].map(() => rl.cho('u1')));
console.log('request thứ 6:', rl.cho('u1'));
gio = 1500;                                                       // sang cửa sổ kế
console.log('0,5 giây sau khung mới:', rl.cho('u1'), '(vẫn bị tính phần của khung trước)');
gio = 2600;
console.log('sau 2,6 giây:', rl.cho('u1'));` } });

  T({ id: 'design-orders', a: 'design', t: 'Bài mẫu: luồng đặt hàng đáng tin cậy', lv: 5,
    sum: 'Ghép các mảnh: idempotency, outbox, saga, xử lý lỗi thanh toán, và trải nghiệm trạng thái trung gian.',
    flow: [['POST /orders + Idempotency-Key', 'tạo đơn ở trạng thái PENDING'], ['Outbox cùng transaction', 'đơn + sự kiện OrderCreated'], ['Giữ hàng', 'service kho, ghi có điều kiện'], ['Thanh toán', 'gọi nhà cung cấp kèm idempotency key'], ['Xác nhận', 'đơn PAID, phát OrderPaid'], ['Thông báo và giao hàng', 'consumer độc lập, idempotent']],
    fail: [3, 'Thanh toán lỗi', 'bước bù: nhả hàng, đơn FAILED'],
    pts: ['API trả nhanh với trạng thái PENDING; client theo dõi bằng polling hoặc sự kiện đẩy.', 'Mọi bước là idempotent và có timeout; trạng thái saga được lưu bền để tiếp tục sau khi crash.', 'Gọi thanh toán timeout (không biết kết quả): truy vấn trạng thái bằng idempotency key, không tự bù khi chưa biết; đối soát định kỳ.', 'Tồn kho: cập nhật có điều kiện (stock &gt; 0) để không bán vượt; hàng giữ có hạn để tự nhả.', 'Quan sát: số đơn kẹt ở PENDING quá lâu là cảnh báo; DLQ của từng consumer.', 'Kiểm chứng bằng test lỗi ở từng bước.'],
    qa: [['Khách bấm thanh toán hai lần, làm sao không trừ tiền hai lần?', 'Idempotency-Key ở API đặt hàng và ở lời gọi thanh toán, trạng thái đơn chỉ chuyển một lần (cập nhật có điều kiện), và ràng buộc unique trên giao dịch.'], ['Thanh toán thành công nhưng cập nhật đơn lỗi thì sao?', 'Nhờ outbox/saga lưu trạng thái, tiến trình tiếp tục sau khi khởi động lại và truy vấn trạng thái thanh toán để hoàn tất; có đối soát định kỳ làm lưới an toàn cuối.']] });

  /* ================= Kỹ năng ================= */
  T({ id: 'senior', a: 'soft', t: 'Kỹ năng của dev kỳ cựu: quyết định, review, nợ kỹ thuật', lv: 5,
    sum: 'Từ "làm được" sang "chọn đúng việc, giảm rủi ro, giúp cả đội mạnh lên".',
    flow: [['Hiểu vấn đề thật', 'hỏi vì sao, ai bị ảnh hưởng'], ['Nêu các phương án', 'kèm đánh đổi'], ['Quyết định và ghi lại', 'ADR ngắn'], ['Làm nhỏ, kiểm chứng sớm', 'flag, canary, đo lường'], ['Xem lại kết quả', 'quyết định có đúng không']],
    pts: ['Nêu đánh đổi thay vì tuyên bố "cách đúng". Ghi quyết định bằng ADR: bối cảnh, lựa chọn, hệ quả.', 'Giảm rủi ro bằng cách làm nhỏ và có thể lùi: tách việc, feature flag, đo trước và sau.', 'Review như mentoring: giải thích lý do, phân biệt bắt buộc với gợi ý, khen điều tốt.', 'Nợ kỹ thuật: nhìn thấy được (ghi lại), định giá (chi phí giữ), và trả có kế hoạch cạnh tính năng, không để dồn.', 'Ước lượng: nêu khoảng và giả định, chia nhỏ, báo sớm khi lệch.', 'Giao tiếp: nói với người không chuyên bằng tác động và rủi ro, không bằng thuật ngữ.', 'Ownership: chịu trách nhiệm đến khi chạy tốt ở production (on-call, theo dõi sau deploy).'],
    qa: [['Bạn quyết định thế nào giữa tự xây và mua/dùng dịch vụ có sẵn?', 'So tổng chi phí sở hữu (xây, vận hành, rủi ro) với tính độc đáo của nhu cầu. Mặc định dùng thứ có sẵn cho phần không tạo khác biệt; tự xây khi nó là lợi thế hoặc dịch vụ không đáp ứng. Ghi quyết định và điều kiện để xem lại.'], ['Bạn xử lý bất đồng kỹ thuật trong nhóm thế nào?', 'Làm rõ mục tiêu chung và tiêu chí, so các phương án bằng dữ liệu hoặc prototype nhỏ, nêu đánh đổi; nếu vẫn chưa thống nhất thì người chịu trách nhiệm quyết định và ghi lại lý do.'], ['Bạn quản lý nợ kỹ thuật thế nào?', 'Ghi lại và gắn chi phí (tốc độ, lỗi, rủi ro), ưu tiên phần đang làm chậm đội, trả dần cạnh tính năng thay vì dự án lớn, và tránh tạo nợ mới không ý thức.']] });

  T({ id: 'interview-craft', a: 'soft', t: 'Cách trả lời phỏng vấn trung thực mà thuyết phục', lv: 2,
    sum: 'Người phỏng vấn thường hỏi sâu thêm hai đến ba câu. Nói đúng mức độ vừa an toàn vừa thuyết phục.',
    flow: [['Nghe kỹ, làm rõ', 'hỏi lại nếu mơ hồ'], ['Nói điều bạn đã làm', 'phần của bạn, cụ thể'], ['Giải thích cơ chế', 'vì sao nó hoạt động'], ['Nêu giới hạn', 'phần mới học hoặc chưa làm production'], ['Kể kết quả', 'điều đo được, nếu có']],
    pts: ['Công thức: <b>Đã làm → Hiểu → Đang học</b>. "Tôi đã làm … Tôi hiểu cơ chế … Phần … tôi mới thực hành ở mức lab và đang đào sâu."', 'STAR cho câu hỏi dự án: Tình huống, Nhiệm vụ (phần của bạn), Hành động (2-3 việc cụ thể và lý do), Kết quả (số liệu thật).', 'Chưa biết thì nói thẳng rồi lập luận: "Phần đó tôi chưa làm production. Theo cách tôi hiểu thì …, và tôi sẽ kiểm chứng bằng …".', 'Không bịa số liệu, tên dự án hay công nghệ chưa dùng; câu hỏi đào sâu sẽ làm lộ.', 'Bài code: nói to suy nghĩ, làm rõ yêu cầu, viết bản đơn giản chạy đúng trước, rồi tối ưu; nêu các ca biên.', 'Câu hỏi ngược: về vận hành (on-call, deploy), quy trình review, mục tiêu chất lượng, cách đội học hỏi.'],
    qa: [['Bạn nhận mình mạnh và yếu ở đâu?', 'Nêu điểm mạnh kèm bằng chứng cụ thể; điểm yếu có thật kèm cách bạn đang cải thiện. Tránh những điểm yếu "ngụy trang" như "tôi cầu toàn quá".'], ['Bạn chưa dùng X ở production, sao tin bạn làm được?', 'Nói thật phần chưa làm, nêu điều bạn đã học và dựng thử (lab, dự án nhỏ), và cách bạn sẽ tiếp cận để lên đúng tốc độ trong dự án.'], ['Kể về một lần bạn mắc lỗi.', 'Chọn lỗi thật, nêu tác động, bạn phát hiện và khắc phục thế nào, bạn đã thay đổi quy trình hay thói quen gì để không lặp lại.']] });
})(window.NH);
