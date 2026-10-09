/* mes_ordctx.js — v226 (차수별 자재표 행) · v225  (v225 발주 차수 cycle_no · v157 신규발주 차수 + v154 중량 수동입력 병합)
 * ─────────────────────────────────────────────────────────────────────────
 * 원재료 발주 · 구매품 발주 화면에서 「자재표 리스트」 한 줄만 가지고
 * 발주 → 입고 → 입고확정 까지 그 자리에서 끝낸다.
 * 외주가공 발주(outsourcing_order_input.html) 의 공정 셀 우클릭 방식과 같다.
 *
 *   마우스 우클릭 (또는 더블클릭 / 모바일 길게누르기) → 상태에 맞는 창
 *     미발주   → 발주창   : 업체·발주수량·발주일·입고요구일·단가·금액 → 즉시 DB 등록
 *     발주     → 입고창   : 입고수량·입고일·입고단가 → order_lines 를 '입고' 로
 *                           (발주취소 = 라인 삭제)
 *     입고     → 확정창   : 확정일·네고율·확정가 → '입고확정'
 *                           (입고취소 = '발주' 로 복귀)
 *     입고확정 → 내역표시 (확정취소 = '입고' 로 복귀)
 *   한 품번에 발주가 여러 건(분할발주·재발주)이면 먼저 발주 내역 목록을 보여주고
 *   줄을 고르면 그 라인의 처리창이 열린다. [＋ 추가 발주] 로 새 발주도 바로 가능.
 *
 * 기존 화면(요청추가 → 구매요청 리스트 → 저장) 은 그대로 살아 있다.
 * 이 파일은 화면 스크립트 뒤에 붙이면 renderBom / loadBom 을 감싸 동작한다.
 *
 * 사용법 (화면 맨 아래)
 *   <script src="mes_ordctx.js?v=142"></script>
 *   <script>MESORDCTX.init({category:'원재료',useWeight:true});</script>
 *   <script>MESORDCTX.init({category:'구매품',useWeight:false});</script>
 *
 * 화면에 이미 있어야 하는 전역 : jobView, jobIdx, VENDORS, bomBody, msg(),
 *                                renderBom(), loadBom()   (두 화면 모두 동일)
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
if (window.MESORDCTX) return;

/* ── 공통 유틸 ─────────────────────────────────────────────── */
const OWNER = (function () {
  try { return (window.MES_AUTH || window.parent.MES_AUTH)?.name || '담당자'; }
  catch (e) { return '담당자'; }
})();
const T0    = () => new Date().toISOString().slice(0, 10);
const _esc  = v => String(v ?? '').replace(/[&<>"]/g, x => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[x]));
const _n    = v => Number(String(v ?? '').replace(/[^0-9.\-]/g, '')) || 0;
const _won  = v => _n(v).toLocaleString('ko-KR');
const _w0   = v => (_n(v) > 0 ? _won(v) : '');   /* v316: 0 이면 빈칸 (예시만 보임) */
const _dt   = v => String(v || '').slice(0, 10);
const _online = () => !!(window.MESDB && window.MESDB.online);
const $  = id => document.getElementById(id);
const _v = id => { const e = $(id); return e ? e.value : ''; };
function say(t) { try { if (typeof window.msg === 'function') window.msg(t); } catch (e) {} }
/* 화면의 전역 변수 읽기.
   화면 스크립트가 let/const 로 선언한 변수(jobView·jobIdx·VENDORS)는 window 에 붙지 않는다.
   전역 렉시컬 환경까지 보려면 전역 스코프에서 도는 함수로 읽어야 한다. */
const GV = (function () {
  const c = {};
  return n => {
    try {
      if (!c[n]) c[n] = new Function('return typeof ' + n + '!=="undefined"?' + n + ':undefined');
      return c[n]();
    } catch (e) { return undefined; }
  };
})();
function pop(t, title) { try { (window.MESPOP || window.parent?.MESPOP)?.ok(t, title || '처리 완료'); } catch (e) {} }

/* ── 설정 (init 에서 덮어씀) ───────────────────────────────── */
let CFG = {
  category : '원재료',   /* order_lines.category */
  useWeight: true,       /* 금액 = 단가 × 중량(kg). false 면 단가 × 발주수량 */
  priceKey : r => r.mat || r.part,
  bySize   : true        /* 자재단가 조회 시 두께로 사이즈 매칭 */
};

/* ── 발주 라인 캐시 : 품번 → 현재 발주차수의 order_lines 행 배열 ── */
const LINES = new Map();
let LINES_JOB = '';

/* v156: 원재료/구매품 신규발주 차수.
   [신규발주:ID]가 처음 기록된 뒤에는 같은 품번의 최신 차수만 현재 진행으로 본다.
   과거 order_lines 는 삭제/수정하지 않으므로 발주현황의 이력은 그대로 남는다. */
const CYCLE = new Map();                                      /* 품번 → 현재 차수ID */
const CYCLE_RE = /\[신규발주:([^\]]+)\]/;
const cycleKey = p => String(p || '');
const cycleOf = l => { const m = String(l && l.remark || '').match(CYCLE_RE); return m ? m[1] : ''; };
const newCycleId = () => { const d=new Date(), z=n=>String(n).padStart(2,'0'); return `N${d.getFullYear()}${z(d.getMonth()+1)}${z(d.getDate())}${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}-${String(Date.now()).slice(-4)}`; };
function withCycleRemark(remark, id) {   /* v225: 비고에 차수 표식을 더 이상 넣지 않는다 (cycle_no 컬럼) */
  const r = String(remark || '').trim().replace(CYCLE_RE, '').trim();
  return r || null;
}
/* v225: 차수는 part_cycles(MESCYCLE) 의 현재 차수 번호로 본다. order_lines.cycle_no 가 현재 차수인 행만 진행으로 남긴다.
   (mes_cycle.js 가 없으면 전부 현재 진행으로 본다 — 예전 비고 표식은 sql_v225 에서 cycle_no 로 변환됨) */
function activeCycleRows(rows, remember=true) {
  const a = (rows || []).slice().sort((x,y)=>(Number(x.line_id)||0)-(Number(y.line_id)||0));
  if (!window.MESCYCLE) return a;
  return a.filter(l => MESCYCLE.lineNo(l) === MESCYCLE.cur(l.part_no));
}
const cycNo     = p => window.MESCYCLE ? MESCYCLE.cur(p) : 1;
const cycReason = p => window.MESCYCLE ? (MESCYCLE.reason(p) || null) : null;
const cycleIdFor = p => CYCLE.get(cycleKey(p)) || '';
const cleanCycleRemark = remark => String(remark || '').replace(CYCLE_RE, '').trim();

/* v142: 조회가 겹쳐도 같은 발주가 두세 번 쌓이지 않게 한다.
   (처리 후 refresh 와 onChange 알림이 동시에 돌던 문제 — 결과는 지역 Map 에 담고 마지막 호출만 반영) */
let _seq = 0;
async function loadLines(job) {
  const my = ++_seq;
  if (!job || !_online()) { LINES.clear(); CYCLE.clear(); LINES_JOB = job || ''; return; }
  const out = new Map();
  try {
    const rs = await MESDB.table('order_lines').select(
      `select=*&category=eq.${encodeURIComponent(CFG.category)}` +
      `&job_no=eq.${encodeURIComponent(job)}&order=line_id`, { fresh: true });
    if (window.MESCYCLE && !(MESCYCLE.job === job && MESCYCLE.category === CFG.category)) { try { await MESCYCLE.load(job, CFG.category); } catch (e) {} }
    /* v226: 차수별 행 — 품번|차수 로 묶는다. 자재표에는 차수마다 한 줄(1차 위, 2차 아래)이 있다 */
    (rs || []).slice().sort((x,y)=>(Number(x.line_id)||0)-(Number(y.line_id)||0)).forEach(r => {
      const k = lkey(r.part_no, r.cycle_no);
      const a = out.get(k) || []; a.push(r); out.set(k, a);
    });
  } catch (e) { return; }              /* 조회 실패는 화면을 막지 않는다 (직전 내역 유지) */
  if (my !== _seq) return;             /* 더 최근 조회가 시작됐으면 이번 결과는 버린다 */
  LINES.clear(); out.forEach((v, k) => LINES.set(k, v)); LINES_JOB = job;
}
const lkey = (p, c) => String(p || '') + '|' + (Number(c) || 1);
/* b : 자재표 행 {part,cyc} 또는 품번 문자열(현재 차수) */
const linesOf = b => LINES.get(typeof b === 'object' && b ? lkey(b.part, b.cyc || cycNo(b.part)) : lkey(b, cycNo(b))) || [];
const bCyc = b => (typeof b === 'object' && b && b.cyc) ? Number(b.cyc) : cycNo(typeof b === 'object' && b ? b.part : b);
const isOldCycle = b => bCyc(b) < cycNo(typeof b === 'object' && b ? b.part : b);
/* v311: 화면 줄 ↔ 자재표 행을 줄 번호 대신 품번+차수로 맞춘다.
   차수 전개(expandBom)로 j.bom 이 바뀐 뒤 다시 그리기 전에 우클릭하면 옆 줄(다른 금형번호)이 열리던 문제 */
const rowIdx = (tr, fallback) => {
  const j = curJob(); if (!j || !tr || !tr.dataset || !tr.dataset.oxPart) return fallback;
  const p = tr.dataset.oxPart, c = Number(tr.dataset.oxCyc) || 1;
  const k = (j.bom || []).findIndex(x => x && x.part === p && bCyc(x) === c);
  return k >= 0 ? k : fallback;
};
const curJob  = () => (GV('jobView') || [])[GV('jobIdx')] || null;
const vendorList = () => GV('VENDORS') || [];

/* 품번의 진행 상태 : 남은 일(가장 앞선 단계) 기준 */
function partState(p) {
  const a = linesOf(p);
  if (!a.length) return { code: '', label: '미발주', cls: 's-new', n: 0 };
  const c = { 발주: 0, 입고: 0, 입고확정: 0 };
  a.forEach(r => { if (c[r.status] != null) c[r.status]++; });
  if (c.발주)     return { code: '발주',     label: '발주',  cls: 's-out',  n: c.발주 };
  if (c.입고)     return { code: '입고',     label: '입고',  cls: 's-in',   n: c.입고 };
  if (c.입고확정) return { code: '입고확정', label: '완료',  cls: 's-done', n: c.입고확정 };
  return { code: '', label: '미발주', cls: 's-new', n: 0 };
}
/* 기발주 수량 (재발주분 제외) · 잔량 */
function ordered(p) {
  return linesOf(p).filter(r => !r.reorder_reason)
    .reduce((s, r) => s + (Number(r.order_qty) || 0), 0);
}
function remain(b) { return Math.max(0, (Number(b.qty) || 0) - ordered(b)); }
/* v169: 자재표에서 체크된(활성) 품번 목록 */
function checkedBoms() {
  const j = curJob(); if (!j || !j.bom) return [];
  const tb = $('bomBody'); if (!tb) return [];
  return [...tb.querySelectorAll('input[type=checkbox][data-i]:checked:not(:disabled)')]
    .map(cb => { const i = rowIdx(cb.closest('tr'), Number(cb.dataset.i)); return { i, b: j.bom[i] }; }).filter(x => x.b);
}
/* 일괄 대상 : 상태별로 걸러 {b, lines} 로 */
function batchFor(status) {
  const bt = (CTX && CTX.batch) || [];
  return bt.map(x => {
    const ls = linesOf(x.b).filter(l => !status || String(l.status || '') === status);
    return { b: x.b, lines: ls };
  });
}
const batchNote = (n, what, skip) => n
  ? `<div class="note" style="border-color:#7fb07f;background:#eef8ee;color:#245c24"><b>☑ 체크한 ${n}개 품번에 함께 ${what}</b>${skip && skip.length ? ` · 제외 ${skip.length}개 (${_esc(skip.slice(0, 6).join(', '))}${skip.length > 6 ? ' …' : ''})` : ''}</div>`
  : '';

/* ── 스타일 · 팝업 DOM (한 번만 주입) ──────────────────────── */
function ensureUI() {
  if ($('oxPop')) return;

  const st = document.createElement('style');
  st.id = 'oxStyle';
  st.textContent = `
#bomBody td.ox{text-align:center;user-select:none;cursor:pointer;font-weight:700;white-space:nowrap;background:#fff!important;color:#8b98a3}
#bomBody td.ox .st{display:block;font-size:10px;line-height:12px;font-weight:400}
#bomBody td.ox.s-new {background:#8fdc6b!important;color:#20461a}
#bomBody td.ox.s-out {background:#ffe9d1!important;color:#7a4a12}
#bomBody td.ox.s-in  {background:#dbeaf8!important;color:#1a4f7a}
#bomBody td.ox.s-done{background:#e6e9ec!important;color:#7d8993}
.oxhint{margin-left:10px;color:#4a6b88;background:#eaf3fb;border:1px solid #c3daed;border-radius:12px;padding:3px 10px;white-space:nowrap;font-weight:400}
.oxhint b{color:#1d5da3}
#oxMask{position:fixed;inset:0;z-index:9000;display:none}#oxMask.on{display:block}
#oxPop{position:fixed;z-index:9001;width:430px;max-width:96vw;max-height:92vh;overflow:auto;background:#fff;border:1px solid #6f8090;
 box-shadow:0 8px 26px rgba(0,0,0,.28);display:none;font:12px/1.5 "Malgun Gothic","맑은 고딕",Arial,sans-serif;color:#22303a}
#oxPop.on{display:block}
#oxPop .ch{display:flex;align-items:center;gap:8px;padding:0 8px 0 11px;height:31px;color:#fff;font-weight:700;background:linear-gradient(#5f7f9f,#3f5f7d);cursor:move;user-select:none;touch-action:none}
#oxPop .ch.k-order{background:linear-gradient(#5e9e46,#3f7a2c)}
#oxPop .ch.k-in{background:linear-gradient(#e08a2b,#b8681a)}
#oxPop .ch.k-cfm{background:linear-gradient(#3f7fc4,#2a5d95)}
#oxPop .ch .x{margin-left:auto;border:0;background:transparent;color:#fff;cursor:pointer;font:inherit;font-size:14px}
#oxPop .cb{padding:9px 11px 6px;max-height:72vh;overflow:auto}
#oxPop .sub{color:#4d5c69;margin-bottom:7px;line-height:1.5}#oxPop .sub b{color:#20456b}
#oxPop .g{display:grid;grid-template-columns:80px minmax(0,1fr) 80px minmax(0,1fr);gap:5px 7px;align-items:center}
#oxPop .g label{font-weight:700;text-align:right;color:#4d5c69;white-space:nowrap}
#oxPop .g input,#oxPop .g select{width:100%;min-width:0;height:25px;border:1px solid #b9c3cb;padding:0 5px;
 font:inherit;box-sizing:border-box;color:#22303a;background:#fff}
#oxPop .g input.r{text-align:right}
#oxPop .g .full{grid-column:2/5}
/* v158: 중량(kg) 수동 입력 — 입력칸 + [자동] 되돌리기 버튼. 손으로 고친 칸은 노란 바탕 */
#oxPop .g .wtbox{display:flex;gap:4px;align-items:center;min-width:0}
#oxPop .g .wtbox input{flex:1 1 auto}
#oxPop .g .wtbox button{flex:0 0 auto;height:25px;min-width:38px;padding:0 6px;border:1px solid #9ca9b5;
 background:linear-gradient(#fff,#dfe6eb);font:inherit;white-space:nowrap;cursor:pointer}
#oxPop .g .wtbox button:hover{background:#fff}
#oxPop .g input.manual{background:#fffbe6;border-color:#d4ad3f;font-weight:700}
#oxPop .note{font-size:11px;color:#6d7b88;margin-top:6px;line-height:1.45}
#oxPop .info{display:grid;grid-template-columns:80px 1fr;gap:3px 8px}#oxPop .info b{color:#4d5c69;text-align:right}
#oxPop table.ln{width:100%;border-collapse:collapse;margin-top:2px}
#oxPop table.ln th,#oxPop table.ln td{border:1px solid #d5dde3;height:24px;padding:0 5px;white-space:nowrap;font-size:11px}
#oxPop table.ln th{background:linear-gradient(#dbe9f4,#c7d9e8);color:#405266}
#oxPop table.ln tbody tr{cursor:pointer}
#oxPop table.ln tbody tr:hover td{background:#edf6fd}
#oxPop table.bt{margin:4px 0 6px}#oxPop table.bt tbody tr{cursor:default}#oxPop table.bt td{padding:0 2px}
#oxPop table.bt td input{width:100%;height:22px;border:1px solid #c7d1da;padding:0 4px;font-size:11px;box-sizing:border-box}
#oxPop table.bt td input[readonly]{background:#f3f6f8}#oxPop table.bt td input.manual{background:#fff6c8}
#oxPop table.bt td input[data-auto="1"]{color:#1d5da3}
#oxPop table.ln td.r{text-align:right}#oxPop table.ln td.c{text-align:center}
#oxPop .badge{display:inline-block;padding:0 5px;border-radius:7px;color:#fff;font-size:10px}
#oxPop .b-out{background:#e07a1f}#oxPop .b-in{background:#2f6fb5}#oxPop .b-done{background:#8b98a3}
#oxPop .cf{display:flex;gap:6px;justify-content:flex-end;padding:8px 11px 10px;border-top:1px solid #e3e9ed;background:#f7f9fa;flex-wrap:wrap}
#oxPop .cf .btn{height:27px;min-width:72px;border:1px solid #9ca9b5;background:linear-gradient(#fff,#dfe6eb);font:inherit}
#oxPop .cf .btn.go{font-weight:700;color:#fff;border-color:#2a5d95;background:linear-gradient(#4a8ad0,#2f6fb0)}
#oxPop .cf .btn.go.k-order{border-color:#3f7a2c;background:linear-gradient(#5e9e46,#3f7a2c)}
#oxPop .cf .btn.go.k-in{border-color:#b8681a;background:linear-gradient(#e08a2b,#b8681a)}
#oxPop .cf .btn.warn{color:#a33;border-color:#c9a7a7}
#oxPop .cf .btn:disabled{opacity:.5}
/* v142: 우클릭으로 발주·입고·확정을 끝내므로 협력업체리스트·요청추가 바·구매요청 리스트를 감추고
   제번리스트·자재표 리스트를 화면 높이만큼 넓힌다 (외주가공 발주 v116 과 같은 배치).
   body.ox-classic 이면 옛 배치(요청 리스트·PRINT 발주서)로 돌아간다 — 코드는 그대로 둔다. */
body:not(.ox-classic) .panes{grid-template-columns:minmax(340px,1.1fr) 2.2fr!important;flex:1 1 auto!important;height:auto!important;min-height:0;padding-bottom:8px!important}
/* 제번리스트는 제번·품번·공정·공정명이 다 보이도록 넓게, 자재표는 그만큼 줄인다.
   표는 칸 폭에 맞춰 고정 — 안쪽에 가로 스크롤이 생겨 열이 잘리는 일을 막는다. */
body:not(.ox-classic) .panes>.box .tablewrap{overflow-x:hidden!important;overflow-y:auto!important}
body:not(.ox-classic) .panes>.box table{width:100%!important;min-width:0!important;table-layout:fixed!important}
/* 저장된 배치(ui_layout)가 블록에 직접 박아 둔 width·height 를 무시한다.
   ─ 제번리스트에 width:518px 이 남아 있어 표가 잘리고, 숨긴 협력업체리스트 자리(460px)까지
     그대로 차지하면서 자재표가 화면 밖으로 밀려났다. 이 배치는 두 리스트가 창을 꽉 채운다. */
body:not(.ox-classic) .panes>.box{width:auto!important;max-width:none!important;min-width:0!important;
 height:auto!important;min-height:0!important;align-self:stretch!important;flex:1 1 auto!important}
body:not(.ox-classic) .panes>.box:nth-child(3),body:not(.ox-classic) .midbar,body:not(.ox-classic) .reqbox{display:none!important}
.panes>.box{min-width:0}.panes>.box table{min-width:0!important}
#oxToggle{margin-left:auto;height:27px;border:1px solid #9ca9b5;background:linear-gradient(#fff,#dfe6eb);font:inherit;white-space:nowrap}
body.ox-classic #oxToggle{background:linear-gradient(#f9ffff,#d2e7f6);color:#1e5e91;font-weight:700}
@media(max-width:900px){body:not(.ox-classic) .panes{grid-template-columns:1fr!important}}
@media(max-width:640px){
 #oxPop{width:96vw;left:2vw!important;right:2vw;top:auto!important;bottom:0;max-height:88vh}
 #oxPop .g{grid-template-columns:76px minmax(0,1fr)}
 #oxPop .g .full{grid-column:2/3}
 #oxPop .cf .btn{flex:1 1 auto}
}`;
  document.head.appendChild(st);

  const mask = document.createElement('div'); mask.id = 'oxMask'; mask.onclick = close;
  const p = document.createElement('div'); p.id = 'oxPop';
  p.innerHTML = '<div class="ch" id="oxHead"><span id="oxTitle"></span><button class="x" type="button">✕</button></div>' +
                '<div class="cb" id="oxBody"></div><div class="cf" id="oxFoot"></div>';
  document.body.appendChild(mask); document.body.appendChild(p);
  p.querySelector('.ch .x').onclick = close;
  /* v153: 원재료/구매품 처리창 — 제목바를 잡고 화면 안에서 드래그 이동 */
  const head = $('oxHead');
  if (head && !head.__mesDrag) {
    head.__mesDrag = 1;
    let d = null;
    head.addEventListener('pointerdown', e => {
      if (e.button != null && e.button !== 0) return;
      if (e.target.closest('button,.x')) return;
      const r = p.getBoundingClientRect();
      d = { id:e.pointerId, x:e.clientX, y:e.clientY, l:r.left, t:r.top, w:r.width, h:r.height };
      try { head.setPointerCapture(e.pointerId); } catch (x) {}
      e.preventDefault();
    });
    head.addEventListener('pointermove', e => {
      if (!d || (e.pointerId != null && e.pointerId !== d.id)) return;
      const nx = Math.max(4, Math.min(window.innerWidth  - d.w - 4, d.l + e.clientX - d.x));
      const ny = Math.max(4, Math.min(window.innerHeight - d.h - 4, d.t + e.clientY - d.y));
      p.style.right = 'auto'; p.style.bottom = 'auto';
      p.style.left = nx + 'px'; p.style.top = ny + 'px';
      e.preventDefault();
    });
    const stop = e => {
      if (!d || (e.pointerId != null && e.pointerId !== d.id)) return;
      try { head.releasePointerCapture(d.id); } catch (x) {}
      d = null;
    };
    head.addEventListener('pointerup', stop);
    head.addEventListener('pointercancel', stop);
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

let CTX = null;                                    /* {b, i, line} */
function close() { const m = $('oxMask'), p = $('oxPop'); if (m) m.classList.remove('on'); if (p) p.classList.remove('on'); CTX = null; }

function open(ev, title, kind, bodyHtml, footBtns) {
  ensureUI();
  const p = $('oxPop');
  p.style.width = /id="oxBt"/.test(bodyHtml) ? '640px' : '';
  $('oxTitle').textContent = title;
  $('oxHead').className = 'ch ' + (kind || '');
  $('oxBody').innerHTML = bodyHtml;
  const f = $('oxFoot'); f.innerHTML = '';
  (footBtns || [{ t: '닫기', fn: close }]).forEach(b => {
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'btn ' + (b.cls || ''); el.textContent = b.t;
    if (b.id) el.id = b.id;
    if (b.title) el.title = b.title;
    el.onclick = b.fn; f.appendChild(el);
  });
  $('oxMask').classList.add('on'); p.classList.add('on');
  /* 마우스 위치 근처에, 화면 밖으로 나가지 않게 */
  p.style.left = '0px'; p.style.top = '0px';
  const W = p.offsetWidth || 430, H = p.offsetHeight || 260;
  let x = (ev && ev.clientX != null ? ev.clientX : 40) + 6;
  let y = (ev && ev.clientY != null ? ev.clientY : 40) + 6;
  if (x + W > window.innerWidth  - 8) x = Math.max(8, window.innerWidth  - W - 8);
  if (y + H > window.innerHeight - 8) y = Math.max(8, window.innerHeight - H - 8);
  p.style.left = x + 'px'; p.style.top = y + 'px';
  const first = p.querySelector('#oxBody input:not([readonly]),#oxBody select');
  if (first) setTimeout(() => first.focus(), 30);
  return false;
}

/* ── 진입점 : 자재표 한 줄 우클릭 ──────────────────────────── */
function openPart(ev, idx) {
  if (ev) { ev.preventDefault(); ev.stopPropagation(); }
  const j = curJob(); if (!j) { say('제번을 먼저 선택하세요.'); return false; }
  const b = (j.bom || [])[idx]; if (!b) return false;
  if (LINES_JOB !== j.job) { say('발주 내역을 불러오는 중입니다. 잠시 후 다시 시도하세요.'); loadLines(j.job).then(refresh); return false; }
  CTX = { b, i: idx, job: j };
  /* v169: 체크한 다른 품번도 함께 처리 (가공계획 적용과 같은 방식) — 우클릭한 줄 + 체크된 줄 */
  CTX.batch = checkedBoms().filter(x => x.i !== idx); CTX.extraLines = null;
  const a = linesOf(b);
  if (!a.length) return formOrder(ev);
  if (a.length === 1) return formLine(ev, a[0]);
  return listLines(ev);
}

const headHtml = () => {
  const { b, job } = CTX;
  const fresh = !!(CTX && CTX.newCycle), oq = fresh ? 0 : ordered(b), rem = fresh ? (Number(b.qty)||0) : remain(b);
  return `<div class="sub"><b>${_esc(job.job)}</b> · ${_esc(b.part)} ${_esc(b.name || '')}` +
         `${b.mat ? ' · ' + _esc(b.mat) : ''}${b.spec ? ' · ' + _esc(b.spec) : ''}` +
         ` · 자재표 수량 <b>${Number(b.qty) || 0}</b> / 현재차수 기발주 ${oq} / 잔량 <b>${rem}</b></div>`;
};

/* v156: 현재 차수가 모두 입고확정된 품번만 신규발주 가능. 기존 이력은 남고 새 차수는 소요수량 전체에서 다시 시작한다. */
function startNewCycle(ev) {
  if (!CTX || !CTX.b) return false;
  const { b } = CTX, a = linesOf(b).filter(l => ['발주','입고','입고확정'].includes(String(l.status||'')));
  if (!a.length) { say(`${b.part} 기존 발주 이력이 없습니다. 일반 발주를 이용하세요.`); return false; }
  const openRows = a.filter(l => String(l.status||'') !== '입고확정');
  if (openRows.length) {
    const st = [...new Set(openRows.map(l=>l.status||'미완료'))].join(', ');
    say(`${b.part} 현재 차수가 아직 완료되지 않았습니다 (${st}). 모든 발주건을 입고확정한 뒤 신규발주하세요.`);
    return false;
  }
  if (!confirm(`${b.part} ${b.name||''}의 현재 발주 진행을 이전 차수로 남기고 신규발주를 시작합니다.

· 기존 발주/입고/확정 이력은 삭제하거나 수정하지 않습니다.
· 새 차수의 발주수량은 소요수량 ${Number(b.qty)||0}부터 다시 계산합니다.
· 첫 발주를 실제 등록하면 신규 차수가 확정됩니다.

계속할까요?`)) return false;
  CTX.line = null; CTX.newCycle = true; CTX.cycleId = newCycleId();
  const pos = ev && ev.clientX != null ? ev : {clientX:Math.max(20,Math.round(innerWidth*.42)),clientY:Math.max(60,Math.round(innerHeight*.28))};
  return formOrder(pos);
}

/* ── 발주가 여러 건인 품번 : 내역 목록 ─────────────────────── */
function listLines(ev) {
  const { b } = CTX;
  const a = linesOf(b);
  const bd = { 발주: 'b-out', 입고: 'b-in', 입고확정: 'b-done' };
  const nm = { 발주: '발주', 입고: '입고', 입고확정: '확정' };
  const rows = a.map((l, k) => `<tr data-k="${k}">
    <td class="c"><input type="checkbox" class="lk" data-k="${k}" ${l.status === '발주' ? 'checked' : 'disabled'} onclick="event.stopPropagation()" title="${l.status === '발주' ? '체크한 발주건을 아래 버튼으로 함께 입고·취소' : '발주 상태만 함께 처리'}"></td>
    <td class="c"><span class="badge ${bd[l.status] || ''}">${nm[l.status] || _esc(l.status)}</span></td>
    <td>${_esc(l.vendor_name || '')}${l.reorder_reason ? ' <b style="color:#a04000">재</b>' : ''}</td>
    <td class="r">${Number(l.order_qty) || 0}</td>
    <td class="r">${_won(l.confirm_price || l.quote_price)}</td>
    <td class="c">${_esc(_dt(l.order_date))}</td>
    <td class="c">${_esc(_dt(l.receipt_date))}</td></tr>`).join('');
  open(ev, `${b.part} — 발주 내역 ${a.length}건`, '', headHtml() +
    `<table class="ln"><thead><tr><th style="width:24px"><input type="checkbox" id="oxLkAll" ${a.some(l => l.status === '발주') ? 'checked' : 'disabled'} onclick="event.stopPropagation()"></th><th style="width:46px">상태</th><th>협력업체</th><th style="width:46px">수량</th>
     <th style="width:76px">금액</th><th style="width:76px">발주일</th><th style="width:76px">입고일</th></tr></thead>
     <tbody id="oxLn">${rows}</tbody></table>
     <div class="note">줄을 클릭하면 그 발주건의 <b>입고 / 입고확정 / 취소</b> 창이 열립니다. <b>발주 상태 줄을 체크</b>하면 [입고 처리]·[발주취소]가 체크한 건 전부에 적용됩니다.</div>`,
    [{ t: '▣ 입고 처리 (체크)', cls: 'go k-in', id: 'oxLnIn', title: '체크한 발주건을 한 창에서 함께 입고 처리합니다', fn: e => {
        const ks = lnChecked(); if (!ks.length) return say('입고할 발주건을 체크하세요.');
        CTX.extraLines = ks.slice(1).map(k => a[k]); return formReceive(e, a[ks[0]]); } },
     { t: '✖ 발주취소 (체크)', cls: 'warn', id: 'oxLnDel', title: '체크한 발주건을 모두 삭제합니다', fn: () => doOrderCancelMany(lnChecked().map(k => a[k])) },
     { t: '＋ 추가 발주', cls: 'go k-order', fn: e => formOrder(e) },
     /* v196: 신규발주 버튼 제거 — 추가발주로 대신한다 (차수 집계 코드는 그대로) */
     { t: '닫기', fn: close }]);
  $('oxLn').querySelectorAll('tr').forEach(tr => {
    tr.onclick = e => { CTX.extraLines = null; formLine(e, a[Number(tr.dataset.k)]); };
  });
  const all = $('oxLkAll'); if (all) all.onclick = e => { e.stopPropagation(); $('oxLn').querySelectorAll('input.lk:not(:disabled)').forEach(c => c.checked = all.checked); };
  return false;
}
const lnChecked = () => [...(($('oxLn') || document).querySelectorAll('input.lk:checked'))].map(c => Number(c.dataset.k));
/* v169: 같은 품번의 여러 발주건을 한 번에 취소 */
async function doOrderCancelMany(ls) {
  const { b } = CTX; ls = (ls || []).filter(l => l && l.line_id && l.status === '발주');
  if (!ls.length) return say('취소할 발주건을 체크하세요. (발주 상태만 취소 가능)');
  if (!_online()) return say('DB 미연결 - 발주취소를 할 수 없습니다.');
  if (!confirm(`${b.part} 발주 ${ls.length}건을 취소(삭제)합니다.\n\n` + ls.map(l => ` · ${l.vendor_name || ''} ${Number(l.order_qty) || 0}개 ${_dt(l.order_date)}`).join('\n') + `\n\n되돌릴 수 없습니다. 계속할까요?`)) return;
  try {
    await MESDB.delLines(ls.map(l => Number(l.line_id)));
    await after(`${b.part} 발주 ${ls.length}건을 취소(삭제)했습니다.`);
  } catch (e) { say('발주취소 실패: ' + String(e.message || e).slice(0, 120)); }
}

function formLine(ev, l) {
  if (l.status === '발주')     return formReceive(ev, l);
  if (l.status === '입고')     return formConfirm(ev, l);
  if (l.status === '입고확정') return formDone(ev, l);
  return open(ev, '처리할 수 없음', '', headHtml() +
    `<div class="note">상태 「${_esc(l.status)}」 는 이 창에서 처리하지 않습니다.</div>`);
}

/* v169: 함께 발주할 품번 표 — 수량·중량·단가는 품번별로 직접 고칠 수 있다 */
function batchTable(ok) {
  if (!ok.length) return '';
  const W = CFG.useWeight;
  return `<table class="ln bt" id="oxBt"><thead><tr><th>품번</th><th>부품명</th><th>재질·규격</th><th style="width:52px">수량</th>${W ? '<th style="width:64px">중량kg</th>' : ''}<th style="width:78px">단가</th><th style="width:86px">금액(견적가)</th></tr></thead><tbody>${
    ok.map((x, k) => { const q = Math.max(1, remain(x.b) || Number(x.b.qty) || 1), kg = W ? Math.round(autoKg(x.b.spec, q) * 100) / 100 : 0;
      return `<tr data-k="${k}"><td>${_esc(x.b.part)}</td><td>${_esc(x.b.name || '')}</td><td>${_esc([x.b.mat, x.b.spec].filter(Boolean).join(' '))}</td>
        <td><input class="r bq" value="${q}" inputmode="numeric"></td>${W ? `<td><input class="r bw" value="${kg ? kg.toFixed(2) : ''}" inputmode="decimal"></td>` : ''}
        <td><input class="r bp" placeholder="자동" inputmode="numeric" data-auto="1"></td><td><input class="r ba" readonly></td></tr>`; }).join('')}</tbody></table>`;
}
function batchRows() {
  const t = $('oxBt'); if (!t) return [];
  return [...t.querySelectorAll('tbody tr')].map(tr => {
    const k = Number(tr.dataset.k), x = (CTX.batchOrder || [])[k]; if (!x) return null;
    const q = Math.max(1, Math.round(_n(tr.querySelector('.bq').value)));
    const wEl = tr.querySelector('.bw'), kg = wEl ? _n(wEl.value) : 0, price = _n(tr.querySelector('.bp').value);
    const amt = Math.round(price * (kg || q));
    return { b: x.b, tr, q, kg, price, amt, auto: tr.querySelector('.bp').dataset.auto === '1' };
  }).filter(Boolean);
}
function batchCalc() {
  batchRows().forEach(r => { r.tr.querySelector('.ba').value = r.price ? _won(r.amt) : ''; const p = r.tr.querySelector('.bp'); if (r.price) p.value = _won(r.price); });
}
async function batchPrice() {
  const v = _v('oxVendor'), d = _v('oxOdate') || T0(); if (!v || !window.MESPRICE) return batchCalc();
  for (const r of batchRows()) {
    const p = r.tr.querySelector('.bp'); if (p.dataset.auto !== '1') continue;
    let ep = 0;
    try { const opt = { asOf: d }; if (CFG.bySize) { const th = Number(String(r.b.spec || '').split(/[*xX×]/)[0]); if (th > 0) opt.size = th; }
      const hit = await MESPRICE.material(CFG.priceKey(r.b), v, opt); if (hit && hit.price) ep = _n(hit.price); } catch (e) {}
    p.value = ep ? _won(ep) : ''; p.placeholder = ep ? '' : '이력 없음';
  }
  batchCalc();
}
function bindBatch() {
  const t = $('oxBt'); if (!t) return;
  t.querySelectorAll('.bq').forEach(i => i.onchange = () => { const tr = i.closest('tr'), w = tr.querySelector('.bw'); if (w && w.dataset.manual !== '1') { const x = CTX.batchOrder[Number(tr.dataset.k)]; const kg = Math.round(autoKg(x.b.spec, Math.max(1, _n(i.value))) * 100) / 100; w.value = kg ? kg.toFixed(2) : ''; } batchCalc(); });
  t.querySelectorAll('.bw').forEach(i => { i.oninput = () => { i.dataset.manual = '1'; i.classList.add('manual'); }; i.onchange = batchCalc; });
  t.querySelectorAll('.bp').forEach(i => i.onchange = () => { i.dataset.auto = ''; batchCalc(); });
}
/* ── ① 발주 ────────────────────────────────────────────────── */
function formOrder(ev) {
  const { b, job } = CTX;
  if (isOldCycle(b)) { say(`${b.part} ${bCyc(b)}차는 이전 차수입니다 — 새 발주는 아래 ${cycNo(b.part)}차 줄에서 하세요.`); return false; }
  if (window.MESCYCLE && MESCYCLE.isEnded(b.part, bCyc(b))) { say(`${b.part} ${bCyc(b)}차는 종료된 차수입니다 — 다시 하려면 [신규진행]으로 새 차수를 시작하세요.`); return false; }
  const vs = vendorList();
  const rem = (CTX && CTX.newCycle) ? (Number(b.qty) || 1) : (remain(b) || Number(b.qty) || 1);
  const rd = (() => { try { return $('reqDate').value || T0(); } catch (e) { return T0(); } })();
  open(ev, `${b.part} — 발주`, 'k-order', headHtml() + `
   <div class="g">
    <label>협력업체</label><select id="oxVendor" class="full"><option value="">(업체 선택)</option>${
      vs.map(v => `<option value="${_esc(v)}">${_esc(v)}</option>`).join('')}</select>
    <label>발주수량</label><input id="oxQty" class="r" value="${rem}" inputmode="numeric">
    <label>발주일</label><input id="oxOdate" type="date" value="${T0()}">
    <label>입고요구일</label><input id="oxRdate" type="date" value="${_esc(rd)}">
    <label>단가</label><input id="oxPrice" class="r" placeholder="예: 45,000" inputmode="numeric">
    ${CFG.useWeight
      ? '<label>중량(kg)</label><span class="wtbox">' +
        '<input id="oxWt" class="r" inputmode="decimal" title="설계치수·발주수량 기준으로 자동 계산됩니다. 실제 소재 중량이 다르면 직접 고쳐 넣으세요.">' +
        '<button type="button" id="oxWtAuto" title="자동계산 값으로 되돌립니다">자동</button></span>'
      : '<label></label><span></span>'}
    <label>발주금액</label><input id="oxAmt" class="r" readonly placeholder="단가 입력 시 자동">
    <label>재발주</label><select id="oxRe"><option value="">(정상 발주)</option><option>불량</option><option>실수</option><option>예비품</option><option>기타</option></select>
    <label>비고</label><input id="oxRemark" placeholder="선택">
   </div>
   ${(CTX && CTX.newCycle) ? `<div class="note" style="border-color:#e5ad62;background:#fff7ea;color:#8a4f08"><b>신규발주</b> — 기존 이력은 이전 차수로 그대로 남고, 이 발주부터 소요수량 전체를 기준으로 새 차수가 시작됩니다.</div>` : ''}
   ${(() => { const bt = (CTX.newCycle ? [] : batchFor()); const ok = bt.filter(x => remain(x.b) > 0 && !isOldCycle(x.b)), skip = bt.filter(x => !(remain(x.b) > 0) || isOldCycle(x.b)).map(x => x.b.part + (isOldCycle(x.b) ? '(이전차수)' : ''));
      CTX.batchOrder = ok; return batchNote(ok.length, '발주 — 아래 표에서 품번별 수량·단가·금액을 각각 고칠 수 있습니다', skip) + batchTable(ok); })()}
   <div class="note" id="oxNote">업체를 고르면 단가변동등록에서 발주일 기준 단가를 자동 조회합니다. 이력이 없으면 직접 입력하세요.</div>
   ${CFG.useWeight ? '<div class="note">중량(kg)은 설계치수로 자동 계산되지만 <b>직접 입력</b>할 수 있습니다. 손으로 넣은 중량은 노랗게 표시되며 발주금액(단가×중량)에 그대로 쓰입니다. [자동]을 누르면 계산값으로 돌아갑니다.</div>' : ''}`,
   [{ t: '▣ 즉시 발주' + ((CTX.batchOrder || []).length ? ` (+${CTX.batchOrder.length}개)` : ''), cls: 'go k-order', id: 'oxGo', fn: doOrder },
    { t: '닫기', fn: close }]);
  $('oxVendor').onchange = () => { autoPrice(); batchPrice(); };
  $('oxOdate').onchange  = () => { autoPrice(); batchPrice(); };
  bindBatch();
  $('oxQty').onchange    = calcAmt;
  $('oxPrice').onchange  = () => { $('oxPrice').dataset.auto = ''; calcAmt(); };
  /* v158: 중량 수동 입력 — 한 번 고치면 수량을 바꿔도 덮어쓰지 않는다 ([자동]으로 해제) */
  const w = $('oxWt');
  if (w) {
    w.oninput  = () => { w.dataset.manual = '1'; w.classList.add('manual'); };
    w.onchange = () => { w.dataset.manual = '1'; const v = _n(w.value); w.value = v ? v.toFixed(2) : ''; calcAmt(); };
    const ab = $('oxWtAuto');
    if (ab) ab.onclick = () => { w.dataset.manual = ''; calcAmt(); w.focus(); };
  }
  calcAmt();
  return false;
}

/* 설계치수(spec) × 수량 → 자동 중량(kg) */
function autoKg(spec, qty) {
  try { if (window.MESPRICE && MESPRICE.weightKg) return Number(MESPRICE.weightKg(spec, qty)) || 0; } catch (e) {}
  return 0;
}

function calcAmt() {
  const { b } = CTX || {}; if (!b) return;
  const p = $('oxPrice'), a = $('oxAmt'), w = $('oxWt');
  const price = _n(p ? p.value : 0), qty = Math.max(1, _n(_v('oxQty')));
  if (p) p.value = price ? _won(price) : '';
  let base = qty;
  if (CFG.useWeight) {
    let kg = 0;
    /* v158: 손으로 넣은 중량이 있으면 자동계산으로 덮어쓰지 않는다 */
    if (w && w.dataset.manual === '1') {
      kg = _n(w.value);
      w.classList.add('manual');
    } else {
      kg = autoKg(b.spec, qty);
      if (w) { w.value = kg ? kg.toFixed(2) : ''; w.classList.remove('manual'); }
    }
    if (kg) base = kg;
  }
  if (a) a.value = price ? _won(Math.round(price * base)) : '';
}

async function autoPrice() {
  const { b } = CTX || {}; if (!b) return;
  const v = _v('oxVendor'), d = _v('oxOdate') || T0();
  const p = $('oxPrice'), note = $('oxNote');
  if (!v || !window.MESPRICE) return calcAmt();
  try {
    const opt = { asOf: d };
    if (CFG.bySize) { const th = Number(String(b.spec || '').split(/[*xX×]/)[0]); if (th > 0) opt.size = th; }
    const hit = await MESPRICE.material(CFG.priceKey(b), v, opt);
    if (p) {
      if (hit && hit.price) { p.value = _won(hit.price); p.dataset.auto = '1'; }
      else if (p.dataset.auto === '1' || !_n(p.value)) { p.value = ''; p.dataset.auto = ''; }
    }
    if (note) note.textContent = (hit && hit.price)
      ? `단가 ${_won(hit.price)}원 (${v} · ${d} 기준 자동조회${hit.matched && hit.matched !== '일치' ? ' · ' + hit.matched : ''})`
      : `${v} · ${CFG.priceKey(b)} 단가 이력이 없습니다 — 단가를 직접 입력하세요.`;
  } catch (e) {}
  calcAmt();
}

async function doOrder() {
  const { b, job } = CTX;
  const vendor = _v('oxVendor');
  if (!vendor) return say('협력업체를 선택하세요.');
  if (!_online()) return say('DB 미연결 - 즉시 발주는 사용할 수 없습니다. [요청추가]로 넣어두세요.');
  const qty = Math.max(1, Math.round(_n(_v('oxQty'))));
  const price = _n(_v('oxPrice'));
  const amt = _n(_v('oxAmt'));
  const re = _v('oxRe'), remark0 = (_v('oxRemark') || '').trim();
  const fresh = !!(CTX && CTX.newCycle), rem = fresh ? (Number(b.qty)||0) : remain(b);

  if (!fresh && !re && rem > 0 && qty > rem &&
      !confirm(`${b.part} 잔량 ${rem} 을(를) 넘는 발주입니다. (자재표 ${Number(b.qty) || 0} / 기발주 ${ordered(b)})\n\n그래도 발주할까요?`))
    return say('발주를 취소했습니다. 발주수량을 확인하세요.');
  if (!price &&
      !confirm('단가가 입력되지 않았습니다.\n\n발주금액 0원으로 등록되어 제조원가에 반영되지 않습니다.\n그래도 발주할까요?'))
    return say('단가를 입력한 뒤 다시 발주하세요.');
  /* 같은 품번이 다른 업체로 미입고 발주돼 있으면 중복구매 경고 */
  const other = fresh ? [] : linesOf(b).filter(l => l.status === '발주' && (l.vendor_name || '') !== vendor);
  if (other.length &&
      !confirm(`${b.part} 은(는) 아래 업체로 이미 발주(미입고)돼 있습니다.\n\n` +
               other.slice(0, 5).map(l => ` · ${l.vendor_name || '(업체미지정)'} ${_dt(l.order_date)} ${Number(l.order_qty) || 0}개`).join('\n') +
               `\n\n중복 구매가 될 수 있습니다. 계속할까요?`))
    return say('발주를 취소했습니다.');
  /* 협력업체 적격성 게이트 */
  try { if (window.MESVCHK && MESVCHK.gate && !(await MESVCHK.gate([vendor]))) return say('협력업체 적격성 확인에서 중단했습니다.'); } catch (e) {}

  const btn = $('oxGo'); if (btn) { btn.disabled = true; btn.textContent = '등록 중…'; }
  /* v169: 체크한 품번들 — 표에 적힌 수량·중량·단가·금액을 그대로 쓴다 (자동값이든 손으로 고친 값이든) */
  const extra = [], noPrice = [];
  if (!fresh) for (const r of batchRows()) {
    const eb = r.b; let ep = r.price;
    if (!ep && r.auto && price && CFG.priceKey(eb) === CFG.priceKey(b)) ep = price;
    const eamt = Math.round(ep * (r.kg || r.q));
    if (!ep) noPrice.push(eb.part);
    extra.push({ b: eb, row: {
      category: CFG.category, status: '발주',
      vendor_name: vendor, job_no: job.job, item_name: job.item || null,
      process_code: eb.procCode || job.proc || null,
      part_no: eb.part, part_name: eb.name || null,
      material: eb.mat || null, spec: eb.spec || null,
      order_qty: r.q, order_weight: r.kg || null,
      unit_price: ep || null, quote_price: eamt || null, confirm_price: eamt || null,
      order_date: _v('oxOdate') || T0(), required_date: _v('oxRdate') || null,
      owner_name: OWNER,
      remark: withCycleRemark((re ? `[재발주:${re}]` + (remark0 ? ' ' + remark0 : '') : (remark0 || null)), cycleIdFor(eb.part)),
      cycle_no: bCyc(eb), cycle_reason: bCyc(eb) === cycNo(eb.part) ? cycReason(eb.part) : null,
      reorder_reason: re || null } });
  }
  if (noPrice.length && !confirm(`단가 이력이 없어 0원으로 발주되는 품번이 있습니다:\n${noPrice.join(', ')}\n\n(발주 뒤 입고 창에서 입고단가를 넣을 수 있습니다) 계속할까요?`)) {
    if (btn) { btn.disabled = false; btn.textContent = '▣ 즉시 발주'; } return say('발주를 취소했습니다.'); }
  try {
    await MESDB.newLines([{
      category: CFG.category, status: '발주',
      vendor_name: vendor, job_no: job.job, item_name: job.item || null,
      process_code: b.procCode || job.proc || null,
      part_no: b.part, part_name: b.name || null,
      material: b.mat || null, spec: b.spec || null,
      order_qty: qty,
      order_weight: (CFG.useWeight ? _n(_v('oxWt')) : 0) || null,   /* v158: 자동계산이든 수동입력이든 그대로 저장 */
      unit_price  : price || null,
      quote_price : amt || null,
      confirm_price: amt || null,
      order_date  : _v('oxOdate') || T0(),
      required_date: _v('oxRdate') || null,
      owner_name  : OWNER,
      remark      : withCycleRemark((re ? `[재발주:${re}]` + (remark0 ? ' ' + remark0 : '') : (remark0 || null)), fresh ? CTX.cycleId : cycleIdFor(b.part)),
      cycle_no    : bCyc(b), cycle_reason: bCyc(b) === cycNo(b.part) ? cycReason(b.part) : null,
      reorder_reason: re || null
    }, ...extra.map(x => x.row)]);
    /* v170: 발주서 메일 창 — 방금 발주한 라인 + PartList 그림 */
    const mailLines = [{ part: b.part, name: b.name, mat: b.mat, spec: b.spec, qty, price, amt, rdate: _v('oxRdate') || '', image_url: b.image || '' },
      ...extra.map(x => ({ part: x.b.part, name: x.b.name, mat: x.b.mat, spec: x.b.spec, qty: x.row.order_qty, price: x.row.unit_price, amt: x.row.quote_price, rdate: x.row.required_date || '', image_url: x.b.image || '' }))];
    await after(`${b.part} ${b.name || ''} → ${vendor} 발주 ${qty}개 등록 (${_won(amt)}원, 입고요구 ${_v('oxRdate') || '-'})`
      + (extra.length ? ` · 함께 발주 ${extra.length}개: ${extra.map(x => `${x.b.part} ${x.row.order_qty}개 ${_won(x.row.quote_price)}원`).join(', ')}` : ''));
    offerMail({ category: CFG.category, vendor, job: job.job, item: job.item || '', lines: mailLines, by: OWNER });
  } catch (e) {
    say('발주 실패: ' + String(e.message || e).slice(0, 120));
    if (btn) { btn.disabled = false; btn.textContent = '▣ 즉시 발주'; }
  }
}

/* v170: 발주서 보기 — 같은 제번·업체·발주일 묶음 (mes_mail.js) */
function sheetOf(l) { const { b, job } = CTX || {}; if (!window.MESMAIL) return say('발주서 모듈(mes_mail.js)이 없습니다.');
  MESMAIL.sheetFor({ category: CFG.category, job: job.job, item: job.item || '', part: (b && b.part) || l.part_no || '', vendor: l.vendor_name || '', order_date: l.order_date || '', line_id: l.line_id, by: OWNER }); }
const sheetBtn = l => ({ t: '🧾 발주서', title: '이 발주건이 포함된 발주서(A4)를 새 창에 엽니다 — 인쇄·PDF 저장', fn: () => sheetOf(l) });
/* ── ② 입고 ────────────────────────────────────────────────── */
const bN = () => ((CTX && CTX.batchIn) || []).reduce((n, x) => n + x.lines.length, 0);
const cN = () => ((CTX && CTX.batchCfm) || []).reduce((n, x) => n + x.lines.length, 0);
function formReceive(ev, l) {
  const { b } = CTX; CTX.line = l;
  const ord = Number(l.order_qty) || 0, got = Number(l.receipt_qty) || 0;
  const rem = Math.max(ord - got, 0) || ord;
  open(ev, `${b.part} — 입고`, 'k-in', headHtml() + `
   <div class="info" style="margin-bottom:8px">
    <b>협력업체</b><span>${_esc(l.vendor_name || '')}</span>
    <b>발주일</b><span>${_esc(_dt(l.order_date))}</span>
    <b>입고요구일</b><span>${_esc(_dt(l.required_date))}</span>
    <b>발주수량</b><span>${ord}${got ? ` (기입고 ${got})` : ''}</span>
    <b>발주금액</b><span>${_won(l.quote_price)}원</span></div>
   <div class="g">
    <label>입고수량</label><input id="oxInQty" class="r" value="${rem}" inputmode="numeric">
    <label>입고일</label><input id="oxInDate" type="date" value="${T0()}">
    <label>입고단가</label><input id="oxInPrice" class="r" value="${_w0(l.unit_price)}" placeholder="예: 45,000" inputmode="numeric">
    ${CFG.useWeight
      ? '<label>중량(kg)</label><span class="wtbox">' +
        '<input id="oxInWt" class="r" inputmode="decimal" title="발주 중량을 입고수량에 맞춰 환산합니다. 실측 중량이 다르면 직접 고쳐 넣으세요.">' +
        '<button type="button" id="oxInWtAuto" title="자동환산 값으로 되돌립니다">자동</button></span>'
      : '<label></label><span></span>'}
    <label>입고금액</label><input id="oxInAmt" class="r" readonly>
    <label>비고</label><input id="oxInRemark" class="full" placeholder="선택" value="${_esc(cleanCycleRemark(l.remark))}">
    <label title="[입고+확정]일 때만 쓰입니다">네고율(%)</label><input id="oxInRate" class="r" placeholder="예: 5" inputmode="decimal" title="[입고+확정]일 때 적용 — 입고금액(매입가)에서 깎는 비율. 함께 입고하는 품번에도 같은 비율">
    <label title="[입고+확정]일 때만 쓰입니다">확정가</label><input id="oxInFix" class="r" placeholder="예: 42,750" inputmode="numeric" title="[입고+확정]일 때 제조원가에 반영되는 금액">
   </div>
   ${(() => { const bt = batchFor('발주'); const ok = bt.filter(x => x.lines.length), skip = bt.filter(x => !x.lines.length).map(x => x.b.part);
      const ex = (CTX.extraLines || []).filter(x => x && x.status === '발주'); if (ex.length) ok.unshift({ b, lines: ex });
      CTX.batchIn = ok; return batchNote(ok.reduce((n, x) => n + x.lines.length, 0), '입고 (수량은 각 발주 잔량 · 단가는 각 발주단가 · 입고일은 이 창의 날짜)', skip); })()}
   <div class="note"><b>입고 처리</b>는 「입고」까지만, <b>입고+확정</b>은 위의 <b>확정가</b>(네고율)로 입고확정까지 한 번에 끝냅니다. 함께 입고하는 품번은 같은 네고율을 각 입고금액에 적용합니다. 확정가는 나중에 다시 우클릭해 고칠 수 있습니다.</div>
   ${CFG.useWeight ? '<div class="note">중량(kg)은 발주 중량을 입고수량만큼 환산해 채웁니다. <b>실측 중량으로 직접 고칠 수 있고</b>, 고친 값이 입고금액(단가×중량)에 쓰입니다.</div>' : ''}`,
   [{ t: '▣ 입고 처리' + (bN() ? ` (+${bN()}건)` : ''), cls: 'go k-in', id: 'oxGo', fn: () => doReceive(false) },
    { t: '▣ 입고+확정' + (bN() ? ` (+${bN()}건)` : ''), cls: 'go', id: 'oxGo2', title: '입고 처리와 입고확정(위의 확정가·네고율)을 한 번에 끝냅니다', fn: () => doReceive(true) },
    { t: '＋ 추가 발주', cls: 'go k-order', title: '같은 품번을 다른 업체에 나눠 발주하거나 재발주합니다', fn: e => formOrder(e) },
    /* v196: 신규발주 버튼 제거 — 추가발주로 대신한다 (차수 집계 코드는 그대로) */
    { t: '✖ 발주취소' + (bN() ? ` (+${bN()}건)` : ''), cls: 'warn', title: bN() ? '이 발주건과 체크한 품번의 발주건을 함께 삭제합니다' : '이 발주 라인을 삭제합니다', fn: doOrderCancel },
    sheetBtn(l), { t: '닫기', fn: close }]);
  /* v158: 입고 중량 — 발주 중량(order_weight)을 입고수량에 맞춰 환산, 없으면 설계치수로 자동계산.
           수동 입력한 값은 수량을 바꿔도 덮어쓰지 않는다 ([자동]으로 해제) */
  const inKg = q => {
    const ow = Number(l.order_weight) || 0;
    if (ow && ord) return ow / ord * q;
    return autoKg(CTX.b.spec, q);
  };
  const wi = $('oxInWt');
  const f = () => {
    const q = _n(_v('oxInQty')), p = _n(_v('oxInPrice'));
    let w = 0;
    if (CFG.useWeight) {
      if (wi && wi.dataset.manual === '1') { w = _n(wi.value); wi.classList.add('manual'); }
      else { w = inKg(q); if (wi) { wi.value = w ? w.toFixed(2) : ''; wi.classList.remove('manual'); } }
    }
    $('oxInPrice').value = p ? _won(p) : '';
    const amt = Math.round(p * (w || q || 0));
    $('oxInAmt').value = _w0(amt);
    /* v201: 확정가 = 입고금액 × (1 − 네고율). 확정가를 손으로 고치면 네고율이 따라온다 */
    const fx = $('oxInFix'), rt = $('oxInRate');
    if (fx && rt && fx.dataset.manual !== '1') fx.value = _w0(Math.round(amt * (1 - _n(rt.value) / 100)));
  };
  { const fx = $('oxInFix'), rt = $('oxInRate');
    if (rt) rt.onchange = () => { if (fx) fx.dataset.manual = ''; f(); };
    if (fx) fx.onchange = () => { const amt = _n(_v('oxInAmt')); fx.dataset.manual = '1'; fx.value = _w0(fx.value); if (rt) { const r0 = amt ? (1 - _n(fx.value) / amt) * 100 : 0; rt.value = r0 ? r0.toFixed(1) : ''; } }; }
  if (wi) {
    wi.oninput  = () => { wi.dataset.manual = '1'; wi.classList.add('manual'); };
    wi.onchange = () => { wi.dataset.manual = '1'; const v = _n(wi.value); wi.value = v ? v.toFixed(2) : ''; f(); };
    const ab = $('oxInWtAuto');
    if (ab) ab.onclick = () => { wi.dataset.manual = ''; f(); wi.focus(); };
  }
  $('oxInQty').onchange = f; $('oxInPrice').onchange = f; f();
  return false;
}

async function doReceive(withConfirm) {
  const { b, line: l } = CTX;
  if (!l || !l.line_id) return say('발주 라인을 찾을 수 없습니다. 다시 조회하세요.');
  if (!_online()) return say('DB 미연결 - 입고 처리를 할 수 없습니다.');
  const q = _n(_v('oxInQty'));
  if (!(q > 0)) return say('입고수량을 입력하세요.');
  const ord = Number(l.order_qty) || 0;
  if (ord && q > ord && !confirm(`발주수량 ${ord} 보다 많습니다. 그래도 입고 처리할까요?`)) return;
  const price = _n(_v('oxInPrice')), amt = _n(_v('oxInAmt'));
  const btn = $(withConfirm ? 'oxGo2' : 'oxGo'), b0 = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = '처리 중…'; }
  try {
    const row = {
      line_id: Number(l.line_id), status: '입고',
      receipt_qty: q, receipt_date: _v('oxInDate') || T0(),
      receipt_weight: (CFG.useWeight ? _n(_v('oxInWt')) : 0) || null,
      unit_price: price || null, receipt_amount: amt || null,
      remark: withCycleRemark((_v('oxInRemark') || '').trim(), cycleOf(l) || cycleIdFor(b.part)),
      updated_at: new Date().toISOString()
    };
    /* v201: 입고+확정 — 입고 창의 확정가/네고율로 확정 (함께 입고 품번은 같은 네고율을 각 입고금액에) */
    const rate = withConfirm ? _n(_v('oxInRate')) : 0;
    const fixMain = withConfirm ? (_n(_v('oxInFix')) || Math.round((amt || _n(l.quote_price)) * (1 - rate / 100))) : 0;
    if (withConfirm) { row.status = '입고확정'; row.confirm_date = row.receipt_date; row.confirm_price = fixMain || null; row.nego_rate = rate; }
    /* v169: 체크한 품번의 발주 라인도 같은 날짜로 입고 — 수량은 각 잔량, 단가·중량은 각 발주값 */
    const rows = [row], done = [];
    for (const x of (CTX.batchIn || [])) for (const el of x.lines) {
      if (Number(el.line_id) === Number(l.line_id)) continue;
      const eo = Number(el.order_qty) || 0, eg = Number(el.receipt_qty) || 0, eq = Math.max(eo - eg, 0) || eo || 1;
      const ep = _n(el.unit_price), ow = Number(el.order_weight) || 0;
      const ew = CFG.useWeight ? Math.round(((ow && eo) ? ow / eo * eq : autoKg(x.b.spec, eq)) * 100) / 100 : 0;
      const ea = Math.round(ep * (ew || eq));
      const r2 = { line_id: Number(el.line_id), status: '입고', receipt_qty: eq, receipt_date: row.receipt_date,
        receipt_weight: ew || null, unit_price: ep || null, receipt_amount: ea || null, updated_at: row.updated_at };
      if (withConfirm) { r2.status = '입고확정'; r2.confirm_date = row.receipt_date; r2.confirm_price = Math.round((ea || _n(el.quote_price)) * (1 - rate / 100)) || null; r2.nego_rate = rate; }
      rows.push(r2); done.push(`${x.b.part} ${eq}개`);
    }
    await MESDB.table('order_lines').upsert(rows, 'line_id');
    const more = done.length ? ` · 함께 ${withConfirm ? '입고확정' : '입고'} ${done.length}건: ${done.join(', ')}` : '';
    await after(withConfirm
      ? `${b.part} ${l.vendor_name || ''} 입고 ${q}개 + 입고확정 (확정가 ${_won(row.confirm_price)}원, 네고 ${rate}%) — 제조원가에 반영됩니다.` + more
      : `${b.part} ${l.vendor_name || ''} 입고 ${q}개 처리 — 입고확정(네고·확정가)은 다시 우클릭하세요.` + more);
  } catch (e) {
    say('입고 실패: ' + String(e.message || e).slice(0, 120));
    if (btn) { btn.disabled = false; btn.textContent = b0; }
  }
}

async function doOrderCancel() {
  const { b, line: l } = CTX;
  if (!l || !l.line_id) return say('발주 라인을 찾을 수 없습니다.');
  if (!_online()) return say('DB 미연결 - 발주취소를 할 수 없습니다.');
  /* v312: 체크한 품번의 발주건(입고 처리와 같은 묶음)도 함께 취소 — 종전엔 우클릭한 1건만 지워졌다 */
  const extra = [];
  for (const x of (CTX.batchIn || [])) for (const el of (x.lines || []))
    if (el && el.line_id && el.status === '발주' && Number(el.line_id) !== Number(l.line_id)) extra.push({ part: x.b.part, l: el });
  const ids = [Number(l.line_id), ...extra.map(x => Number(x.l.line_id))];
  const msgTxt = `${b.part} · ${l.vendor_name || ''} 발주 ${Number(l.order_qty) || 0}개` +
    (extra.length ? ` 외 ${extra.length}건을 취소(삭제)합니다.\n\n` + extra.map(x => ` · ${x.part} ${x.l.vendor_name || ''} ${Number(x.l.order_qty) || 0}개 ${_dt(x.l.order_date)}`).join('\n') + '\n\n'
                 : `를 취소(삭제)합니다.\n`) + '되돌릴 수 없습니다. 계속할까요?';
  if (!confirm(msgTxt)) return;
  try {
    await MESDB.delLines(ids);
    await after(`${b.part} ${l.vendor_name || ''} 발주${extra.length ? ` 외 ${extra.length}건` : ''}을 취소(삭제)했습니다.`);
  } catch (e) { say('발주취소 실패: ' + String(e.message || e).slice(0, 120)); }
}

/* ── ③ 입고확정 ────────────────────────────────────────────── */
function formConfirm(ev, l) {
  const { b } = CTX; CTX.line = l;
  const quote = _n(l.receipt_amount) || _n(l.quote_price);
  const fix = _n(l.confirm_price) || quote;
  open(ev, `${b.part} — 입고확정`, 'k-cfm', headHtml() + `
   <div class="info" style="margin-bottom:8px">
    <b>협력업체</b><span>${_esc(l.vendor_name || '')}</span>
    <b>입고일</b><span>${_esc(_dt(l.receipt_date))}</span>
    <b>입고수량</b><span>${Number(l.receipt_qty) || Number(l.order_qty) || 0}</span></div>
   <div class="g">
    <label>확정일</label><input id="oxCdate" type="date" value="${T0()}">
    <label>매입가</label><input id="oxQuote" class="r" value="${_won(quote)}" readonly>
    <label>네고율(%)</label><input id="oxRate" class="r" value="${quote ? ((1 - fix / quote) * 100).toFixed(1) : '0'}" inputmode="decimal">
    <label>확정가</label><input id="oxFix" class="r" value="${_won(fix)}" inputmode="numeric">
   </div>
   ${(() => { const bt = batchFor('입고'); const ok = bt.filter(x => x.lines.length), skip = bt.filter(x => !x.lines.length).map(x => x.b.part);
      CTX.batchCfm = ok; return batchNote(ok.reduce((n, x) => n + x.lines.length, 0), '입고확정 (이 창의 확정일·네고율을 각 매입가에 적용)', skip); })()}
   <div class="note">확정가가 제조원가(${CFG.category}비)에 반영됩니다. 네고율을 넣으면 확정가가, 확정가를 고치면 네고율이 맞춰집니다.</div>`,
   [{ t: '▣ 입고확정' + (cN() ? ` (+${cN()}건)` : ''), cls: 'go', id: 'oxGo', fn: doConfirm },
    { t: '＋ 추가 발주', cls: 'go k-order', title: '같은 품번을 다른 업체에 나눠 발주하거나 재발주합니다', fn: e => formOrder(e) },
    /* v196: 신규발주 버튼 제거 — 추가발주로 대신한다 (차수 집계 코드는 그대로) */
    { t: '✖ 입고취소', cls: 'warn', title: '입고를 취소하고 발주 상태로 되돌립니다', fn: doReceiveCancel },
    sheetBtn(l), { t: '닫기', fn: close }]);
  $('oxRate').onchange = () => { const q = _n(_v('oxQuote')); $('oxFix').value = _won(Math.round(q * (1 - _n(_v('oxRate')) / 100))); };
  $('oxFix').onchange  = () => { const q = _n(_v('oxQuote')); $('oxRate').value = q ? ((1 - _n(_v('oxFix')) / q) * 100).toFixed(1) : '0'; };
  return false;
}

async function doConfirm() {
  const { b, line: l } = CTX;
  if (!l || !l.line_id) return say('발주 라인을 찾을 수 없습니다.');
  if (!_online()) return say('DB 미연결 - 입고확정을 할 수 없습니다.');
  const quote = _n(_v('oxQuote')), fix = _n(_v('oxFix'));
  const btn = $('oxGo'); if (btn) { btn.disabled = true; btn.textContent = '처리 중…'; }
  try {
    const rate = quote ? Number(((1 - fix / quote) * 100).toFixed(2)) : 0, cd = _v('oxCdate') || T0(), ts = new Date().toISOString();
    const rows = [{ line_id: Number(l.line_id), status: '입고확정', confirm_date: cd, confirm_price: fix || null, nego_rate: quote ? rate : null, updated_at: ts }];
    /* v169: 체크한 품번의 입고 라인도 같은 확정일·네고율로 확정 */
    const done = [];
    for (const x of (CTX.batchCfm || [])) for (const el of x.lines) {
      if (Number(el.line_id) === Number(l.line_id)) continue;
      const eqt = _n(el.receipt_amount) || _n(el.quote_price), efix = Math.round(eqt * (1 - rate / 100));
      rows.push({ line_id: Number(el.line_id), status: '입고확정', confirm_date: cd, confirm_price: efix || null, nego_rate: eqt ? rate : null, updated_at: ts });
      done.push(`${x.b.part} ${_won(efix)}원`);
    }
    await MESDB.table('order_lines').upsert(rows, 'line_id');
    await after(`${b.part} ${l.vendor_name || ''} 입고확정 (확정가 ${_won(fix)}원) — 제조원가에 반영됩니다.`
      + (done.length ? ` · 함께 확정 ${done.length}건: ${done.join(', ')}` : ''));
  } catch (e) {
    say('입고확정 실패: ' + String(e.message || e).slice(0, 120));
    if (btn) { btn.disabled = false; btn.textContent = '▣ 입고확정'; }
  }
}

async function doReceiveCancel() {
  const { b, line: l } = CTX;
  if (!l || !l.line_id) return say('발주 라인을 찾을 수 없습니다.');
  if (!_online()) return say('DB 미연결 - 입고취소를 할 수 없습니다.');
  if (!confirm(`${b.part} · ${l.vendor_name || ''} 의 입고를 취소합니다.\n발주 상태로 돌아가며 입고수량·입고일이 지워집니다. 계속할까요?`)) return;
  try {
    await MESDB.table('order_lines').upsert([{
      line_id: Number(l.line_id), status: '발주',
      receipt_qty: 0, receipt_date: null, receipt_amount: null, receipt_weight: null,
      updated_at: new Date().toISOString()
    }], 'line_id');
    await after(`${b.part} 입고를 취소했습니다. (발주 상태로 복귀)`);
  } catch (e) { say('입고취소 실패: ' + String(e.message || e).slice(0, 120)); }
}

/* ── ④ 완료 내역 ───────────────────────────────────────────── */
function formDone(ev, l) {
  const { b } = CTX; CTX.line = l;
  open(ev, `${b.part} — 입고확정 완료`, '', headHtml() + `
   <div class="info">
    <b>협력업체</b><span>${_esc(l.vendor_name || '')}</span>
    <b>발주일</b><span>${_esc(_dt(l.order_date))}</span>
    <b>입고일</b><span>${_esc(_dt(l.receipt_date))}</span>
    <b>확정일</b><span>${_esc(_dt(l.confirm_date))}</span>
    <b>발주수량</b><span>${Number(l.order_qty) || 0}</span>
    ${CFG.useWeight ? `<b>중량(kg)</b><span>발주 ${Number(l.order_weight) || 0} / 입고 ${Number(l.receipt_weight) || 0}</span>` : ''}
    <b>입고수량</b><span>${Number(l.receipt_qty) || 0}</span>
    <b>매입가</b><span>${_won(l.receipt_amount || l.quote_price)}원</span>
    <b>네고율</b><span>${Number(l.nego_rate) || 0}%</span>
    <b>확정가</b><span>${_won(l.confirm_price)}원</span></div>
   <div class="note">확정취소를 하면 「입고」 상태로 돌아가 확정가를 다시 잡을 수 있습니다.</div>`,
   [{ t: '＋ 추가 발주', cls: 'go k-order', title: '같은 품번을 다른 업체에 나눠 발주하거나 재발주합니다', fn: e => formOrder(e) },
    /* v196: 신규발주 버튼 제거 — 추가발주로 대신한다 (차수 집계 코드는 그대로) */
    { t: '✖ 확정취소', cls: 'warn', fn: doConfirmCancel },
    sheetBtn(l), { t: '닫기', fn: close }]);
  return false;
}

async function doConfirmCancel() {
  const { b, line: l } = CTX;
  if (!l || !l.line_id) return say('발주 라인을 찾을 수 없습니다.');
  if (!_online()) return say('DB 미연결 - 확정취소를 할 수 없습니다.');
  if (!confirm(`${b.part} · ${l.vendor_name || ''} 의 입고확정을 취소합니다.\n확정일·확정가가 지워지고 「입고」 상태로 돌아갑니다. 계속할까요?`)) return;
  try {
    await MESDB.table('order_lines').upsert([{
      line_id: Number(l.line_id), status: '입고',
      confirm_date: null, confirm_price: null, nego_rate: null,
      updated_at: new Date().toISOString()
    }], 'line_id');
    await after(`${b.part} 입고확정을 취소했습니다. (입고 상태로 복귀)`);
  } catch (e) { say('확정취소 실패: ' + String(e.message || e).slice(0, 120)); }
}

/* v170: 발주 직후 발주서 메일 창 (mes_mail.js 가 있을 때). 그림이 없으면 PartList 에서 다시 찾는다 */
async function offerMail(o) {
  if (!window.MESMAIL) return;
  try { if (o.lines.some(l => !l.image_url) && MESDB.partImages) { const m = await MESDB.partImages(o.job); o.lines.forEach(l => { if (!l.image_url && m[l.part]) l.image_url = m[l.part]; }); } } catch (e) {}
  setTimeout(() => { try { MESMAIL.order(o); } catch (e) {} }, 350);
}
/* ── 처리 후 공통 : 캐시 비우고 다시 그린다 ────────────────── */
async function after(text) {
  try { MESDB.dropCache && MESDB.dropCache('order_lines'); } catch (e) {}
  try { MESDB.notify && MESDB.notify(['order_lines']); } catch (e) {}
  close();
  await refresh();
  say(text); pop(text);
}
async function refresh() {
  const j = curJob(); if (!j) return;
  await loadLines(j.job);
  try { if (typeof window.loadOrdQ === 'function') await window.loadOrdQ(j.job); } catch (e) {}
  try { window.renderBom(); } catch (e) {}
}

/* ── 자재표 리스트에 「진행」 칸 붙이기 ────────────────────── */
function decorate() {
  const j = curJob(); if (!j || !j.bom) return;
  const tb = $('bomBody'); if (!tb) return;
  const ready = (LINES_JOB === j.job);
  tb.querySelectorAll('input[type=checkbox][data-i]').forEach(cb => {
    const i = Number(cb.dataset.i), b = j.bom[i]; if (!b) return;
    const tr = cb.closest('tr'); if (!tr) return;
    tr.dataset.oxPart = b.part; tr.dataset.oxCyc = bCyc(b);   /* v311: 줄의 품번·차수 (rowIdx 용) */
    let td = tr.querySelector('td.ox');
    if (!td) { td = document.createElement('td'); td.className = 'ox'; tr.insertBefore(td, tr.cells[tr.cells.length - 1]); }
    if (!ready) { td.className = 'ox'; td.textContent = '…'; td.title = '발주 내역을 불러오는 중'; return; }
    const s = partState(b), a = linesOf(b);
    td.className = 'ox ' + s.cls;
    td.innerHTML = _esc(s.label) + (a.length > 1 ? `<span class="st">${a.length}건</span>` : '');
    tr.classList.toggle('cycold', isOldCycle(b));                       /* v226: 이전 차수 줄 */
    tr.dataset.done = ((a.length && s.code === '입고확정') || (window.MESCYCLE && MESCYCLE.isEnded(b.part, bCyc(b)))) ? '1' : '';    /* v226: 최종완료(전량 입고확정) */
    try { if (typeof window.applyDoneFilter === 'function') window.applyDoneFilter(tr); } catch (e) {}
    td.title = (s.code === ''
      ? '우클릭 → 발주 (업체·수량·단가를 넣고 즉시 등록)'
      : `${a.length}건 · ` + a.map(l => `${l.vendor_name || ''} ${Number(l.order_qty) || 0}개 ${l.status}`).join(' / ')) +
      '\n우클릭(또는 더블클릭) → 발주 · 입고 · 입고확정 · 취소';
    tr.oncontextmenu = ev => openPart(ev, rowIdx(tr, i));
    tr.ondblclick    = ev => openPart(ev, rowIdx(tr, i));
    /* 모바일 : 길게 누르기 */
    let tm = null;
    tr.ontouchstart = ev => { tm = setTimeout(() => openPart({ preventDefault(){}, stopPropagation(){}, clientX: ev.touches[0].clientX, clientY: ev.touches[0].clientY }, rowIdx(tr, i)), 500); };
    tr.ontouchend = tr.ontouchmove = () => { clearTimeout(tm); };
  });
}

/* ── 화면 연결 ─────────────────────────────────────────────── */
function init(opt) {
  CFG = Object.assign(CFG, opt || {});
  ensureUI();

  /* renderBom 뒤에 진행칸을 붙인다 (기존 발주수량 칸 처리 뒤에 온다) */
  const _rb = window.renderBom;
  if (typeof _rb === 'function') window.renderBom = function () { const r = _rb.apply(this, arguments); try { decorate(); } catch (e) {} return r; };

  /* 제번을 바꿔 자재표를 다시 읽으면 발주 내역도 다시 읽는다 */
  const _lb = window.loadBom;
  if (typeof _lb === 'function') window.loadBom = async function () {
    const r = await _lb.apply(this, arguments);
    const j = curJob(); if (j) { await loadLines(j.job); try { window.renderBom(); } catch (e) {} }
    return r;
  };

  /* 다른 화면(입고등록·입고확정 등)에서 바뀌면 자동 반영 */
  const bind = () => {
    if (window.MESDB && MESDB.onChange) { MESDB.onChange(['order_lines'], () => { refresh(); }); return true; }
    return false;
  };
  if (!bind()) { let n = 0; const iv = setInterval(() => { if (bind() || ++n > 40) clearInterval(iv); }, 150); }

  /* 공용 삭제확인창(mes_ctx.js)이 이 팝업의 취소 버튼까지 한 번 더 붙잡지 않게 한다.
     ─ 이 창은 품번·업체·수량이 들어간 자체 확인문을 띄우므로 그쪽이 더 친절하다. */
  try {
    const opt = window.MES_CTX_OPT || {};
    const mine = /^\s*✖?\s*(발주취소|입고취소|확정취소)(\s*\(.*\))?\s*$/;
    const prev = opt.noGuard;
    opt.noGuard = prev ? { test: s => prev.test(s) || mine.test(String(s)) } : mine;
    window.MES_CTX_OPT = opt;
  } catch (e) {}

  /* 안내 뱃지 */
  try {
    const bar = document.querySelector('.filters');
    if (bar && !bar.querySelector('.oxhint')) {
      const s = document.createElement('span');
      s.className = 'oxhint';
      s.title = '자재표 리스트에서 마우스 오른쪽 버튼(또는 더블클릭)을 누르면 상태에 맞는 처리 창이 열립니다';
      s.innerHTML = '※ 자재표 <b>우클릭</b> → 발주 · 입고 · 입고확정 · 취소 · 추가발주 &nbsp;<b>☑ 체크</b>한 품번은 함께 처리';
      bar.appendChild(s);
    }
    /* 옛 배치(협력업체리스트·구매요청 리스트·PRINT 발주서) 토글
       v310: 선택을 브라우저에 기억하지 않는다 — PC 마다 배치가 달라지던 원인. 화면을 열면 항상 새 배치로 시작하고,
       버튼은 그 자리에서 잠깐 옛 배치를 볼 때만 쓴다. 예전에 기억해 둔 값은 지운다. */
    if (bar && !$('oxToggle')) {
      const key = 'ox_classic_' + CFG.category;
      try { Object.keys(localStorage).filter(k => k.startsWith('ox_classic_')).forEach(k => localStorage.removeItem(k)); } catch (e) {}
      const apply = on => {
        document.body.classList.toggle('ox-classic', !!on);
        const b = $('oxToggle'); if (b) b.textContent = on ? '▤ 요청 리스트 닫기' : '▤ 요청 리스트 · 발주서';
      };
      const b = document.createElement('button');
      b.type = 'button'; b.id = 'oxToggle';
      b.title = '여러 품번을 한 번에 발주하거나 발주서(PRINT)를 뽑을 때 — 협력업체리스트·구매요청 리스트를 다시 보입니다';
      b.onclick = () => apply(!document.body.classList.contains('ox-classic'));
      bar.appendChild(b);
      apply(false);
    }
  } catch (e) {}

  /* 첫 로드 */
  setTimeout(refresh, 400);
  setTimeout(refresh, 1500);
}

window.MESORDCTX = { init, refresh, loadLines, partState, close, startNewCycle, activeCycleRows, cycleIdFor, withCycleRemark, newCycleId, rowIdx };
})();
