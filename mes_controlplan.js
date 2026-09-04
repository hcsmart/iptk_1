/* NEXMES - 관리계획서(Control Plan) 전개 모듈 (SQ v52)
 * 공정코드로 관리항목을 끌어와 공정이력카드·작업지시에 전개한다.
 *
 *   MESCP.byCodes(codes)   Promise<{code: [item,...]}>   공정코드별 관리항목
 *   MESCP.items(code)      Promise<[item,...]>
 *   MESCP.brief(items)     '경도 HRC±2(CC) / 변형량 0.05'  한 줄 요약
 *   MESCP.flat(codes)      Promise<[{code,...item}]>      공정 순서대로 펼친 목록
 *
 * item = {seq, item, cls, spec, unit, cycle, sample, method, gauge, gaugeName, form, react, tol}
 */
(function () {
  if (window.MESCP) return;

  var TTL = 60000;
  var XC = (function () {
    try { var w = window.top; if (!w.__MESCP) w.__MESCP = {}; return w.__MESCP; }
    catch (e) { if (!window.__MESCP) window.__MESCP = {}; return window.__MESCP; }
  })();

  function online() { try { return !!(window.MESDB && MESDB.online); } catch (e) { return false; } }

  async function all() {
    if (XC.t && Date.now() - XC.t < TTL && XC.v) return XC.v;
    if (!online() && window.MESDB && MESDB.ready) { try { await MESDB.ready; } catch (e) { } }
    if (!online()) return [];
    try {
      var v = await MESDB.table('control_plan_view').select('select=*&order=process_code,item_seq');
      XC.v = (v || []).filter(function (r) { return r.is_active !== false; });
      XC.t = Date.now();
      return XC.v;
    } catch (e) { console.warn('MESCP', e.message); return []; }
  }

  function tol(r) {
    var lo = r.spec_lower, hi = r.spec_upper;
    if (lo == null && hi == null) return '';
    var u = r.unit && r.unit !== '-' ? r.unit : '';
    if (lo != null && hi != null) return lo + '~' + hi + (u ? ' ' + u : '');
    return (hi != null ? '≤' + hi : '≥' + lo) + (u ? ' ' + u : '');
  }

  function toItem(r) {
    return {
      planNo: r.plan_no, seq: Number(r.item_seq) || 0,
      item: r.control_item || '', cls: r.spec_class || '일반',
      spec: r.control_spec || '', unit: r.unit || '', tol: tol(r),
      cycle: r.inspection_cycle || '', sample: r.sample_size || '',
      method: r.measure_method || '', gauge: r.gauge_code || '',
      gaugeName: r.gauge_name || '', form: r.record_form || '',
      react: r.reaction_plan || '', alert: r.alert || ''
    };
  }

  async function byCodes(codes) {
    var out = {}, list = await all();
    var want = (codes || []).map(function (c) { return String(c || '').trim().toUpperCase(); });
    list.forEach(function (r) {
      var c = String(r.process_code || '').trim().toUpperCase();
      if (want.length && want.indexOf(c) < 0) return;
      (out[c] = out[c] || []).push(toItem(r));
    });
    Object.keys(out).forEach(function (k) { out[k].sort(function (a, b) { return a.seq - b.seq; }); });
    return out;
  }

  async function items(code) {
    var m = await byCodes([code]);
    return m[String(code || '').trim().toUpperCase()] || [];
  }

  /* '경도 HRC±2(CC) / 변형량 평면도 0.05mm' */
  function brief(list, max) {
    if (!list || !list.length) return '';
    return list.slice(0, max || 3).map(function (x) {
      var s = x.item;
      if (x.spec) s += ' ' + x.spec;
      if (x.cls && x.cls !== '일반') s += '(' + (x.cls.indexOf('SC') === 0 ? 'SC' : 'CC') + ')';
      return s;
    }).join(' / ') + (list.length > (max || 3) ? ' 외 ' + (list.length - (max || 3)) + '건' : '');
  }

  /* 공정 순서대로 관리항목을 한 줄씩 펼친다 */
  async function flat(codes) {
    var m = await byCodes(codes), out = [];
    (codes || []).forEach(function (c) {
      var k = String(c || '').trim().toUpperCase();
      (m[k] || []).forEach(function (x) {
        out.push(Object.assign({ code: k }, x));
      });
    });
    return out;
  }

  window.MESCP = { all: all, byCodes: byCodes, items: items, brief: brief, flat: flat };
})();
