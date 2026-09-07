/* IPMES — 외주가공 물류이동 조회 모듈 (1단계)
 * 읽기 전용. 화면의 저장 로직을 건드리지 않는다.
 *
 *   MESMOVE.positions({job,vendor,part})  → v_outsourcing_position
 *   MESMOVE.moves(lineId)                 → outsourcing_moves (시간순)
 *   MESMOVE.attach('waitBody')            → 표 오른쪽에 [보유처 · 체류] 열 추가
 *
 * 로드 순서 : mes_db.js → mes_ctx.js → mes_move.js
 */
(function () {
if (window.MESMOVE) return;

var CACHE = { at: 0, map: null };
var TTL = 60000;

function num(v) { return Number(v || 0); }
function online() { return !!(window.MESDB && window.MESDB.online); }

async function api(table, qs) {
  if (!online()) return [];
  try { return (await MESDB.table(table).select(qs)) || []; }
  catch (e) { console.warn('MESMOVE ' + table + ': ' + e.message); return []; }
}

async function positions(f) {
  f = f || {};
  var p = ['select=*', 'order=line_id'];
  if (f.job)    p.push('job_no=eq.' + encodeURIComponent(f.job));
  if (f.vendor) p.push('vendor_name=eq.' + encodeURIComponent(f.vendor));
  if (f.part)   p.push('part_no=eq.' + encodeURIComponent(f.part));
  if (f.openOnly) p.push('open_qty=gt.0');
  return api('v_outsourcing_position', p.join('&'));
}

async function moves(lineId) {
  return api('outsourcing_moves',
    'select=*&order=move_date,move_id&line_id=eq.' + Number(lineId));
}

async function indexed(force) {
  if (!force && CACHE.map && Date.now() - CACHE.at < TTL) return CACHE.map;
  var rows = await positions();
  var m = {};
  rows.forEach(function (r) { m[Number(r.line_id)] = r; });
  CACHE.map = m; CACHE.at = Date.now();
  return m;
}
function invalidate() { CACHE.map = null; CACHE.at = 0; }

/* 표시 문구 — 색은 화면 톤(다크 스틸)에 맞춰 채도 낮게 */
function label(p) {
  if (!p) return { t: '-', c: '', b: '400' };
  if (num(p.open_qty) <= 0) return { t: '✓ 사내복귀', c: '#2e7d32', b: '600' };

  var d = p.stay_days === null || p.stay_days === undefined ? null : num(p.stay_days);
  var head = p.position_state === '부분완료' ? '◐ '
           : p.position_state === '작업중'   ? '🏭 '
           : '🚚 ';
  var t = head + (p.vendor_name || '') + (d === null ? '' : ' · ' + d + '일');
  if (num(p.in_qty) > 0) t += ' (' + num(p.in_qty) + '/' + num(p.order_qty) + ')';

  var c = p.delayed ? '#c62828' : (d !== null && d >= 14 ? '#f57c00' : '#1d568c');
  return { t: t, c: c, b: '600' };
}

/* ── 표에 열 하나 붙이기 (DOM 후처리 — HTML 원본 무수정) ── */
function ensureHead(tb) {
  var tbl = tb.closest ? tb.closest('table') : null;
  if (!tbl || tbl.dataset.mvHead) return tbl;
  var cg = tbl.querySelector('colgroup');
  if (cg) { var col = document.createElement('col'); col.style.width = '170px'; cg.appendChild(col); }
  var hr = tbl.querySelector('thead tr');
  if (hr) { var th = document.createElement('th'); th.textContent = '보유처 · 체류'; hr.appendChild(th); }
  tbl.dataset.mvHead = '1';
  return tbl;
}

async function paint(tb) {
  if (!tb || !ensureHead(tb)) return;
  var map = await indexed();
  Array.prototype.forEach.call(tb.rows, function (tr) {
    if (tr.dataset.mvDone) return;
    tr.dataset.mvDone = '1';
    var empty = tr.querySelector('td[colspan]');
    if (empty) { empty.colSpan = empty.colSpan + 1; return; }
    var cb = tr.querySelector('input[data-no]');
    var p = cb ? map[Number(cb.dataset.no)] : null;
    var L = label(p);
    var td = document.createElement('td');
    td.className = 'c';
    td.textContent = L.t;
    td.style.color = L.c;
    td.style.fontWeight = L.b;
    if (p) td.title = '발주 ' + (p.order_date || '-') +
                      ' / 요구 ' + (p.required_date || '-') +
                      ' / 미회수 ' + num(p.open_qty);
    tr.appendChild(td);
  });
}

var timers = {};
function attach(tbodyId) {
  var tb = document.getElementById(tbodyId);
  if (!tb || tb.dataset.mvBound) return;
  tb.dataset.mvBound = '1';
  var run = function () {
    clearTimeout(timers[tbodyId]);
    timers[tbodyId] = setTimeout(function () { paint(tb); }, 120);
  };
  new MutationObserver(run).observe(tb, { childList: true });
  run();
}

/* 저장 직후에는 캐시를 버린다 */
document.addEventListener('click', function (e) {
  if (e.target.closest && e.target.closest('button')) setTimeout(invalidate, 600);
}, true);

window.MESMOVE = {
  positions: positions,
  moves: moves,
  indexed: indexed,
  invalidate: invalidate,
  label: label,
  attach: attach
};

/* 자동 부착 — 외주가공 입고 화면의 입고대기 목록 */
var page = (location.pathname.split('/').pop() || '').replace('.html', '');
var AUTO = { outsourcing_receipt_input: ['waitBody'] };
(function boot(n) {
  if (!AUTO[page]) return;
  if (!online() && n < 60) return setTimeout(function () { boot(n + 1); }, 100);
  AUTO[page].forEach(attach);
})(0);
})();
