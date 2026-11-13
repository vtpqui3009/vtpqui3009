/* Node Handbook: bộ máy giao diện, sơ đồ quy trình, mô phỏng event loop và editor. */
(function () {
  'use strict';
  const NH = window.NH;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  const strip = (h) => h.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const mem = {};
  const store = {
    get(k) { try { const v = localStorage.getItem(k); return v === null ? (mem[k] ?? null) : v; } catch { return mem[k] ?? null; } },
    set(k, v) { mem[k] = v; try { localStorage.setItem(k, v); } catch {} },
  };

  const areas = NH.areas, topics = NH.topics;
  const byId = Object.fromEntries(topics.map((t) => [t.id, t]));
  const areaOf = Object.fromEntries(areas.map((a) => [a.id, a]));
  topics.forEach((t) => (t.areaObj = areaOf[t.a]));
  const STATE = { lv: +(store.get('nh:lv') || 5), area: null, q: '' };
  const visible = (t) => t.lv <= STATE.lv;
  const topicsOf = (aid) => topics.filter((t) => t.a === aid && visible(t));
  const isKnown = (id) => store.get('nh:k:' + id) === '1';
  const nQA = topics.reduce((s, t) => s + t.qa.length, 0), nCode = topics.filter((t) => t.code).length;

  /* ---------- tô màu code ---------- */
  const KW = new Set('const let var function return if else for while do await async import from export new class extends try catch finally throw typeof of in type interface default break continue switch case null undefined true false this yield satisfies as implements readonly static public private protected constructor super void never'.split(' '));
  function hl(src, lang) {
    const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b[A-Za-z_$][\w$]*\b)|(\b\d[\d_.]*\b)/g;
    let out = '', last = 0, m;
    while ((m = re.exec(src))) {
      out += esc(src.slice(last, m.index));
      if (m[1]) out += '<span class="cm">' + esc(m[1]) + '</span>';
      else if (m[2]) out += '<span class="s">' + esc(m[2]) + '</span>';
      else if (m[3]) out += KW.has(m[3]) ? '<span class="k">' + m[3] + '</span>' : esc(m[3]);
      else out += '<span class="n">' + m[4] + '</span>';
      last = re.lastIndex;
    }
    return out + esc(src.slice(last));
  }

  /* ---------- sơ đồ tĩnh ---------- */
  let dgN = 0;
  function dg({ w, h, nodes, edges = [] }) {
    const id = 'ah' + dgN++, N = {}; nodes.forEach((n) => (N[n.id] = n));
    const nodeSvg = (n) => { const lines = n.t.split('\n'), lh = 15, y0 = n.y + n.h / 2 - (lines.length * lh) / 2 + 11;
      return '<g class="t-' + (n.tone || 'm') + '"><rect x="' + n.x + '" y="' + n.y + '" width="' + n.w + '" height="' + n.h + '" rx="8"/>' + lines.map((l, i) => '<text class="' + (i ? 'sub' : '') + '" x="' + (n.x + n.w / 2) + '" y="' + (y0 + i * lh) + '" text-anchor="middle" font-size="' + (i ? 11 : 13) + '" font-weight="' + (i ? 400 : 600) + '">' + esc(l) + '</text>').join('') + '</g>'; };
    const edgeSvg = ([a, b, label]) => { const A = N[a], B = N[b], ax = A.x + A.w / 2, ay = A.y + A.h / 2, bx = B.x + B.w / 2, by = B.y + B.h / 2, dx = bx - ax, dy = by - ay;
      const k1 = Math.min(A.w / 2 / Math.abs(dx || 1e-9), A.h / 2 / Math.abs(dy || 1e-9)), k2 = Math.min((B.w / 2 + 5) / Math.abs(dx || 1e-9), (B.h / 2 + 5) / Math.abs(dy || 1e-9));
      const x1 = ax + dx * k1, y1 = ay + dy * k1, x2 = bx - dx * k2, y2 = by - dy * k2;
      let s = '<line class="edge" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" marker-end="url(#' + id + ')"/>';
      if (label) { const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, lw = label.length * 6.2 + 10; s += '<rect class="lblbg" x="' + (mx - lw / 2) + '" y="' + (my - 9) + '" width="' + lw + '" height="17" rx="4" stroke="none"/><text class="lbl" x="' + mx + '" y="' + (my + 3.5) + '" text-anchor="middle">' + esc(label) + '</text>'; }
      return s; };
    return '<div class="dg"><svg viewBox="0 0 ' + w + ' ' + h + '" role="img"><defs><marker id="' + id + '" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 z" fill="var(--muted)"/></marker></defs>' + edges.map(edgeSvg).join('') + nodes.map(nodeSvg).join('') + '</svg></div>';
  }

  /* ---------- sơ đồ quy trình (tự dàn) ---------- */
  function splitTitle(t) {
    if (t.length <= 21) return [t];
    let best = -1, bm = 1e9;
    for (let i = 1; i < t.length - 1; i++) if (t[i] === ' ') { const m = Math.max(i, t.length - i - 1); if (m <= bm) { bm = m; best = i; } }   // cực tiểu độ dài dòng dài nhất, hòa thì chọn chỗ sau
    return best < 0 ? [t] : [t.slice(0, best), t.slice(best + 1)];
  }
  function flowSvg(t) {
    const steps = t.flow, n = steps.length, per = n <= 5 ? n : Math.ceil(n / 2), rows = Math.ceil(n / per);
    const W = 150, H = 50, GX = 34, GY = 44, P = 10;
    const width = P * 2 + per * W + (per - 1) * GX, height = P * 2 + rows * H + (rows - 1) * GY + (t.fail ? GY + H : 0);
    const pos = (i) => ({ x: P + (i % per) * (W + GX), y: P + Math.floor(i / per) * (H + GY) });
    const id = 'fa' + t.id.replace(/[^a-z0-9]/gi, '');
    const node = (x, y, title, cls, idx) => { const L = splitTitle(title); return '<g class="fn ' + cls + '"' + (idx !== null ? ' data-i="' + idx + '"' : '') + '><rect x="' + x + '" y="' + y + '" width="' + W + '" height="' + H + '" rx="8"/>' + L.map((l, k) => '<text x="' + (x + W / 2) + '" y="' + (y + H / 2 + 4.5 - (L.length - 1) * 8 + k * 16) + '" text-anchor="middle">' + esc(l) + '</text>').join('') + '</g>'; };
    let edges = '', nodes = '';
    for (let i = 0; i < n; i++) {
      const p = pos(i); nodes += node(p.x, p.y, steps[i][0], '', i);
      if (i < n - 1) {
        const q = pos(i + 1);
        if (q.y === p.y) edges += '<path class="e" d="M' + (p.x + W) + ' ' + (p.y + H / 2) + ' L' + (q.x - 5) + ' ' + (q.y + H / 2) + '" marker-end="url(#' + id + ')"/>';
        else { const ym = p.y + H + GY / 2; edges += '<path class="e" d="M' + (p.x + W / 2) + ' ' + (p.y + H) + ' L' + (p.x + W / 2) + ' ' + ym + ' L' + (q.x + W / 2) + ' ' + ym + ' L' + (q.x + W / 2) + ' ' + (q.y - 5) + '" marker-end="url(#' + id + ')"/>'; }
      }
    }
    if (t.fail) {
      const p = pos(t.fail[0]), fy = P + rows * H + (rows - 1) * GY + GY;
      edges += '<path class="e f" d="M' + (p.x + W / 2) + ' ' + (p.y + H) + ' L' + (p.x + W / 2) + ' ' + (fy - 5) + '" marker-end="url(#' + id + 'f)"/>';
      nodes += node(p.x, fy, t.fail[1], 'fail', null);
    }
    const mk = (suffix, color) => '<marker id="' + id + suffix + '" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 z" fill="' + color + '"/></marker>';
    return '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Sơ đồ quy trình"><defs>' + mk('', 'var(--muted)') + mk('f', 'var(--bad)') + '</defs>' + edges + nodes + '</svg>';
  }
  function flowHtml(t) {
    return '<div class="flow" data-flow="' + t.id + '"><div class="flow-h"><span>Quy trình</span><div class="ctl"><button data-fstep="-1" aria-label="Bước trước">◀</button><button data-fplay>Chạy từng bước</button><button data-fstep="1" aria-label="Bước sau">▶</button></div></div><div class="svgw">' + flowSvg(t) + '</div><ol class="steps">' + t.flow.map((s, i) => '<li data-i="' + i + '"><b>' + esc(s[0]) + '</b>: ' + esc(s[1]) + '</li>').join('') + '</ol>' + (t.fail ? '<p class="failnote"><b>Nhánh lỗi:</b> ' + esc(t.fail[1]) + ': ' + esc(t.fail[2]) + '</p>' : '') + '</div>';
  }
  const FL = {};
  function flowApply(el, i) { $$('.fn', el).forEach((g) => g.classList.toggle('on', +g.dataset.i === i)); $$('.steps li', el).forEach((li) => li.classList.toggle('on', +li.dataset.i === i)); }
  function flowStop(id) { const f = FL[id]; if (f && f.timer) { clearInterval(f.timer); f.timer = null; const b = $('[data-flow="' + id + '"] [data-fplay]'); if (b) b.textContent = 'Chạy từng bước'; } }
  function flowStep(el, d) { const id = el.dataset.flow, t = byId[id], f = FL[id] || (FL[id] = { i: -1, timer: null }); f.i = Math.max(0, Math.min(t.flow.length - 1, f.i + d)); flowApply(el, f.i); }
  function flowPlay(el) {
    const id = el.dataset.flow, t = byId[id], f = FL[id] || (FL[id] = { i: -1, timer: null });
    if (f.timer) return flowStop(id);
    el.querySelector('[data-fplay]').textContent = 'Dừng';
    f.i = -1;
    const tick = () => { f.i++; if (f.i >= t.flow.length) { flowStop(id); return; } flowApply(el, f.i); };
    tick(); f.timer = setInterval(tick, 1200);
  }

  /* ---------- mô phỏng event loop ---------- */
  const PRESETS = [
    { t: 'Thứ tự cơ bản', code: "console.log('A');\nsetTimeout(() => console.log('timeout'), 0);\nsetImmediate(() => console.log('immediate'));\nPromise.resolve().then(() => console.log('promise'));\nprocess.nextTick(() => console.log('nextTick'));\nconsole.log('B');",
      prog: [['log', 'A'], ['timeout', [['log', 'timeout']]], ['immediate', [['log', 'immediate']]], ['then', [['log', 'promise']]], ['tick', [['log', 'nextTick']]], ['log', 'B']],
      note: 'Code đồng bộ chạy hết trước, rồi nextTick, rồi Promise, sau đó mới tới vòng lặp. Trong script chính, setTimeout(0) và setImmediate không có thứ tự đảm bảo.' },
    { t: 'async / await', code: "async function f() {\n  console.log('f: trước await');\n  await null;\n  console.log('f: sau await');\n}\nconsole.log('1');\nf();\nconsole.log('2');",
      prog: [['log', '1'], ['log', 'f: trước await'], ['then', [['log', 'f: sau await']]], ['log', '2']],
      note: 'Hàm async chạy đồng bộ tới await đầu tiên. Phần sau await là một microtask, nên "2" in trước.' },
    { t: 'Microtask giữa các timer', code: "setTimeout(() => {\n  console.log('t1');\n  Promise.resolve().then(() => console.log('p trong t1'));\n}, 0);\nsetTimeout(() => console.log('t2'), 0);",
      prog: [['timeout', [['log', 't1'], ['then', [['log', 'p trong t1']]]]], ['timeout', [['log', 't2']]]],
      note: 'Sau mỗi callback của timer, Node xả microtask ngay (từ Node 11), nên "p trong t1" nằm giữa t1 và t2.' },
    { t: 'Trong callback I/O', code: "const fs = require('node:fs');\nfs.readFile(__filename, () => {\n  setTimeout(() => console.log('timeout'), 0);\n  setImmediate(() => console.log('immediate'));\n});",
      prog: [['io', [['timeout', [['log', 'timeout']]], ['immediate', [['log', 'immediate']]]]]],
      note: 'Đang ở pha Poll, pha kế là Check nên setImmediate luôn chạy trước setTimeout. Đây là trường hợp thứ tự được đảm bảo.' },
    { t: 'nextTick trong Promise', code: "Promise.resolve()\n  .then(() => {\n    console.log('p1');\n    process.nextTick(() => console.log('tick trong p1'));\n  })\n  .then(() => console.log('p2'));\nprocess.nextTick(() => console.log('tick'));",
      prog: [['then', [['log', 'p1'], ['tick', [['log', 'tick trong p1']]], ['then', [['log', 'p2']]]]], ['tick', [['log', 'tick']]]],
      note: 'Hàng microtask được xả hết (p1 rồi p2) trước khi quay lại hàng nextTick, nên "tick trong p1" ra sau "p2". Câu hỏi phỏng vấn kinh điển.' },
  ];
  function simulate(prog) {
    const out = [], frames = [], q = { tick: [], micro: [], timer: [], io: [], imm: [] };
    const KEY = { timeout: 'timer', immediate: 'imm', then: 'micro', tick: 'tick', io: 'io' };
    const DESC = { timeout: 'setTimeout: callback vào hàng Timers', immediate: 'setImmediate: callback vào hàng Check', then: 'Promise.then (hoặc sau await): vào hàng Microtask', tick: 'process.nextTick: vào hàng nextTick', io: 'fs.readFile: giao việc cho hệ điều hành, xong sẽ vào hàng Poll' };
    const label = (type, ops) => { const l = ops.find((o) => o[0] === 'log'); return type + (l ? ': ' + l[1] : ''); };
    const snap = (phase, desc, cur) => frames.push({ phase, desc, cur, out: out.slice(), q: Object.fromEntries(Object.entries(q).map(([k, v]) => [k, v.map((x) => x.label)])) });
    const exec = (ops, phase, cur) => { for (const op of ops) { if (op[0] === 'log') { out.push(op[1]); snap(phase, 'console.log: in ra "' + op[1] + '"', cur); } else { q[KEY[op[0]]].push({ ops: op[1], label: label(op[0], op[1]) }); snap(phase, DESC[op[0]], cur); } } };
    const runCb = (it, phase) => { snap(phase, 'Chạy callback ' + it.label, it.label); exec(it.ops, phase, it.label); };
    const drain = () => { if (q.tick.length || q.micro.length) snap(q.tick.length ? 'nextTick' : 'microtask', 'Xả hàng đợi: nextTick trước, rồi Microtask, lặp đến khi hết', 'engine');
      do { while (q.tick.length) runCb(q.tick.shift(), 'nextTick'); while (q.micro.length) runCb(q.micro.shift(), 'microtask'); } while (q.tick.length || q.micro.length); };
    snap('main', 'Bắt đầu chạy script chính (code đồng bộ)', 'script chính');
    exec(prog, 'main', 'script chính'); drain();
    let guard = 0;
    while ((q.timer.length || q.io.length || q.imm.length) && guard++ < 10) {
      const timers = q.timer.splice(0); if (timers.length) snap('timers', 'Event loop: pha Timers', 'engine'); for (const t of timers) { runCb(t, 'timers'); drain(); }
      const ios = q.io.splice(0); if (ios.length) snap('poll', 'Event loop: pha Poll (I/O xong)', 'engine'); for (const t of ios) { runCb(t, 'poll'); drain(); }
      const imms = q.imm.splice(0); if (imms.length) snap('check', 'Event loop: pha Check (setImmediate)', 'engine'); for (const t of imms) { runCb(t, 'check'); drain(); }
    }
    snap('end', 'Hết việc, event loop thoát', 'không còn gì');
    return { frames, out };
  }
  function predictOptions(out) {
    const sw = (a, i, j) => { const c = a.slice(); [c[i], c[j]] = [c[j], c[i]]; return c; };
    const opts = [{ text: out.join(' → '), ok: true }];
    for (const c of [sw(out, 0, 1), sw(out, out.length - 2, out.length - 1), sw(out, 1, 2), out.slice(1).concat(out[0])]) { const s = c.join(' → '); if (!opts.some((o) => o.text === s)) opts.push({ text: s, ok: false }); if (opts.length >= 3) break; }
    const k = out.length % opts.length; return opts.slice(k).concat(opts.slice(0, k));
  }
  const SIMS = { p: 0, i: 0, pick: null, timer: null };
  const LANES = [['tick', 'process.nextTick', 'ưu tiên cao nhất', 'nextTick'], ['micro', 'Microtask', 'Promise, await', 'microtask'], ['timer', 'Timers', 'setTimeout', 'timers'], ['io', 'Poll (I/O)', 'file, mạng xong', 'poll'], ['imm', 'Check', 'setImmediate', 'check']];
  function renderSim() {
    const el = $('#sim-inner'); if (!el) return;
    const P = PRESETS[SIMS.p], { frames, out } = simulate(P.prog), f = frames[SIMS.i], last = SIMS.i >= frames.length - 1, opts = predictOptions(out);
    el.innerHTML = '<div class="chips">' + PRESETS.map((x, i) => '<button class="' + (i === SIMS.p ? 'on' : '') + '" data-sp="' + i + '">' + x.t + '</button>').join('') + '</div>' +
      '<div class="simg"><div><div class="cb"><div class="cbh"><span>Code</span></div><pre><code>' + hl(P.code) + '</code></pre></div><div style="margin-top:12px"><b>Đoán trước: in ra theo thứ tự nào?</b>' + opts.map((o, i) => '<button class="ropt ' + (SIMS.pick === null ? '' : o.ok ? 'right' : SIMS.pick === i ? 'wrong' : '') + '" data-pick="' + i + '"' + (SIMS.pick !== null ? ' disabled' : '') + '>' + esc(o.text) + '</button>').join('') +
      (SIMS.pick !== null ? '<p style="margin:8px 0 0"><b>' + (opts[SIMS.pick].ok ? 'Đúng.' : 'Chưa đúng.') + '</b> ' + P.note + '</p>' : '<p style="color:var(--muted);font-size:14px;margin:8px 0 0">Chọn một đáp án, rồi bấm Bước tiếp để xem từng bước.</p>') + '</div></div>' +
      '<div><div class="stack"><b>Đang chạy:</b> ' + esc(f.cur) + '<div style="color:var(--muted)">' + esc(f.desc) + '</div></div>' +
      LANES.map(([k, n, s, ph]) => '<div class="lane ' + (f.phase === ph ? 'hotl' : '') + '"><div class="ln">' + n + '<small>' + s + '</small></div>' + f.q[k].map((x) => '<span class="item">' + esc(x) + '</span>').join('') + '</div>').join('') +
      '<div class="console">' + (f.out.length ? f.out.map((x) => '<div>' + esc(x) + '</div>').join('') : '<span style="opacity:.6">Console</span>') + '</div>' +
      '<div class="chips" style="margin:10px 0 0"><button data-sa="prev"' + (SIMS.i === 0 ? ' disabled' : '') + '>◀ Lùi</button><button class="pri" data-sa="next"' + (last ? ' disabled' : '') + '>Bước tiếp ▶</button><button data-sa="play">' + (SIMS.timer ? 'Dừng' : 'Tự chạy') + '</button><button data-sa="reset">Làm lại</button><span style="color:var(--muted);font-size:13.5px;align-self:center">Bước ' + (SIMS.i + 1) + '/' + frames.length + '</span></div></div></div>';
  }
  function simAction(a) {
    const n = simulate(PRESETS[SIMS.p].prog).frames.length;
    if (a === 'next') SIMS.i = Math.min(n - 1, SIMS.i + 1);
    if (a === 'prev') SIMS.i = Math.max(0, SIMS.i - 1);
    if (a === 'reset') { SIMS.i = 0; SIMS.pick = null; }
    if (a === 'play') { if (SIMS.timer) { clearInterval(SIMS.timer); SIMS.timer = null; } else SIMS.timer = setInterval(() => { if (SIMS.i >= n - 1) { clearInterval(SIMS.timer); SIMS.timer = null; } else SIMS.i++; renderSim(); }, 900); }
    renderSim();
  }

  /* ---------- nội dung các màn hình ---------- */
  const codeBlock = (t) => '<div class="cb"><div class="cbh"><span>' + esc(t.code.t) + '</span><div class="acts"><button data-copy>Sao chép</button><button class="pri" data-open="' + t.id + '">Chạy trong editor</button></div></div><pre><code>' + hl(t.code.src) + '</code></pre></div>';
  function topicHtml(t) {
    return '<section class="topic" id="t-' + t.id + '"><header><h2>' + esc(t.t) + '</h2><span class="lv ' + (t.lv >= 5 ? 'l5' : '') + '">Mốc ' + t.lv + ' năm</span><label class="known-l"><input type="checkbox" data-known="' + t.id + '"' + (isKnown(t.id) ? ' checked' : '') + '> Đã nắm</label></header>' +
      '<p class="sum">' + esc(t.sum) + '</p>' + flowHtml(t) + (t.dgs || []).map(dg).join('') + (t.sim ? '<div class="sim"><div id="sim-inner"></div></div>' : '') +
      '<h3>Cần nắm</h3><ul class="pts">' + t.pts.map((p) => '<li>' + p + '</li>').join('') + '</ul>' +
      '<h3>Hỏi đáp thường gặp</h3><div class="qa">' + t.qa.map((q) => '<details><summary>' + esc(q[0]) + '</summary><div class="ans"><p>' + esc(q[1]) + '</p></div></details>').join('') + '</div>' +
      (t.code ? '<h3>Thử code</h3>' + codeBlock(t) : '') + '</section>';
  }
  function viewHome() {
    const nTopics = topics.length;
    return '<div class="page"><h1>Sổ tay kinh nghiệm dev Node.js</h1><p class="lead">Những gì một dev Node.js từ 2 đến 5 năm kinh nghiệm cần biết và trả lời được: giải thích ngắn, quy trình minh họa, hỏi đáp có đáp án, và editor để tự chạy code.</p>' +
      '<div class="hero-meta"><span><b>' + nTopics + '</b> chủ đề</span><span><b>' + nQA + '</b> câu hỏi đáp</span><span><b>' + nCode + '</b> ví dụ chạy được</span><span><b>' + areas.length + '</b> lĩnh vực</span></div>' +
      '<ul class="how"><li><b>Quy trình</b>Mỗi chủ đề có một sơ đồ quy trình. Bấm "Chạy từng bước" để thấy từng bước sáng lên.</li><li><b>Hỏi đáp</b>Bấm câu hỏi để xem đáp án mẫu ngắn gọn, đủ ý để nói.</li><li><b>Editor</b>Mỗi ví dụ mở được trong editor bên phải, sửa và chạy ngay trên trang.</li><li><b>Mốc kinh nghiệm</b>Dùng bộ lọc ở thanh bên: mốc 2 năm là nền; mốc 5 năm thêm phần thiết kế và vận hành.</li></ul>' +
      '<h3 style="margin-top:44px;font-size:20px">Mốc 2 năm và mốc 5 năm</h3><div class="tw"><table><thead><tr><th>Lĩnh vực</th><th>Mốc 2 năm</th><th>Thêm ở mốc 5 năm</th></tr></thead><tbody>' + areas.map((a) => '<tr><td><a href="#area-' + a.id + '">' + esc(a.t) + '</a></td><td>' + esc(a.m2) + '</td><td>' + esc(a.m5) + '</td></tr>').join('') + '</tbody></table></div>' +
      '<h3 style="margin-top:44px;font-size:20px">Lĩnh vực</h3><ul class="areas">' + areas.map((a) => '<li><a href="#area-' + a.id + '"><b>' + esc(a.t) + '</b> <span class="cnt">(' + topics.filter((t) => t.a === a.id).length + ' chủ đề)</span><span>' + esc(a.desc) + '</span></a></li>').join('') + '</ul>' +
      '<h3 style="margin-top:44px;font-size:20px">Cần biết</h3><p style="max-width:70ch;color:var(--muted)">Nội dung do người soạn viết từ kiến thức chung về Node.js và hệ sinh thái; <b>con số, giới hạn và phiên bản có thể thay đổi</b>, hãy kiểm tra lại với tài liệu chính thức khi cần chính xác (Node.js, AWS, Kubernetes). Editor chạy JavaScript trong trình duyệt, không phải Node thật, nên một vài hành vi (thứ tự setImmediate, nextTick, module hệ thống) chỉ là mô phỏng.</p></div>';
  }
  function viewArea(aid) {
    const a = areaOf[aid], ts = topicsOf(aid);
    return '<div class="page"><div class="area-h"><h1>' + esc(a.t) + '</h1><p class="lead">' + esc(a.desc) + '</p><div class="m2m5"><div><b>Mốc 2 năm</b>' + esc(a.m2) + '</div><div><b>Thêm ở mốc 5 năm</b>' + esc(a.m5) + '</div></div></div>' + ts.map(topicHtml).join('') + (ts.length ? '' : '<p>Không có chủ đề ở mốc này.</p>') + '</div>';
  }
  function viewQA() {
    return '<div class="page"><h1>Tất cả hỏi đáp</h1><p class="lead">' + nQA + ' câu hỏi thường gặp kèm đáp án mẫu, gom theo lĩnh vực. Dùng bộ lọc mốc ở thanh bên để chỉ xem phần nền.</p>' +
      areas.map((a) => { const ts = topicsOf(a.id).filter((t) => t.qa.length); if (!ts.length) return ''; return '<div class="qgroup"><h3>' + esc(a.t) + '</h3><div class="qa">' + ts.flatMap((t) => t.qa.map((q) => '<details><summary>' + esc(q[0]) + '</summary><div class="ans"><p>' + esc(q[1]) + '</p><p style="margin:0"><a href="#t-' + t.id + '">Xem chủ đề: ' + esc(t.t) + '</a></p></div></details>')).join('') + '</div></div>'; }).join('') + '</div>';
  }
  const INDEX = topics.map((t) => ({ t, title: norm(t.t), sum: norm(t.sum), pts: norm(t.pts.map(strip).join(' ')), qa: t.qa.map((q) => ({ q: q[0], nq: norm(q[0]), na: norm(q[1]) })), flow: norm(t.flow.map((f) => f[0] + ' ' + f[1]).join(' ')), code: norm(t.code ? t.code.src : '') }));
  function viewSearch(q) {
    const words = norm(q).split(/\s+/).filter(Boolean);
    const rs = INDEX.filter((x) => visible(x.t)).map((x) => {
      let score = 0, hit = null;
      for (const w of words) {
        let s = 0;
        if (x.title.includes(w)) s += 8; if (x.sum.includes(w)) s += 3; if (x.flow.includes(w)) s += 2; if (x.pts.includes(w)) s += 2; if (x.code.includes(w)) s += 1;
        const qh = x.qa.find((y) => y.nq.includes(w) || y.na.includes(w)); if (qh) { s += 3; hit = hit || qh; }
        if (!s) return null; score += s;
      }
      return { x, score, hit };
    }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 30);
    return '<div class="page"><h1 style="font-size:28px">Kết quả cho "' + esc(q) + '"</h1><p class="lead" style="font-size:16px">' + rs.length + ' chủ đề phù hợp.</p><ul class="res">' + rs.map((r) => '<li><a href="#t-' + r.x.t.id + '" data-closesearch>' + esc(r.x.t.t) + '</a><small>' + esc(r.x.t.areaObj.t) + ' · mốc ' + r.x.t.lv + ' năm</small><p>' + esc(r.hit ? 'Hỏi đáp: ' + r.hit.q : r.x.t.sum) + '</p></li>').join('') + '</ul></div>';
  }

  /* ---------- thanh bên ---------- */
  function renderSide() {
    const known = topics.filter((t) => isKnown(t.id)).length;
    $('#side').innerHTML = '<div class="seg" role="group" aria-label="Lọc theo mốc kinh nghiệm"><button data-lv="2" class="' + (STATE.lv === 2 ? 'on' : '') + '">Mốc 2 năm</button><button data-lv="5" class="' + (STATE.lv === 5 ? 'on' : '') + '">Đến mốc 5 năm</button></div>' +
      '<a href="#home" data-nav="home"><span>Tổng quan</span></a><a href="#qa" data-nav="qa"><span>Tất cả hỏi đáp</span><span class="cnt">' + nQA + '</span></a><hr>' +
      areas.map((a) => { const ts = topicsOf(a.id), open = STATE.area === a.id; return '<a href="#area-' + a.id + '" data-nav="area-' + a.id + '" class="' + (open ? 'on' : '') + '"><span>' + esc(a.t) + '</span><span class="cnt">' + ts.length + '</span></a>' + (open ? '<div class="sub">' + ts.map((t) => '<a href="#t-' + t.id + '" data-spy="' + t.id + '"><span>' + esc(t.t.length > 44 ? t.t.slice(0, 42) + '…' : t.t) + '</span>' + (t.lv >= 5 ? '<span class="five">5</span>' : '') + '</a>').join('') + '</div>' : ''); }).join('') +
      '<hr><div class="known">Đã nắm ' + known + '/' + topics.length + ' chủ đề</div><div class="known" style="margin-top:8px"><button id="theme" style="font-size:13px;padding:3px 10px">Giao diện: ' + ({ auto: 'tự động', light: 'sáng', dark: 'tối' }[themeMode()]) + '</button></div>';
  }
  const themeMode = () => store.get('nh:theme') || 'auto';
  function applyTheme() { const m = themeMode(), r = document.documentElement; if (m === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', m); }
  function setSideActive(topicId) { $$('#side [data-spy]').forEach((a) => a.classList.toggle('on', a.dataset.spy === topicId)); }
  let spyRaf = 0;
  function spy() { if (spyRaf) return; spyRaf = requestAnimationFrame(() => { spyRaf = 0; const secs = $$('.topic'); let cur = null; for (const s of secs) { if (s.getBoundingClientRect().top <= 140) cur = s; else break; } setSideActive(cur ? cur.id.slice(2) : null); }); }

  /* ---------- điều hướng ---------- */
  let current = '';
  function show(html, key) { $('#main').innerHTML = html; current = key; }
  function route(force) {
    const h = location.hash.slice(1) || 'home';
    stopAll();
    if (STATE.q) { STATE.q = ''; $('#q').value = ''; }
    let scrollTo = null, key = h;
    if (h === 'home') { STATE.area = null; show(viewHome(), key); }
    else if (h === 'qa') { STATE.area = null; show(viewQA(), key); }
    else if (h.startsWith('area-') && areaOf[h.slice(5)]) { STATE.area = h.slice(5); show(viewArea(STATE.area), key); window.scrollTo(0, 0); }
    else if (h.startsWith('t-') && byId[h.slice(2)]) {
      const t = byId[h.slice(2)];
      if (!visible(t)) { STATE.lv = 5; store.set('nh:lv', '5'); }
      if (STATE.area !== t.a || current.indexOf('area-') !== 0 || force) { STATE.area = t.a; show(viewArea(t.a), 'area-' + t.a); }
      scrollTo = 't-' + t.id;
    } else { STATE.area = null; show(viewHome(), 'home'); }
    renderSide();
    if ($('#sim-inner')) { SIMS.p = 0; SIMS.i = 0; SIMS.pick = null; renderSim(); }
    $('#side').classList.remove('open');
    if (scrollTo) requestAnimationFrame(() => { const el = document.getElementById(scrollTo); if (el) { el.scrollIntoView({ block: 'start' }); setSideActive(scrollTo.slice(2)); } });
    else if (h === 'home' || h === 'qa') window.scrollTo(0, 0);
  }
  function stopAll() { Object.keys(FL).forEach(flowStop); if (SIMS.timer) { clearInterval(SIMS.timer); SIMS.timer = null; } }

  /* ---------- editor ---------- */
  const ta = $('#ed-ta'), hlc = $('#ed-hl code'), hlp = $('#ed-hl'), gut = $('#ed-g'), logEl = $('#ed-log'), stEl = $('#ed-st'), snip = $('#ed-snip');
  const ED = { open: false, lang: 'js', snip: '', worker: null, kill: null, running: false, ts: null };
  function edRender() { const v = ta.value; hlc.innerHTML = hl(v) + '\n'; const n = v.split('\n').length; gut.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n'); }
  function edSave() { store.set('nh:ed', JSON.stringify({ code: ta.value, lang: ED.lang, snip: ED.snip })); }
  function edLang(l) { ED.lang = l; $('#lang-js').classList.toggle('on', l === 'js'); $('#lang-ts').classList.toggle('on', l === 'ts'); }
  function edLoad(id) { const t = byId[id]; if (!t || !t.code) return; ta.value = t.code.src; ED.snip = id; snip.value = id; edLang(t.code.lang); edRender(); edSave(); ta.scrollTop = 0; hlp.scrollTop = 0; gut.scrollTop = 0; }
  function edToggle(open) {
    ED.open = open === undefined ? !ED.open : open;
    $('#ed').hidden = !ED.open; $('#layout').classList.toggle('ed-open', ED.open); $('#ed-toggle').setAttribute('aria-pressed', String(ED.open)); $('#ed-toggle').classList.toggle('on', ED.open);
    if (ED.open) setTimeout(() => ta.focus({ preventScroll: true }), 50);
  }
  function edLog(level, text) { const d = document.createElement('div'); if (level !== 'log') d.className = level; d.textContent = text; logEl.appendChild(d); logEl.scrollTop = logEl.scrollHeight; }
  function edFinish(msg) { clearTimeout(ED.kill); if (ED.worker) { ED.worker.terminate(); ED.worker = null; } ED.running = false; $('#ed-run').textContent = 'Chạy ▶'; stEl.textContent = msg; }
  function loadTS() {
    return new Promise((res, rej) => {
      if (window.ts) return res(window.ts);
      const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/typescript/5.4.5/typescript.min.js';
      s.onload = () => (window.ts ? res(window.ts) : rej(new Error('Không khởi tạo được TypeScript'))); s.onerror = () => rej(new Error('Không tải được trình biên dịch TypeScript. Dùng chế độ JS hoặc kiểm tra mạng.'));
      document.head.appendChild(s);
    });
  }
  const fixNames = (n) => n.replace(/\bas\b/g, ':');
  function esmToCjs(src) {
    return src
      .replace(/^[ \t]*import\s+([\w$]+)\s*,\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];?/gm, (m, d, n, mod) => 'const ' + d + ' = require("' + mod + '"); const {' + fixNames(n) + '} = require("' + mod + '");')
      .replace(/^[ \t]*import\s+\*\s+as\s+([\w$]+)\s+from\s*['"]([^'"]+)['"];?/gm, (m, a, mod) => 'const ' + a + ' = require("' + mod + '");')
      .replace(/^[ \t]*import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];?/gm, (m, n, mod) => 'const {' + fixNames(n) + '} = require("' + mod + '");')
      .replace(/^[ \t]*import\s+([\w$]+)\s+from\s*['"]([^'"]+)['"];?/gm, (m, d, mod) => 'const ' + d + ' = require("' + mod + '");')
      .replace(/^[ \t]*import\s*['"]([^'"]+)['"];?/gm, (m, mod) => 'require("' + mod + '");')
      .replace(/^[ \t]*export\s+default\s+/gm, '')
      .replace(/^[ \t]*export\s+(?=(?:const|let|var|function|async|class)\b)/gm, '')
      .replace(/^[ \t]*export\s*\{[^}]*\};?/gm, '');
  }

  /* Mã chạy trong Web Worker. Hàm này được chuyển thành chuỗi nên KHÔNG được dùng biến ngoài. */
  function workerMain() {
    const post = (m) => self.postMessage(m);
    const ctorName = (v) => (v && v.constructor && v.constructor.name) || 'Object';
    function inspect(v, depth, seen, top) {
      if (v === null) return 'null';
      const t = typeof v;
      if (t === 'undefined') return 'undefined';
      if (t === 'string') return top ? v : "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
      if (t === 'number' || t === 'boolean') return String(v);
      if (t === 'bigint') return v + 'n';
      if (t === 'symbol') return v.toString();
      if (t === 'function') return '[Function' + (v.name ? ': ' + v.name : ' (anonymous)') + ']';
      if (v instanceof Error) { const base = v.stack ? String(v.stack).split('\n').slice(0, 5).join('\n') : v.name + ': ' + v.message; return v.cause ? base + '\n  [cause]: ' + inspect(v.cause, depth - 1, seen, true) : base; }
      if (seen.has(v)) return '[Circular]';
      if (depth < 0) return Array.isArray(v) ? '[Array]' : '[' + ctorName(v) + ']';
      seen.add(v);
      let s;
      if (v instanceof Promise) s = 'Promise { <pending> }';
      else if (v instanceof Date) s = isNaN(v) ? 'Invalid Date' : v.toISOString();
      else if (v instanceof Map) s = 'Map(' + v.size + ') { ' + [...v].map(([k, x]) => inspect(k, depth - 1, seen, false) + ' => ' + inspect(x, depth - 1, seen, false)).join(', ') + ' }';
      else if (v instanceof Set) s = 'Set(' + v.size + ') { ' + [...v].map((x) => inspect(x, depth - 1, seen, false)).join(', ') + ' }';
      else if (v instanceof Uint8Array) s = ctorName(v) === 'Buf' ? '<Buffer ' + [...v].slice(0, 50).map((b) => b.toString(16).padStart(2, '0')).join(' ') + '>' : 'Uint8Array(' + v.length + ') [ ' + [...v].slice(0, 50).join(', ') + ' ]';
      else if (Array.isArray(v)) s = v.length ? '[ ' + v.slice(0, 100).map((x) => inspect(x, depth - 1, seen, false)).join(', ') + (v.length > 100 ? ', ... ' + (v.length - 100) + ' more' : '') + ' ]' : '[]';
      else { const ks = Object.keys(v), nm = ctorName(v); s = (nm !== 'Object' ? nm + ' ' : '') + (ks.length ? '{ ' + ks.map((k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : "'" + k + "'") + ': ' + inspect(v[k], depth - 1, seen, false)).join(', ') + ' }' : '{}'); }
      seen.delete(v); return s;
    }
    const fmt = (a) => a.map((x) => inspect(x, 3, new Set(), true)).join(' ');
    const con = {}; const timersC = {};
    con.log = (...a) => post({ k: 'log', l: 'log', t: fmt(a) }); con.info = con.log; con.debug = con.log;
    con.warn = (...a) => post({ k: 'log', l: 'warn', t: fmt(a) }); con.error = (...a) => post({ k: 'log', l: 'error', t: fmt(a) });
    con.table = (x) => post({ k: 'log', l: 'log', t: JSON.stringify(x, null, 1) });
    con.time = (l = 'default') => { timersC[l] = performance.now(); }; con.timeEnd = (l = 'default') => { con.log(l + ': ' + (performance.now() - timersC[l]).toFixed(2) + 'ms'); };
    con.assert = (c, ...a) => { if (!c) con.error('Assertion failed', ...a); };

    class ExitSignal { constructor(c) { this.code = c; } }
    const errText = (e) => (e && e.stack ? String(e.stack).split('\n').slice(0, 5).join('\n') : String(e));
    const wrap = (fn) => (...a) => { try { return fn(...a); } catch (e) { if (e instanceof ExitSignal) { post({ k: 'done' }); return; } post({ k: 'log', l: 'error', t: 'Uncaught ' + errText(e) }); } };
    const _st = self.setTimeout.bind(self), _ct = self.clearTimeout.bind(self), _si = self.setInterval.bind(self), _ci = self.clearInterval.bind(self);
    const live = new Set();
    const mk = (fn, ms, args, repeat) => { let id; const run = wrap(() => { if (!repeat) live.delete(id); fn(...args); }); id = repeat ? _si(run, ms) : _st(run, ms); live.add(id); return id; };
    const st_ = (fn, ms = 0, ...a) => mk(fn, ms, a, false), si_ = (fn, ms = 0, ...a) => mk(fn, ms, a, true), sim_ = (fn, ...a) => mk(fn, 0, a, false);
    const ct_ = (id) => { live.delete(id); _ct(id); }, ci_ = (id) => { live.delete(id); _ci(id); };

    const ticks = []; let flushed = false;
    const drainTicks = () => { while (ticks.length) { const f = ticks.shift(); try { f(); } catch (e) { post({ k: 'log', l: 'error', t: 'Uncaught ' + errText(e) }); } } };
    const process = { env: { NODE_ENV: 'development' }, argv: ['node', 'playground'], platform: 'browser', version: 'v22 (mô phỏng)', versions: { node: '22 (mô phỏng)' }, cwd: () => '/', uptime: () => performance.now() / 1000,
      nextTick: (fn, ...a) => { ticks.push(() => fn(...a)); if (flushed) queueMicrotask(drainTicks); },
      hrtime: { bigint: () => BigInt(Math.round(performance.now() * 1e6)) }, memoryUsage: () => ({ rss: 0, heapUsed: (performance.memory && performance.memory.usedJSHeapSize) || 0, heapTotal: 0, external: 0 }),
      exit: (c) => { throw new ExitSignal(c); }, on() { return process; }, once() { return process; }, emitWarning: (m) => con.warn('Warning: ' + m), stdout: { write: (s) => { post({ k: 'log', l: 'log', t: String(s).replace(/\n$/, '') }); return true; } } };

    class EE {
      constructor() { this._e = new Map(); }
      on(n, f) { (this._e.get(n) || this._e.set(n, []).get(n)).push({ f, once: false }); return this; }
      once(n, f) { (this._e.get(n) || this._e.set(n, []).get(n)).push({ f, once: true }); return this; }
      off(n, f) { const a = this._e.get(n); if (a) { const i = a.findIndex((x) => x.f === f); if (i >= 0) a.splice(i, 1); } return this; }
      emit(n, ...args) { const a = this._e.get(n); if (!a || !a.length) { if (n === 'error') throw args[0] instanceof Error ? args[0] : new Error('Unhandled error. (' + inspect(args[0], 1, new Set(), false) + ')'); return false; } for (const x of [...a]) { if (x.once) this.off(n, x.f); x.f.apply(this, args); } return true; }
      listenerCount(n) { return (this._e.get(n) || []).length; }
      removeAllListeners(n) { if (n) this._e.delete(n); else this._e.clear(); return this; }
    }
    EE.prototype.addListener = EE.prototype.on; EE.prototype.removeListener = EE.prototype.off; EE.EventEmitter = EE; EE.default = EE;
    EE.once = (em, n) => new Promise((res, rej) => { em.once(n, (...a) => res(a)); if (n !== 'error') em.once('error', rej); });

    const deepEq = (a, b) => { if (Object.is(a, b)) return true; if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false; if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false; if (a instanceof Date) return +a === +b; if (a instanceof Map) return a.size === b.size && [...a].every(([k, v]) => b.has(k) && deepEq(v, b.get(k))); if (a instanceof Set) return a.size === b.size && [...a].every((x) => b.has(x)); const ka = Object.keys(a), kb = Object.keys(b); return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEq(a[k], b[k])); };
    class AssertionError extends Error { constructor(m) { super(m); this.name = 'AssertionError'; this.code = 'ERR_ASSERTION'; } }
    const show = (v) => inspect(v, 4, new Set(), false);
    const assert = (v, m) => { if (!v) throw new AssertionError(m || 'Biểu thức có giá trị sai (falsy)'); };
    assert.ok = assert;
    assert.equal = assert.strictEqual = (a, b, m) => { if (!Object.is(a, b)) throw new AssertionError(m || 'Hai giá trị không bằng nhau (strict):\n' + show(a) + ' !== ' + show(b)); };
    assert.notEqual = assert.notStrictEqual = (a, b, m) => { if (Object.is(a, b)) throw new AssertionError(m || 'Hai giá trị lẽ ra khác nhau: ' + show(a)); };
    assert.deepEqual = assert.deepStrictEqual = (a, b, m) => { if (!deepEq(a, b)) throw new AssertionError(m || 'Hai giá trị không bằng nhau (deep):\n' + show(a) + '\n\nlẽ ra bằng\n\n' + show(b)); };
    assert.notDeepStrictEqual = (a, b, m) => { if (deepEq(a, b)) throw new AssertionError(m || 'Hai giá trị lẽ ra khác nhau (deep)'); };
    const matches = (e, exp) => { if (!exp) return true; if (exp instanceof RegExp) return exp.test(String((e && e.message) || e)); if (typeof exp === 'function') return e instanceof exp || (!exp.prototype && exp(e) === true); return Object.keys(exp).every((k) => (exp[k] instanceof RegExp ? exp[k].test(e[k]) : deepEq(e[k], exp[k]))); };
    assert.throws = (fn, exp, m) => { let thrown = false; try { fn(); } catch (e) { thrown = true; if (!matches(e, exp)) throw e; } if (!thrown) throw new AssertionError(m || 'Lẽ ra phải ném lỗi'); };
    assert.rejects = async (p, exp, m) => { let thrown = false; try { await (typeof p === 'function' ? p() : p); } catch (e) { thrown = true; if (!matches(e, exp)) throw e; } if (!thrown) throw new AssertionError(m || 'Lẽ ra phải bị reject'); };
    assert.match = (s, re, m) => { if (!re.test(s)) throw new AssertionError(m || show(s) + ' không khớp ' + re); };
    assert.fail = (m) => { throw new AssertionError(m || 'Failed'); }; assert.strict = assert; assert.AssertionError = AssertionError;

    const tests = []; let prefix = ''; const hooks = { be: [], ae: [] };
    const test = (name, a, b) => { tests.push({ name: prefix + name, fn: typeof a === 'function' ? a : b }); };
    const describe = (name, fn) => { const p = prefix; prefix += name + ' > '; try { fn(); } finally { prefix = p; } };
    Object.assign(test, { test, describe, it: test, before: () => {}, after: () => {}, beforeEach: (f) => hooks.be.push(f), afterEach: (f) => hooks.ae.push(f), default: test });
    async function runTests() {
      if (!tests.length) return; let pass = 0, fail = 0;
      for (const t of tests) {
        try { for (const h of hooks.be) await h(); await t.fn({ name: t.name }); pass++; post({ k: 'log', l: 'ok', t: '✔ ' + t.name }); }
        catch (e) { fail++; post({ k: 'log', l: 'error', t: '✖ ' + t.name + '\n    ' + String((e && e.message) || e).split('\n').join('\n    ') }); }
        finally { for (const h of hooks.ae) await h(); }
      }
      post({ k: 'log', l: fail ? 'error' : 'ok', t: 'Tổng: ' + pass + ' đạt, ' + fail + ' lỗi' });
    }

    class Buf extends Uint8Array {
      static from(x, enc = 'utf8') { let bytes; if (typeof x === 'string') { if (enc === 'hex') bytes = Uint8Array.from(x.match(/.{1,2}/g) || [], (h) => parseInt(h, 16)); else if (enc === 'base64') bytes = Uint8Array.from(atob(x), (c) => c.charCodeAt(0)); else bytes = new TextEncoder().encode(x); } else bytes = Uint8Array.from(x); const b = new Buf(bytes.length); b.set(bytes); return b; }
      static alloc(n) { return new Buf(n); } static byteLength(s) { return new TextEncoder().encode(s).length; }
      static concat(list) { const n = list.reduce((s, b) => s + b.length, 0), r = new Buf(n); let o = 0; for (const b of list) { r.set(b, o); o += b.length; } return r; }
      toString(enc = 'utf8') { if (enc === 'hex') return [...this].map((b) => b.toString(16).padStart(2, '0')).join(''); if (enc === 'base64') return btoa(String.fromCharCode(...this)); return new TextDecoder().decode(this); }
    }
    const vfs = new Map();
    const enoent = (p, op) => Object.assign(new Error("ENOENT: no such file or directory, " + op + " '" + p + "'"), { code: 'ENOENT' });
    const fsSync = { writeFileSync: (p, d) => { vfs.set(String(p), String(d)); }, appendFileSync: (p, d) => { vfs.set(String(p), (vfs.get(String(p)) || '') + String(d)); }, readFileSync: (p, enc) => { if (!vfs.has(String(p))) throw enoent(p, 'open'); const s = vfs.get(String(p)); return enc ? s : Buf.from(s); }, existsSync: (p) => vfs.has(String(p)), unlinkSync: (p) => { if (!vfs.delete(String(p))) throw enoent(p, 'unlink'); }, readdirSync: (d) => [...vfs.keys()].filter((k) => k.startsWith(String(d).replace(/\/$/, '') + '/')).map((k) => k.slice(String(d).replace(/\/$/, '').length + 1).split('/')[0]), mkdirSync: () => {} };
    const asyncWrap = (f) => (...a) => new Promise((res, rej) => { _st(() => { try { res(f(...a)); } catch (e) { rej(e); } }, 1); });
    const fsP = { writeFile: asyncWrap(fsSync.writeFileSync), appendFile: asyncWrap(fsSync.appendFileSync), readFile: asyncWrap(fsSync.readFileSync), readdir: asyncWrap(fsSync.readdirSync), rm: asyncWrap(fsSync.unlinkSync), unlink: asyncWrap(fsSync.unlinkSync), mkdir: asyncWrap(fsSync.mkdirSync) };
    const fsMod = Object.assign({}, fsSync, { promises: fsP, readFile: (p, enc, cb) => { if (typeof enc === 'function') { cb = enc; enc = undefined; } try { const r = fsSync.readFileSync(p, enc); _st(() => cb(null, r), 1); } catch (e) { _st(() => cb(e), 1); } }, writeFile: (p, d, cb) => { fsSync.writeFileSync(p, d); _st(() => cb && cb(null), 1); } });
    const pathMod = { join: (...p) => p.join('/').replace(/\/+/g, '/'), basename: (p, ext) => { const b = String(p).split('/').pop(); return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b; }, dirname: (p) => String(p).split('/').slice(0, -1).join('/') || '.', extname: (p) => { const m = /\.[^./]*$/.exec(String(p)); return m ? m[0] : ''; }, resolve: (...p) => '/' + p.join('/').replace(/^\/+/, '').replace(/\/+/g, '/'), sep: '/' };
    const utilMod = { promisify: (fn) => (...a) => new Promise((res, rej) => fn(...a, (e, v) => (e ? rej(e) : res(v)))), inspect: (v, o) => inspect(v, (o && o.depth) ?? 3, new Set(), false), format: (f, ...a) => { let i = 0; const s = String(f).replace(/%[sdj%]/g, (m) => (m === '%%' ? '%' : m === '%j' ? JSON.stringify(a[i++]) : m === '%d' ? Number(a[i++]) : String(a[i++]))); return [s, ...a.slice(i)].join(' '); }, isDeepStrictEqual: deepEq, types: {} };
    const modules = {
      events: EE, assert, 'assert/strict': assert, util: utilMod, test, path: pathMod, fs: fsMod, 'fs/promises': fsP, buffer: { Buffer: Buf }, process, perf_hooks: { performance },
      timers: { setTimeout: st_, setInterval: si_, setImmediate: sim_, clearTimeout: ct_, clearInterval: ci_ },
      'timers/promises': { setTimeout: (ms, v) => new Promise((r) => st_(() => r(v), ms)), setImmediate: (v) => new Promise((r) => sim_(() => r(v))), scheduler: { wait: (ms) => new Promise((r) => st_(r, ms)) } },
      crypto: { randomUUID: () => crypto.randomUUID(), randomBytes: (n) => Buf.from(crypto.getRandomValues(new Uint8Array(n))), webcrypto: crypto },
      os: { EOL: '\n', platform: () => 'browser', cpus: () => [] },
    };
    const req = (id) => { const k = String(id).replace(/^node:/, ''); if (k in modules) return modules[k]; throw new Error("Module '" + id + "' không có trong playground. Hỗ trợ: " + Object.keys(modules).join(', ')); };

    self.addEventListener('unhandledrejection', (ev) => { ev.preventDefault(); const r = ev.reason; if (r instanceof ExitSignal) { post({ k: 'done' }); return; } post({ k: 'log', l: 'error', t: 'Unhandled rejection: ' + errText(r) }); });
    self.addEventListener('error', (ev) => { ev.preventDefault(); post({ k: 'log', l: 'error', t: 'Uncaught ' + (ev.message || '') }); });
    self.onmessage = async (e) => {
      try {
        const AF = Object.getPrototypeOf(async function () {}).constructor;
        const fn = new AF('require', 'process', 'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'Buffer', 'module', 'exports', '__filename', e.data.code);
        const p = fn(req, process, con, st_, ct_, si_, ci_, sim_, ct_, Buf, { exports: {} }, {}, '/playground.js');
        drainTicks(); flushed = true;
        await p; await runTests();
        for (let i = 0; i < 3000; i++) { if (live.size === 0) { await new Promise((r) => _st(r, 0)); await new Promise((r) => _st(r, 0)); if (live.size === 0) break; } else await new Promise((r) => _st(r, 5)); }
        post({ k: 'done' });
      } catch (err) { if (err instanceof ExitSignal) { post({ k: 'done' }); return; } post({ k: 'fatal', t: errText(err) }); }
    };
  }

  async function edRun() {
    if (ED.running) { edLog('sys', 'Đã dừng.'); edFinish('đã dừng'); return; }
    logEl.innerHTML = ''; let code = ta.value;
    try {
      if (ED.lang === 'ts') { stEl.textContent = 'đang nạp TypeScript…'; const ts = await loadTS(); code = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText; }
    } catch (e) { edLog('error', e.message); stEl.textContent = ''; return; }
    code = esmToCjs(code);
    ED.running = true; $('#ed-run').textContent = 'Dừng ■'; stEl.textContent = 'đang chạy…'; const t0 = performance.now();
    let w;
    try { w = new Worker(URL.createObjectURL(new Blob(['(' + workerMain.toString() + ')()'], { type: 'text/javascript' }))); }
    catch (e) { edLog('error', 'Không tạo được Web Worker trong môi trường này: ' + e.message); edFinish('lỗi'); return; }
    ED.worker = w;
    w.onmessage = (ev) => { const m = ev.data; if (m.k === 'log') edLog(m.l, m.t); else if (m.k === 'done') { edFinish('hoàn tất trong ' + Math.round(performance.now() - t0) + ' ms'); } else if (m.k === 'fatal') { edLog('error', m.t); edFinish('lỗi'); } };
    w.onerror = (ev) => { edLog('error', ev.message || 'Lỗi trong worker'); edFinish('lỗi'); };
    w.postMessage({ code });
    ED.kill = setTimeout(() => { edLog('error', 'Đã dừng sau 8 giây: có thể có vòng lặp vô hạn hoặc timer không kết thúc.'); edFinish('quá thời gian'); }, 8000);
  }
  // khởi tạo editor
  (function initEditor() {
    const groups = areas.map((a) => '<optgroup label="' + esc(a.t) + '">' + topics.filter((t) => t.a === a.id && t.code).map((t) => '<option value="' + t.id + '">' + esc(t.t.length > 40 ? t.t.slice(0, 38) + '…' : t.t) + '</option>').join('') + '</optgroup>').join('');
    snip.innerHTML = '<option value="">Ví dụ trống</option>' + groups;
    let saved = null; try { saved = JSON.parse(store.get('nh:ed') || 'null'); } catch {}
    if (saved && typeof saved.code === 'string') { ta.value = saved.code; ED.snip = saved.snip || ''; snip.value = ED.snip; edLang(saved.lang === 'ts' ? 'ts' : 'js'); edRender(); }
    else edLoad('closure');
    ta.addEventListener('input', () => { edRender(); edSave(); });
    ta.addEventListener('scroll', () => { hlp.scrollTop = ta.scrollTop; hlp.scrollLeft = ta.scrollLeft; gut.scrollTop = ta.scrollTop; });
    ta.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); edRun(); return; }
      const v = ta.value, s = ta.selectionStart, en = ta.selectionEnd;
      if (e.key === 'Tab') {
        e.preventDefault();
        const ls = v.lastIndexOf('\n', s - 1) + 1;
        if (s !== en || e.shiftKey) {
          const blockEnd = en; const sel = v.slice(ls, blockEnd); const lines = sel.split('\n');
          const out = e.shiftKey ? lines.map((l) => l.replace(/^ {1,2}/, '')) : lines.map((l) => '  ' + l);
          const nv = v.slice(0, ls) + out.join('\n') + v.slice(blockEnd);
          ta.value = nv; ta.selectionStart = e.shiftKey ? Math.max(ls, s - (lines[0].length - out[0].length)) : s + 2; ta.selectionEnd = ls + out.join('\n').length;
        } else { ta.value = v.slice(0, s) + '  ' + v.slice(en); ta.selectionStart = ta.selectionEnd = s + 2; }
        edRender(); edSave();
      } else if (e.key === 'Enter') {
        const ls = v.lastIndexOf('\n', s - 1) + 1, line = v.slice(ls, s), ind = /^\s*/.exec(line)[0], extra = /[{(\[]\s*$/.test(line) ? '  ' : '';
        e.preventDefault(); const ins = '\n' + ind + extra; ta.value = v.slice(0, s) + ins + v.slice(en); ta.selectionStart = ta.selectionEnd = s + ins.length; edRender(); edSave();
      }
    });
  })();

  /* ---------- sự kiện ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, a, input, summary');
    if (!t) return;
    if (t.matches('[data-fstep]')) return flowStep(t.closest('.flow'), +t.dataset.fstep);
    if (t.matches('[data-fplay]')) return flowPlay(t.closest('.flow'));
    if (t.matches('[data-open]')) { edToggle(true); edLoad(t.dataset.open); return; }
    if (t.matches('[data-copy]')) { const txt = t.closest('.cb').querySelector('code').textContent; const ok = () => { t.textContent = 'Đã chép'; setTimeout(() => (t.textContent = 'Sao chép'), 1200); };
      (navigator.clipboard ? navigator.clipboard.writeText(txt).then(ok) : Promise.reject()).catch(() => { const r = document.createRange(); r.selectNodeContents(t.closest('.cb').querySelector('code')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); t.textContent = 'Đã chọn, nhấn Ctrl+C'; }); return; }
    if (t.matches('[data-lv]')) { STATE.lv = +t.dataset.lv; store.set('nh:lv', String(STATE.lv)); route(true); return; }
    if (t.matches('[data-sp]')) { SIMS.p = +t.dataset.sp; SIMS.i = 0; SIMS.pick = null; if (SIMS.timer) { clearInterval(SIMS.timer); SIMS.timer = null; } renderSim(); return; }
    if (t.matches('[data-pick]')) { SIMS.pick = +t.dataset.pick; renderSim(); return; }
    if (t.matches('[data-sa]')) return simAction(t.dataset.sa);
    if (t.matches('#ed-run')) return edRun();
    if (t.matches('#ed-close')) return edToggle(false);
    if (t.matches('#ed-toggle')) return edToggle();
    if (t.matches('#ed-clear')) { logEl.innerHTML = ''; stEl.textContent = ''; return; }
    if (t.matches('#ed-reset')) { if (ED.snip) edLoad(ED.snip); else { ta.value = ''; edRender(); edSave(); } return; }
    if (t.matches('[data-lang]')) { edLang(t.dataset.lang); edSave(); return; }
    if (t.matches('#menu')) { $('#side').classList.toggle('open'); return; }
    if (t.matches('#theme')) { const order = ['auto', 'light', 'dark']; store.set('nh:theme', order[(order.indexOf(themeMode()) + 1) % 3]); applyTheme(); renderSide(); return; }
    if (t.matches('[data-closesearch]')) { STATE.q = ''; $('#q').value = ''; return; }
    if (t.matches('#side a[href^="#"]') && window.innerWidth < 960) $('#side').classList.remove('open');
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-known]')) { store.set('nh:k:' + t.dataset.known, t.checked ? '1' : '0'); renderSide(); setSideActive(t.dataset.known); }
    if (t.matches('#ed-snip')) { if (t.value) edLoad(t.value); else { ED.snip = ''; edSave(); } }
  });
  let sT;
  $('#q').addEventListener('input', (e) => {
    clearTimeout(sT); const v = e.target.value.trim();
    sT = setTimeout(() => { if (v.length < 2) { if (STATE.q) { STATE.q = ''; route(true); } return; } STATE.q = v; stopAll(); show(viewSearch(v), 'search'); STATE.area = null; renderSide(); window.scrollTo(0, 0); }, 120);
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#q').focus(); $('#q').select(); }
    else if (e.key === 'Escape' && document.activeElement === $('#q')) { $('#q').value = ''; $('#q').blur(); if (STATE.q) { STATE.q = ''; route(true); } }
  });
  window.addEventListener('scroll', spy, { passive: true });
  window.addEventListener('hashchange', () => route(false));
  applyTheme();
  route(false);
})();
