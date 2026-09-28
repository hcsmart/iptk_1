/* mes_stctx.js — v263
 * 원재료·구매품 「발주/입고현황」 행 우클릭 처리 (입고 · 입고+확정 · 입고확정 · 입고취소 · 확정취소 · 발주취소)
 * 발주 화면(mes_ordctx.js)과 같은 order_lines 컬럼을 쓴다.
 *   <script>MESSTCTX.init({category:'원재료'});</script>
 * init({category, rows:()=>view, chk:()=>CHK, st:ST}) — 화면의 let/const 전역은 window 에 없으므로 함수로 넘긴다.
 * 화면 쪽 function 전역: msg(), sel(), itemLoad(), loadVendorSel(), _filterNow()
 */
(function () {
if (window.MESSTCTX) return;
const $ = id => document.getElementById(id);
const T0 = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const _n = v => Number(String(v == null ? '' : v).replace(/[^\d.\-]/g, '')) || 0;
const _won = v => (Math.round(Number(v) || 0)).toLocaleString('ko-KR');
const _esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const _dt = v => v ? String(v).slice(0, 10) : '';
const _online = () => !!(window.MESDB && MESDB.online);
const say = t => { try { if (typeof window.msg === 'function') window.msg(t); } catch (e) {} };
const stOf = r => typeof CFG.st === 'function' ? CFG.st(r.st) : (r.st === '대기' ? '발주' : r.st === '확정' ? '입고확정' : (r.st || ''));
const VIEW = () => { try { return (typeof CFG.rows === 'function' ? CFG.rows() : window.view) || []; } catch (e) { return []; } };
const CHKS = () => { try { return typeof CFG.chk === 'function' ? CFG.chk() : window.CHK; } catch (e) { return null; } };
const buy = r => { const q = Number(r.got) || Number(r.qty) || 0, u = Number(r.price) || 0; return u > 0 && q > 0 ? Math.round(q * u) : (Number(r.ramt) || Number(r.quote) || 0); };
let CFG = { category: '' }, CTX = null;

/* ── 팝업 UI ─────────────────────────────────────────────── */
const CSS = `
#sxMask{position:fixed;inset:0;z-index:9000;display:none}#sxMask.on{display:block}
#sxPop{position:fixed;z-index:9001;width:440px;max-width:96vw;max-height:92vh;overflow:auto;background:#fff;border:1px solid #6f8090;
 box-shadow:0 8px 26px rgba(0,0,0,.28);display:none;font:12px/1.5 "Malgun Gothic","맑은 고딕",Arial,sans-serif;color:#22303a}
#sxPop.on{display:block}
#sxPop .ch{display:flex;align-items:center;gap:8px;padding:0 8px 0 11px;height:31px;color:#fff;font-weight:700;background:linear-gradient(#5f7f9f,#3f5f7d);user-select:none}
#sxPop .ch.k-in{background:linear-gradient(#e08a2b,#b8681a)}#sxPop .ch.k-cfm{background:linear-gradient(#3f7fc4,#2a5d95)}#sxPop .ch.k-done{background:linear-gradient(#5a9a72,#3f7a56)}
#sxPop .ch .x{margin-left:auto;border:0;background:transparent;color:#fff;cursor:pointer;font:inherit;font-size:14px}
#sxPop .cb{padding:9px 11px 6px}
#sxPop .sub{color:#4d5c69;margin-bottom:7px;line-height:1.5}#sxPop .sub b{color:#20456b}
#sxPop .g{display:grid;grid-template-columns:78px minmax(0,1fr) 78px minmax(0,1fr);gap:5px 7px;align-items:center}
#sxPop .g label{font-weight:700;text-align:right;color:#4d5c69;white-space:nowrap}
#sxPop .g input{width:100%;min-width:0;height:25px;border:1px solid #b9c3cb;padding:0 5px;font:inherit;box-sizing:border-box;color:#22303a;background:#fff}
#sxPop .g input.r{text-align:right}#sxPop .g input[readonly]{background:#f3f6f8}
#sxPop .note{font-size:11px;color:#6d7b88;margin-top:6px;line-height:1.45}
#sxPop .batch{margin-top:7px;padding:5px 8px;background:#fff8e1;border:1px solid #e6d28a;border-radius:3px;color:#6b5a12}
#sxPop .info{display:grid;grid-template-columns:78px 1fr;gap:3px 8px}#sxPop .info b{color:#4d5c69;text-align:right}
#sxPop .cf{display:flex;gap:6px;justify-content:flex-end;padding:8px 11px 10px;border-top:1px solid #e3e9ed;background:#f7f9fa;flex-wrap:wrap}
#sxPop .cf .btn{height:27px;min-width:72px;border:1px solid #9ca9b5;background:linear-gradient(#fff,#dfe6eb);font:inherit;cursor:pointer}
#sxPop .cf .btn.go{font-weight:700;color:#fff;border-color:#2a5d95;background:linear-gradient(#4a8ad0,#2f6fb0)}
#sxPop .cf .btn.warn{color:#a13a3a;border-color:#c08a8a;background:linear-gradient(#fff,#f7e2e2)}
#sxPop .cf .btn:disabled{opacity:.6;cursor:default}
.sxhint{margin-left:10px;color:#4a6b88;background:#eaf3fb;border:1px solid #c3daed;border-radius:12px;padding:3px 10px;white-space:nowrap;font-weight:400}
.sxhint b{color:#1d5da3}
@media(max-width:600px){#sxPop .g{grid-template-columns:70px minmax(0,1fr)}}`;

function ensureUI() {
  if ($('sxPop')) return;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const mask = document.createElement('div'); mask.id = 'sxMask'; mask.onclick = close;
  const pop = document.createElement('div'); pop.id = 'sxPop';
  pop.innerHTML = `<div class="ch" id="sxHead"><span id="sxTitle"></span><button type="button" class="x" title="닫기">✕</button></div>
    <div class="cb" id="sxBody"></div><div class="cf" id="sxFoot"></div>`;
  pop.querySelector('.x').onclick = close;
  document.body.appendChild(mask); document.body.appendChild(pop);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}
function close() { const m = $('sxMask'), p = $('sxPop'); if (m) m.classList.remove('on'); if (p) p.classList.remove('on'); CTX = null; }
function open(ev, title, kind, bodyHtml, btns) {
  ensureUI();
  const p = $('sxPop');
  $('sxTitle').textContent = title; $('sxHead').className = 'ch ' + (kind || '');
  $('sxBody').innerHTML = bodyHtml;
  const f = $('sxFoot'); f.innerHTML = '';
  (btns || [{ t: '닫기', fn: close }]).forEach(b => {
    const el = document.createElement('button'); el.type = 'button'; el.className = 'btn ' + (b.cls || ''); el.textContent = b.t;
    if (b.id) el.id = b.id; if (b.title) el.title = b.title; el.onclick = b.fn; f.appendChild(el);
  });
  $('sxMask').classList.add('on'); p.classList.add('on');
  p.style.left = '0px'; p.style.top = '0px';
  const W = p.offsetWidth || 440, H = p.offsetHeight || 260;
  let x = (ev && ev.clientX != null ? ev.clientX : 40) + 6, y = (ev && ev.clientY != null ? ev.clientY : 40) + 6;
  if (x + W > window.innerWidth - 8) x = Math.max(8, window.innerWidth - W - 8);
  if (y + H > window.innerHeight - 8) y = Math.max(8, window.innerHeight - H - 8);
  p.style.left = x + 'px'; p.style.top = y + 'px';
  const first = p.querySelector('#sxBody input:not([readonly])'); if (first) setTimeout(() => first.focus(), 30);
  return false;
}

/* ── 공통 ────────────────────────────────────────────────── */
function headHtml(r) {
  return `<div class="sub"><b>${_esc(r.job || '')}</b> · ${_esc(r.part || '')} ${_esc(r.partName || '')}
   &nbsp;|&nbsp; ${_esc(r.vendor || '')} &nbsp;|&nbsp; 발주 ${Number(r.qty) || 0}개 · 단가 ${_won(r.price)}원 (${_esc(_dt(r.odate))})</div>`;
}
/* 체크한 행 중 같은 상태의 다른 행 — 함께 처리 */
function batchRows(r) {
  const chk = CHKS(), view = VIEW();
  if (!chk || !chk.size) return [];
  const st = stOf(r);
  return view.filter(x => x !== r && chk.has(Number(x.no)) && stOf(x) === st);
}
function batchNote(list, what) {
  if (!list.length) return '';
  const names = [...new Set(list.map(x => `${x.job} ${x.part || ''}`))].slice(0, 6).join(', ');
  return `<div class="batch"><label><input type="checkbox" id="sxBatch" checked> 체크한 같은 상태 <b>${list.length}건</b>도 함께 ${what}</label>
    <div style="font-size:11px;margin-top:2px">${_esc(names)}${list.length > 6 ? ' …' : ''}</div></div>`;
}
const useBatch = () => { const c = $('sxBatch'); return !!(c && c.checked); };
async function after(text, popTitle) {
  try { MESDB.dropCache && MESDB.dropCache('order_lines'); } catch (e) {}
  try { MESDB.notify && MESDB.notify(['order_lines']); } catch (e) {}
  close();
  try { if (MESDB.reloadLines) await MESDB.reloadLines(); } catch (e) {}
  try { typeof window.itemLoad === 'function' && window.itemLoad(); } catch (e) {}
  try { typeof window.loadVendorSel === 'function' && window.loadVendorSel(); } catch (e) {}
  try { typeof window._filterNow === 'function' ? window._filterNow() : (typeof window.search === 'function' && window.search()); } catch (e) {}
  say(text);
  try { (window.MESPOP || window.parent?.MESPOP)?.ok(text, popTitle || '처리 완료'); } catch (e) {}
}
function busy(id, on, label) { const b = $(id); if (!b) return; b.disabled = !!on; if (on) { b.dataset.t = b.textContent; b.textContent = '처리 중…'; } else b.textContent = label || b.dataset.t || b.textContent; }

/* ── ① 발주 → 입고 / 입고+확정 / 발주취소 ─────────────────── */
function formReceive(ev, r) {
  CTX = { r };
  const bt = batchRows(r);
  open(ev, `${r.part || ''} — 입고 처리`, 'k-in', headHtml(r) + `
   <div class="g">
    <label>입고일</label><input id="sxDate" type="date" value="${T0()}">
    <label>입고수량</label><input id="sxQty" class="r" value="${Number(r.qty) || 0}" inputmode="numeric">
    <label>단가</label><input id="sxPrice" class="r" value="${_won(r.price)}" inputmode="numeric">
    <label>매입가</label><input id="sxAmt" class="r" value="${_won(buy(r))}" readonly title="입고수량 × 단가">
    <label>네고율(%)</label><input id="sxRate" class="r" value="0" inputmode="decimal" title="입고+확정 때만 적용">
    <label>확정가</label><input id="sxFix" class="r" value="${_won(buy(r))}" inputmode="numeric" title="입고+확정 때만 적용">
   </div>
   ${batchNote(bt, '입고 (수량은 각 발주수량, 단가는 각 발주단가)')}
   <div class="note">[입고]는 입고 상태까지, [입고+확정]은 네고율·확정가까지 한 번에 처리해 제조원가에 반영합니다.</div>`,
   [{ t: '▣ 입고', cls: 'go', id: 'sxGo', fn: () => doReceive(false) },
    { t: '▣ 입고+확정', cls: 'go', id: 'sxGo2', fn: () => doReceive(true) },
    { t: '✖ 발주취소', cls: 'warn', title: '발주 라인을 삭제합니다', fn: doOrderCancel },
    { t: '닫기', fn: close }]);
  CTX.batch = bt;
  const f = () => { const a = Math.round(_n($('sxQty').value) * _n($('sxPrice').value)); $('sxAmt').value = _won(a); $('sxPrice').value = _won(_n($('sxPrice').value)); $('sxFix').value = _won(Math.round(a * (1 - _n($('sxRate').value) / 100))); };
  $('sxQty').onchange = f; $('sxPrice').onchange = f;
  $('sxRate').onchange = () => { $('sxFix').value = _won(Math.round(_n($('sxAmt').value) * (1 - _n($('sxRate').value) / 100))); };
  $('sxFix').onchange = () => { const a = _n($('sxAmt').value); $('sxFix').value = _won(_n($('sxFix').value)); $('sxRate').value = a ? ((1 - _n($('sxFix').value) / a) * 100).toFixed(1) : '0'; };
  return false;
}
async function doReceive(withConfirm) {
  const r = CTX && CTX.r; if (!r) return;
  if (!_online()) return say('DB 미연결 - 입고 처리를 할 수 없습니다.');
  const q = _n($('sxQty').value); if (!(q > 0)) return say('입고수량을 입력하세요.');
  const ord = Number(r.qty) || 0;
  if (ord && q > ord && !confirm(`발주수량 ${ord} 보다 많습니다. 그래도 입고 처리할까요?`)) return;
  const price = _n($('sxPrice').value), amt = Math.round(q * price), date = $('sxDate').value || T0(), ts = new Date().toISOString();
  const rate = withConfirm ? _n($('sxRate').value) : 0;
  const fix = withConfirm ? (_n($('sxFix').value) || Math.round((amt || _n(r.quote)) * (1 - rate / 100))) : 0;
  const id = withConfirm ? 'sxGo2' : 'sxGo'; busy(id, true);
  try {
    const row = { line_id: Number(r.no), status: '입고', receipt_qty: q, receipt_date: date, receipt_weight: null,
      unit_price: price || null, receipt_amount: amt || null, updated_at: ts };
    if (withConfirm) { row.status = '입고확정'; row.confirm_date = date; row.confirm_price = fix || null; row.nego_rate = rate; }
    const rows = [row], done = [];
    if (useBatch()) for (const x of (CTX.batch || [])) {
      const eq = Number(x.qty) || 1, ep = Number(x.price) || 0, ea = Math.round(eq * ep) || _n(x.quote) || 0;
      const r2 = { line_id: Number(x.no), status: '입고', receipt_qty: eq, receipt_date: date, receipt_weight: null,
        unit_price: ep || null, receipt_amount: ea || null, updated_at: ts };
      if (withConfirm) { r2.status = '입고확정'; r2.confirm_date = date; r2.confirm_price = Math.round(ea * (1 - rate / 100)) || null; r2.nego_rate = rate; }
      rows.push(r2); done.push(`${x.part || ''} ${eq}개`);
    }
    await MESDB.table('order_lines').upsert(rows, 'line_id');
    for (const x of rows) { try { const c = CHKS(); c && c.delete(Number(x.line_id)); } catch (e) {} }
    const more = done.length ? ` · 함께 ${done.length}건: ${done.join(', ')}` : '';
    await after(withConfirm
      ? `${r.part || ''} ${r.vendor || ''} 입고 ${q}개 + 입고확정 (확정가 ${_won(fix)}원, 네고 ${rate}%)` + more
      : `${r.part || ''} ${r.vendor || ''} 입고 ${q}개 처리 — 입고확정은 다시 우클릭하세요.` + more, withConfirm ? '입고+확정 완료' : '입고 완료');
  } catch (e) { say('입고 실패: ' + String(e.message || e).slice(0, 120)); busy(id, false); }
}
async function doOrderCancel() {
  const r = CTX && CTX.r; if (!r) return;
  if (!_online()) return say('DB 미연결 - 발주취소를 할 수 없습니다.');
  const bt = useBatch() ? (CTX.batch || []) : [];
  const all = [r, ...bt];
  if (!confirm(`${CFG.category} 발주 ${all.length}건을 취소(삭제)합니다.\n\n · ${all.slice(0, 8).map(x => `${x.job} · ${x.vendor || ''} · ${x.part || ''} ${Number(x.qty) || 0}개`).join('\n · ')}${all.length > 8 ? '\n … 외 ' + (all.length - 8) + '건' : ''}\n\n되돌릴 수 없습니다. 계속할까요?`)) return;
  try {
    await MESDB.delLines(all.map(x => Number(x.no)));
    for (const x of all) { try { const c = CHKS(); c && c.delete(Number(x.no)); } catch (e) {} }
    await after(`발주 ${all.length}건을 취소(삭제)했습니다. ${CFG.category} 발주 화면에서 다시 발주할 수 있습니다.`, '발주취소');
  } catch (e) {
    const s = String(e.message || e);
    say('발주취소 실패: ' + (/foreign key|무결성|23503/i.test(s) ? '이 발주를 참조하는 입고 자료가 있습니다.' : s.slice(0, 120)));
  }
}

/* ── ② 입고 → 입고확정 / 입고취소 ─────────────────────────── */
function formConfirm(ev, r) {
  CTX = { r };
  const bt = batchRows(r);
  const quote = buy(r), fix = _n(r.fix) || quote;
  open(ev, `${r.part || ''} — 입고확정`, 'k-cfm', headHtml(r) + `
   <div class="g">
    <label>입고일</label><input value="${_esc(_dt(r.idate))}" readonly>
    <label>확정일</label><input id="sxCdate" type="date" value="${T0()}">
    <label>입고수량</label><input id="sxQty" class="r" value="${Number(r.got) || Number(r.qty) || 0}" inputmode="numeric">
    <label>단가</label><input id="sxPrice" class="r" value="${_won(r.price)}" inputmode="numeric">
    <label>매입가</label><input id="sxAmt" class="r" value="${_won(quote)}" readonly title="입고수량 × 단가">
    <label></label><span></span>
    <label>네고율(%)</label><input id="sxRate" class="r" value="${quote ? ((1 - fix / quote) * 100).toFixed(1) : '0'}" inputmode="decimal">
    <label>확정가</label><input id="sxFix" class="r" value="${_won(fix)}" inputmode="numeric">
   </div>
   ${batchNote(bt, '입고확정 (이 창의 확정일·네고율을 각 매입가에 적용)')}
   <div class="note">확정가가 제조원가(${_esc(CFG.category)}비)에 반영됩니다. 네고율을 넣으면 확정가가, 확정가를 고치면 네고율이 맞춰집니다.</div>`,
   [{ t: '▣ 입고확정', cls: 'go', id: 'sxGo', fn: doConfirm },
    { t: '✖ 입고취소', cls: 'warn', title: '입고를 취소하고 발주 상태로 되돌립니다', fn: doReceiveCancel },
    { t: '닫기', fn: close }]);
  CTX.batch = bt;
  const f = () => { const a = Math.round(_n($('sxQty').value) * _n($('sxPrice').value)); $('sxAmt').value = _won(a); $('sxPrice').value = _won(_n($('sxPrice').value)); $('sxFix').value = _won(Math.round(a * (1 - _n($('sxRate').value) / 100))); };
  $('sxQty').onchange = f; $('sxPrice').onchange = f;
  $('sxRate').onchange = () => { $('sxFix').value = _won(Math.round(_n($('sxAmt').value) * (1 - _n($('sxRate').value) / 100))); };
  $('sxFix').onchange = () => { const a = _n($('sxAmt').value); $('sxFix').value = _won(_n($('sxFix').value)); $('sxRate').value = a ? ((1 - _n($('sxFix').value) / a) * 100).toFixed(1) : '0'; };
  return false;
}
async function doConfirm() {
  const r = CTX && CTX.r; if (!r) return;
  if (!_online()) return say('DB 미연결 - 입고확정을 할 수 없습니다.');
  const q = _n($('sxQty').value), price = _n($('sxPrice').value), quote = Math.round(q * price) || _n($('sxAmt').value), fix = _n($('sxFix').value);
  const rate = quote ? Number(((1 - fix / quote) * 100).toFixed(2)) : 0, cd = $('sxCdate').value || T0(), ts = new Date().toISOString();
  busy('sxGo', true);
  try {
    const rows = [{ line_id: Number(r.no), status: '입고확정', confirm_date: cd, receipt_qty: q || null, unit_price: price || null,
      receipt_amount: quote || null, confirm_price: fix || null, nego_rate: quote ? rate : null, updated_at: ts }];
    const done = [];
    if (useBatch()) for (const x of (CTX.batch || [])) {
      const eqt = buy(x), efix = Math.round(eqt * (1 - rate / 100));
      rows.push({ line_id: Number(x.no), status: '입고확정', confirm_date: cd, receipt_amount: eqt || null, confirm_price: efix || null, nego_rate: eqt ? rate : null, updated_at: ts });
      done.push(`${x.part || ''} ${_won(efix)}원`);
    }
    await MESDB.table('order_lines').upsert(rows, 'line_id');
    for (const x of rows) { try { const c = CHKS(); c && c.delete(Number(x.line_id)); } catch (e) {} }
    await after(`${r.part || ''} ${r.vendor || ''} 입고확정 (확정가 ${_won(fix)}원, 네고 ${rate}%) — 제조원가에 반영됩니다.`
      + (done.length ? ` · 함께 확정 ${done.length}건: ${done.join(', ')}` : ''), '입고확정 완료');
  } catch (e) { say('입고확정 실패: ' + String(e.message || e).slice(0, 120)); busy('sxGo', false, '▣ 입고확정'); }
}
async function doReceiveCancel() {
  const r = CTX && CTX.r; if (!r) return;
  if (!_online()) return say('DB 미연결 - 입고취소를 할 수 없습니다.');
  const all = [r, ...(useBatch() ? (CTX.batch || []) : [])];
  if (!confirm(`입고 ${all.length}건을 취소합니다.\n발주 상태로 돌아가며 입고수량·입고일이 지워집니다. 계속할까요?`)) return;
  try {
    const ts = new Date().toISOString();
    await MESDB.table('order_lines').upsert(all.map(x => ({ line_id: Number(x.no), status: '발주',
      receipt_qty: 0, receipt_date: null, receipt_amount: null, receipt_weight: null, updated_at: ts })), 'line_id');
    for (const x of all) { try { const c = CHKS(); c && c.delete(Number(x.no)); } catch (e) {} }
    await after(`입고 ${all.length}건을 취소했습니다. (발주 상태로 복귀)`, '입고취소');
  } catch (e) { say('입고취소 실패: ' + String(e.message || e).slice(0, 120)); }
}

/* ── ③ 입고확정 → 내역 / 확정취소 ─────────────────────────── */
function formDone(ev, r) {
  CTX = { r };
  const bt = batchRows(r);
  open(ev, `${r.part || ''} — 입고확정 완료`, 'k-done', headHtml(r) + `
   <div class="info">
    <b>입고일</b><span>${_esc(_dt(r.idate))}</span>
    <b>확정일</b><span>${_esc(_dt(r.cdate))}</span>
    <b>입고수량</b><span>${Number(r.got) || Number(r.qty) || 0}</span>
    <b>매입가</b><span>${_won(buy(r))}원</span>
    <b>네고율</b><span>${Number(r.rate) || 0}%</span>
    <b>확정가</b><span>${_won(r.fix)}원</span></div>
   ${batchNote(bt, '확정취소')}
   <div class="note">확정취소를 하면 「입고」 상태로 돌아가 확정가를 다시 잡을 수 있습니다.</div>`,
   [{ t: '✖ 확정취소', cls: 'warn', fn: doConfirmCancel }, { t: '닫기', fn: close }]);
  CTX.batch = bt;
  return false;
}
async function doConfirmCancel() {
  const r = CTX && CTX.r; if (!r) return;
  if (!_online()) return say('DB 미연결 - 확정취소를 할 수 없습니다.');
  const all = [r, ...(useBatch() ? (CTX.batch || []) : [])];
  if (!confirm(`입고확정 ${all.length}건을 취소합니다.\n확정일·확정가가 지워지고 「입고」 상태로 돌아갑니다. 계속할까요?`)) return;
  try {
    const ts = new Date().toISOString();
    await MESDB.table('order_lines').upsert(all.map(x => ({ line_id: Number(x.no), status: '입고',
      confirm_date: null, confirm_price: null, nego_rate: null, updated_at: ts })), 'line_id');
    for (const x of all) { try { const c = CHKS(); c && c.delete(Number(x.no)); } catch (e) {} }
    await after(`입고확정 ${all.length}건을 취소했습니다. (입고 상태로 복귀)`, '확정취소');
  } catch (e) { say('확정취소 실패: ' + String(e.message || e).slice(0, 120)); }
}

/* ── 진입점: 행 우클릭 / 길게 누르기 ───────────────────────── */
function openRow(ev, r) {
  if (ev) { ev.preventDefault(); ev.stopPropagation(); }
  if (!r) return false;
  const st = stOf(r);
  if (st === '입고확정' || r.cdate) return formDone(ev, r);
  if (st === '입고' || r.idate) return formConfirm(ev, r);
  return formReceive(ev, r);
}
function rowOf(el) {
  const tr = el && el.closest ? el.closest('#body tr') : null; if (!tr) return null;
  const i = Array.prototype.indexOf.call(tr.parentNode.children, tr);
  return { tr, r: VIEW()[i] };
}
function init(opt) {
  CFG = Object.assign({ category: '' }, opt || {});
  const body = $('body'); if (!body) return;
  body.addEventListener('contextmenu', ev => { const o = rowOf(ev.target); if (!o || !o.r) return; try { window.sel && window.sel(o.tr, Array.prototype.indexOf.call(o.tr.parentNode.children, o.tr)); } catch (e) {} openRow(ev, o.r); });
  /* 모바일: 길게 누르기 */
  let tm = null;
  body.addEventListener('touchstart', ev => { const o = rowOf(ev.target); if (!o || !o.r) return; const t = ev.touches[0];
    tm = setTimeout(() => { tm = null; openRow({ clientX: t.clientX, clientY: t.clientY, preventDefault() {}, stopPropagation() {} }, o.r); }, 600); }, { passive: true });
  ['touchend', 'touchmove', 'touchcancel'].forEach(k => body.addEventListener(k, () => { if (tm) { clearTimeout(tm); tm = null; } }, { passive: true }));
  /* 안내 문구 */
  const bar = document.querySelector('.filters .frow:last-child');
  if (bar && !bar.querySelector('.sxhint')) {
    const s = document.createElement('span'); s.className = 'sxhint';
    s.innerHTML = '행 <b>우클릭</b> → 입고 · 입고확정 · 취소 (체크한 행은 함께 처리)';
    bar.appendChild(s);
  }
}
window.MESSTCTX = { init, open: openRow, close };
})();
