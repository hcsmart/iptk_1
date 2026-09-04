/* NEXMES - 협력업체 적격성 검증 (SQ v50)
 * 발주 저장 직전에 협력업체의 평가등급·인증 유효성을 확인한다.
 *
 *   MESVCHK.rows()            vendor_grade_view 캐시 로드
 *   MESVCHK.of(name)          업체명으로 등급행 조회
 *   MESVCHK.problems(names)   문제 있는 업체 목록
 *   MESVCHK.gate()            발주 게이트 (차단/경고/통과) → Promise<boolean>
 *
 * 화면 수정 없이 동작한다. 이 파일을 화면 스크립트 뒤에 붙이면
 * 전역 save() 를 감싸 저장 직전에 gate() 를 먼저 태운다.
 * 대상 행은 화면의 REQ / ORD 배열이며 각 행의 r.vendor 를 업체명으로 본다.
 */
(function () {
  if (window.MESVCHK) return;

  /* 차단 대상 — 심사에서 '부적격 업체 발주 통제'로 확인하는 항목 */
  var BLOCK = ['거래중지 검토'];
  /* 경고 대상 */
  var WARN = { 'D등급': 1, '인증만료': 1, '평가만료': 1, '인증임박': 1, '미평가': 1, '개선요구': 1 };

  /* 검증 강도 : localStorage.mes_vchk
   *   'on'(기본) 위 전 항목 경고 / 'lite' 미평가·인증임박 제외 / 'off' 검증 안 함
   * 평가 이력을 쌓기 전에는 대부분 '미평가'라 경고가 잦다 → 'lite' 권장. */
  function mode() {
    try { return localStorage.getItem('mes_vchk') || 'on'; } catch (e) { return 'on'; }
  }
  function warned(a) {
    if (mode() === 'lite' && (a === '미평가' || a === '인증임박')) return false;
    return !!WARN[a];
  }

  var TTL = 60000;
  var XC = (function () {
    try { var w = window.top; if (!w.__MESVC) w.__MESVC = {}; return w.__MESVC; }
    catch (e) { if (!window.__MESVC) window.__MESVC = {}; return window.__MESVC; }
  })();

  function online() { try { return !!(window.MESDB && MESDB.online); } catch (e) { return false; } }

  async function rows() {
    if (XC.t && Date.now() - XC.t < TTL && XC.v) return XC.v;
    if (!online() && window.MESDB && MESDB.ready) { try { await MESDB.ready; } catch (e) { } }
    if (!online()) return [];
    try {
      var v = await MESDB.table('vendor_grade_view').select('select=*');
      XC.v = v || []; XC.t = Date.now();
      return XC.v;
    } catch (e) { console.warn('MESVCHK', e.message); return []; }
  }

  function norm(s) { return String(s == null ? '' : s).trim(); }

  async function of(name) {
    var n = norm(name); if (!n) return null;
    var list = await rows();
    return list.find(function (r) { return norm(r.vendor_name) === n || norm(r.vendor_code) === n; }) || null;
  }

  /* 업체명 배열 → 문제 목록 */
  async function problems(names) {
    var uniq = [], out = [];
    (names || []).forEach(function (n) { n = norm(n); if (n && uniq.indexOf(n) < 0) uniq.push(n); });
    if (!uniq.length) return out;
    var list = await rows();
    if (!list.length) return out;               /* 미연결 시 통과 (발주를 막지 않는다) */

    uniq.forEach(function (n) {
      var r = list.find(function (x) { return norm(x.vendor_name) === n || norm(x.vendor_code) === n; });
      if (!r) return;                            /* 협력업체 마스터에 없으면 판단 보류 */
      var a = norm(r.alert), act = norm(r.action_taken);
      var block = BLOCK.indexOf(act) >= 0;
      if (!block && !warned(a)) return;
      out.push({
        vendor: n, alert: a, grade: norm(r.grade), action: act, block: block,
        evalDate: norm(r.eval_date), certExpiry: norm(r.cert_expiry),
        certExpired: Number(r.cert_expired) || 0, ncCnt: Number(r.nc_cnt_1y) || 0,
        text: line(n, r, a, act)
      });
    });
    return out;
  }

  function line(n, r, a, act) {
    var d = [];
    if (r.grade) d.push('등급 ' + r.grade + (r.total_score ? ' (' + r.total_score + '점)' : ''));
    if (a === '미평가') d.push('평가이력 없음');
    if (a === '평가만료') d.push('최근평가 ' + norm(r.eval_date) + ' (1년 경과)');
    if (a === '인증만료') d.push('인증 만료 ' + (Number(r.cert_expired) || 0) + '건');
    if (a === '인증임박') d.push('인증 만료예정 ' + norm(r.cert_expiry));
    if (Number(r.nc_cnt_1y) > 0) d.push('최근1년 부적합 ' + r.nc_cnt_1y + '건');
    if (act) d.push('조치: ' + act);
    return '· ' + n + ' — [' + a + '] ' + d.join(' / ');
  }

  /* 화면의 발주 대상 행에서 업체명 수집 */
  function pickNames() {
    var src = null;
    try { if (typeof REQ !== 'undefined' && Array.isArray(REQ)) src = REQ; } catch (e) { }
    if (!src) { try { if (typeof ORD !== 'undefined' && Array.isArray(ORD)) src = ORD; } catch (e) { } }
    if (!src) return [];
    return src.map(function (r) { return r && (r.vendor || r.vendor_name); }).filter(Boolean);
  }

  function say(t) {
    try { if (window.MES && MES.setMessage) return MES.setMessage(t); } catch (e) { }
    var m = document.getElementById('message'); if (m) m.textContent = t;
  }

  /* 발주 게이트 : 차단이면 false, 경고는 확인 후 진행 */
  async function gate(names) {
    if (mode() === 'off') return true;
    var list = names && names.length ? names : pickNames();
    var p;
    try { p = await problems(list); } catch (e) { return true; }
    if (!p.length) return true;

    var blocked = p.filter(function (x) { return x.block; });
    if (blocked.length) {
      var bt = blocked.map(function (x) { return x.text; }).join('\n');
      alert('거래중지 검토 대상 업체가 포함되어 발주할 수 없습니다.\n\n' + bt +
        '\n\n[SQ → 협력업체 → 협력업체 등급현황]에서 재평가 후 진행하세요.');
      say('부적격 협력업체가 포함되어 발주를 중단했습니다.');
      return false;
    }

    var wt = p.map(function (x) { return x.text; }).join('\n');
    var ok = confirm('아래 협력업체는 적격성 확인이 필요합니다.\n\n' + wt +
      '\n\n그래도 발주를 진행하시겠습니까?\n(진행 시 발주 이력에 그대로 남습니다)');
    if (!ok) { say('협력업체 적격성 확인이 필요해 발주를 취소했습니다.'); return false; }
    say('적격성 경고를 확인하고 발주를 진행합니다.');
    return true;
  }

  /* 전역 save() 를 감싼다 */
  function hook() {
    if (typeof window.save !== 'function' || window.save.__vchk) return;
    var orig = window.save;
    var wrapped = async function () {
      var ok = true;
      try { ok = await gate(); } catch (e) { ok = true; }
      if (!ok) return;
      return orig.apply(this, arguments);
    };
    wrapped.__vchk = 1;
    window.save = wrapped;
  }

  window.MESVCHK = { rows: rows, of: of, problems: problems, gate: gate, hook: hook, BLOCK: BLOCK };

  hook();
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', hook);
  else setTimeout(hook, 0);
})();
