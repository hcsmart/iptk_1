/* IPTK MES 화면 자동 점검 (Playwright / Node.js)
 *
 * 설치 (최초 1회, test 폴더에서):
 *   npm install
 *   npx playwright install chromium
 *
 * 실행 (Windows CMD):
 *   set MES_USER=홍길동& set MES_PW=비밀번호& node iptk_smoke.js
 * 실행 (PowerShell):
 *   $env:MES_USER="홍길동"; $env:MES_PW="비밀번호"; node iptk_smoke.js
 *
 * 옵션 (환경변수)
 *   BASE_URL   점검 주소            기본 https://hcsmart.github.io/iptk_1/
 *   MES_USER   로그인 이름/아이디/이메일
 *   MES_PW     비밀번호
 *   SKIP_LOGIN =1 이면 로그인 없이 화면 로딩만 점검
 *   ONLY       일부 화면만: "수주등록,수주현황"
 *   HEADLESS   =0 이면 브라우저 창을 띄움
 *   SHOT       all = 모든 화면 캡처 / fail = 문제 화면만 (기본)
 *   SETTLE_MS  화면 로딩 후 통신 대기 최대시간 (기본 8000)
 *
 * 결과: test/results/report.html, results.json, 캡처 png
 * 종료코드: FAIL 이 하나라도 있으면 1
 *
 * ※ 읽기 전용 점검: DB에 쓰는 요청(POST 테이블/PATCH/PUT/DELETE/Storage 업로드)은 모두 차단하고 기록만 합니다.
 *    화면 버튼은 누르지 않습니다.
 */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = (process.env.BASE_URL || 'https://hcsmart.github.io/iptk_1/').replace(/\/?$/, '/');
const USER = process.env.MES_USER || '';
const PW = process.env.MES_PW || '';
const SKIP_LOGIN = process.env.SKIP_LOGIN === '1';
const ONLY = (process.env.ONLY || '').split(',').map(s => s.trim()).filter(Boolean);
const HEADLESS = process.env.HEADLESS !== '0';
const SHOT = process.env.SHOT || 'fail';
const SETTLE_MS = +process.env.SETTLE_MS || 8000;
const OUT = path.join(__dirname, 'results');

/* 무시할 잡음 (외부 폰트·파비콘 등) */
const IGNORE = [/favicon\.ico/i, /fonts\.(googleapis|gstatic)/i, /ntfy\.sh/i];

fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);
const safe = s => String(s).replace(/[\\/:*?"<>|\s]+/g, '_');

/* ---------- 이벤트 수집 버킷 ---------- */
let cur = null;                       // 현재 점검 중인 항목
let inflight = 0, lastNet = Date.now();
function bucket(name) {
  return { name, jsErrors: [], consoleErrors: [], httpErrors: [], failedReq: [], blockedWrites: [], dialogs: [] };
}
function push(key, v) { if (cur) cur[key].push(String(v).slice(0, 300)); }
const ignored = u => IGNORE.some(r => r.test(u));

function wire(page) {
  page.on('pageerror', e => push('jsErrors', e.message));
  page.on('console', m => { if (m.type() === 'error' && !ignored(m.location()?.url || '')) push('consoleErrors', m.text()); });
  page.on('request', () => { inflight++; lastNet = Date.now(); });
  const done = () => { inflight = Math.max(0, inflight - 1); lastNet = Date.now(); };
  page.on('requestfinished', done);
  page.on('requestfailed', r => {
    done();
    const f = r.failure()?.errorText || '';
    if (!ignored(r.url()) && !/ERR_ABORTED|BLOCKED_BY_CLIENT/.test(f)) push('failedReq', `${f} ${r.url()}`);
  });
  page.on('response', r => { if (r.status() >= 400 && !ignored(r.url())) push('httpErrors', `${r.status()} ${r.request().method()} ${r.url()}`); });
  page.on('dialog', async d => { push('dialogs', `${d.type()}: ${d.message()}`); try { await d.dismiss(); } catch (e) {} });
}

/* ---------- 쓰기 차단 (읽기 전용 점검) ---------- */
async function blockWrites(ctx) {
  await ctx.route(/supabase\.co\/(rest|storage)\/v1\//, route => {
    const req = route.request(), m = req.method(), u = req.url();
    const isRpc = /\/rest\/v1\/rpc\//.test(u);
    const write = m === 'PATCH' || m === 'PUT' || m === 'DELETE' || (m === 'POST' && !isRpc);
    if (write) { push('blockedWrites', `${m} ${u.split('?')[0]}`); return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); }
    return route.continue();
  });
}

/* 통신이 조용해질 때까지 대기 */
async function settle(page, max = SETTLE_MS) {
  const t0 = Date.now();
  while (Date.now() - t0 < max) {
    if (inflight === 0 && Date.now() - lastNet > 700) return Date.now() - t0;
    await page.waitForTimeout(150);
  }
  return max;
}

const results = [];
function finish(r, status, extra = {}) {
  Object.assign(r, extra);
  if (!status) {
    status = 'PASS';
    if (r.jsErrors.length || r.httpErrors.some(e => /^5\d\d/.test(e)) || r.fileStatus >= 400 || r.timeout) status = 'FAIL';
    else if (r.consoleErrors.length || r.httpErrors.length || r.failedReq.length || r.blank || r.badBadge || r.dialogs.length) status = 'WARN';
  }
  r.status = status;
  results.push(r);
  log(`${status.padEnd(4)} ${r.name}${r.file ? ' (' + r.file + ')' : ''}${r.ms ? ' ' + r.ms + 'ms' : ''}${r.note ? ' - ' + r.note : ''}`);
  return r;
}

/* ---------- 1. 첫 화면 + 로그인 ---------- */
async function testLogin(page) {
  cur = bucket('01 첫 화면·로그인');
  const t0 = Date.now();
  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => document.getElementById('loginGate') || (window.MES_AUTH && window.MES_AUTH.session), null, { timeout: 20000 });
    const gate = await page.$('#loginGate');
    if (!gate) return finish(cur, 'PASS', { note: '저장된 세션으로 자동 로그인', ms: Date.now() - t0 });
    if (SKIP_LOGIN) {
      await page.evaluate(() => document.getElementById('loginGate')?.remove());
      return finish(cur, 'WARN', { note: 'SKIP_LOGIN — 로그인 없이 진행 (DB 조회는 실패 가능)', ms: Date.now() - t0 });
    }
    if (!USER || !PW) throw new Error('MES_USER / MES_PW 환경변수가 없습니다');
    await page.fill('#lgEmail', USER);
    await page.fill('#lgPw', PW);
    await page.click('#lgBtn');
    await page.waitForFunction(() => !document.getElementById('loginGate') || (document.getElementById('lgErr')?.textContent || '').trim(), null, { timeout: 20000 });
    const err = await page.$eval('#lgErr', e => e.textContent).catch(() => '');
    if (err) throw new Error(err);
    const who = await page.evaluate(() => `${window.MES_AUTH?.name} / ${window.MES_AUTH?.role}`);
    await settle(page);
    return finish(cur, null, { note: '로그인 성공: ' + who, ms: Date.now() - t0 });
  } catch (e) {
    await page.screenshot({ path: path.join(OUT, '01_login_fail.png') }).catch(() => {});
    return finish(cur, 'FAIL', { note: e.message, shot: '01_login_fail.png' });
  }
}

/* ---------- 2. 상단 메뉴·메뉴검색 ---------- */
async function testShell(page) {
  cur = bucket('02 상단메뉴·메뉴검색');
  try {
    const mods = await page.$$eval('#topMenu>li', l => l.length);
    if (!mods) throw new Error('상단 모듈 메뉴가 비어 있음');
    await page.fill('#menuSearch', '수주');
    await page.waitForSelector('#searchRes.open button[data-name]', { timeout: 5000 });
    const hits = await page.$$eval('#searchRes button[data-name]', b => b.map(x => x.dataset.name));
    await page.fill('#menuSearch', '');
    const ver = await page.evaluate(() => typeof APP_VER !== 'undefined' ? APP_VER : '?');
    return finish(cur, null, { note: `버전 v${ver} · 모듈 ${mods}개 · '수주' 검색 ${hits.length}건` });
  } catch (e) { return finish(cur, 'FAIL', { note: e.message }); }
}

/* ---------- 3. 전체 화면 순회 ---------- */
async function listScreens(page) {
  return page.evaluate(() => {
    const reg = window.IPMES.pageRegistry, seen = new Set(), out = [];
    for (const [name, p] of Object.entries(reg)) {
      if (!p || !p.file || seen.has(p.id)) continue;
      seen.add(p.id); out.push({ name, id: p.id, file: p.file, title: p.title });
    }
    return out;
  });
}

async function testScreen(page, s, idx) {
  cur = bucket(s.name);
  const r = Object.assign(cur, { file: s.file });
  const t0 = Date.now();
  let fileStatus = 0;
  const base = s.file.split('?')[0];
  const onResp = resp => { if (resp.url().split('?')[0].endsWith('/' + base)) fileStatus = resp.status(); };
  page.on('response', onResp);
  try {
    await page.evaluate(n => openByName(n, true), s.name);
    await page.waitForFunction(id => {
      const f = document.getElementById('view_' + id);
      try { return f && f.contentWindow.location.href !== 'about:blank' && f.contentDocument.readyState === 'complete'; } catch (e) { return false; }
    }, s.id, { timeout: 20000 });
    await settle(page);
    const frame = await (await page.$('#view_' + s.id))?.contentFrame();
    const info = frame ? await frame.evaluate(() => {
      const b = document.getElementById('mesdb-badge');
      const bg = b ? getComputedStyle(b).backgroundColor : '';
      return {
        text: (document.body?.innerText || '').trim().length,
        badge: b && b.style.display !== 'none' ? b.textContent : '',
        bad: !!b && b.style.display !== 'none' && /198, 40, 40|158, 158, 158|245, 124, 0/.test(bg),
        hscroll: document.documentElement.scrollWidth > window.innerWidth + 4
      };
    }) : { text: 0 };
    r.ms = Date.now() - t0;
    r.fileStatus = fileStatus;
    r.blank = info.text < 5;
    r.badge = info.badge; r.badBadge = info.bad;
    if (r.blank) r.note = '화면 내용이 비어 있음';
    if (info.bad) r.note = (r.note ? r.note + ' / ' : '') + 'DB배지: ' + info.badge;
    if (fileStatus >= 400) r.note = `파일 ${fileStatus}`;
  } catch (e) {
    r.timeout = true; r.note = '로딩 실패: ' + e.message.split('\n')[0]; r.ms = Date.now() - t0; r.fileStatus = fileStatus;
  }
  page.off('response', onResp);
  finish(r);
  if (SHOT === 'all' || r.status !== 'PASS') {
    r.shot = `${String(idx).padStart(3, '0')}_${safe(s.name)}.png`;
    await page.screenshot({ path: path.join(OUT, r.shot) }).catch(() => { r.shot = ''; });
  }
  await page.evaluate(id => { try { closeTab(id); } catch (e) {} }, s.id).catch(() => {});
}

/* ---------- 4. 모바일 화면 ---------- */
async function testMobile(browser, storage) {
  cur = bucket('99 모바일(iPhone 13) 첫 화면');
  const ctx = await browser.newContext({ ...devices['iPhone 13'], storageState: storage });
  await blockWrites(ctx);
  const p = await ctx.newPage(); wire(p);
  try {
    await p.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await settle(p);
    /* 내용이 넘치면 모바일 브라우저가 축소 표시하므로 innerWidth 도 기기폭(screen.width)보다 커진다 */
    const o = await p.evaluate(() => ({ sw: Math.max(document.documentElement.scrollWidth, innerWidth), w: screen.width, vp: !!document.querySelector('meta[name=viewport]') }));
    cur.shot = '99_mobile.png';
    await p.screenshot({ path: path.join(OUT, cur.shot) });
    if (!o.vp) finish(cur, 'WARN', { note: 'viewport 메타 없음' });
    else if (o.sw > o.w + 4) finish(cur, 'WARN', { note: `가로 스크롤 발생 (${o.sw}px > ${o.w}px)` });
    else finish(cur, null, { note: `폭 ${o.w}px 정상` });
  } catch (e) { finish(cur, 'FAIL', { note: e.message }); }
  await ctx.close();
}

/* ---------- 리포트 ---------- */
function writeReport(meta) {
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ meta, results }, null, 2));
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cnt = k => results.filter(r => r.status === k).length;
  const detail = r => ['jsErrors', 'consoleErrors', 'httpErrors', 'failedReq', 'dialogs', 'blockedWrites']
    .filter(k => r[k] && r[k].length).map(k => `<div class="d"><b>${k}</b> (${r[k].length})<br>${r[k].slice(0, 8).map(esc).join('<br>')}</div>`).join('');
  const rows = results.map((r, i) => `<tr class="${r.status}"><td>${i + 1}</td><td><span class="st">${r.status}</span></td>
<td><b>${esc(r.name)}</b><div class="f">${esc(r.file || '')}</div></td><td class="n">${r.ms ?? ''}</td>
<td>${esc(r.note || '')}${detail(r)}</td><td>${r.shot ? `<a href="${esc(r.shot)}" target="_blank">보기</a>` : ''}</td></tr>`).join('');
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>IPTK MES 화면 점검</title><style>
body{font:13px "Malgun Gothic",sans-serif;margin:0;padding:16px;background:#f4f6f9;color:#1d2b3a}
h1{font-size:18px;margin:0 0 6px}.meta{color:#5b6b7b;margin-bottom:12px}
.sum{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.sum div{background:#fff;border:1px solid #d5dde5;padding:8px 14px;border-radius:6px}
.sum b{font-size:18px;display:block}.fl{margin-bottom:10px}.fl button{margin-right:4px;padding:4px 10px;border:1px solid #9aa9b8;background:#fff;border-radius:4px;cursor:pointer}
.wrap{overflow-x:auto;background:#fff;border:1px solid #d5dde5}table{border-collapse:collapse;width:100%;min-width:720px}
th,td{border-bottom:1px solid #e3e8ee;padding:6px 8px;text-align:left;vertical-align:top}th{background:#eaf0f6;position:sticky;top:0}
.f{color:#7a8896;font-size:11px}.n{text-align:right;white-space:nowrap}.d{margin-top:4px;font-size:11px;color:#6b4b00;word-break:break-all}
.st{padding:1px 7px;border-radius:9px;color:#fff;font-size:11px}.PASS .st{background:#2e7d32}.WARN .st{background:#ef8f00}.FAIL .st{background:#c62828}
@media(max-width:600px){body{padding:10px}h1{font-size:16px}.sum div{flex:1 1 40%}}
</style></head><body><h1>IPTK MES 화면 자동 점검</h1>
<div class="meta">${esc(meta.baseUrl)} · ${esc(meta.start)} · ${meta.sec}초 · 사용자 ${esc(meta.user || '-')}</div>
<div class="sum"><div>전체<b>${results.length}</b></div><div style="color:#2e7d32">PASS<b>${cnt('PASS')}</b></div><div style="color:#ef8f00">WARN<b>${cnt('WARN')}</b></div><div style="color:#c62828">FAIL<b>${cnt('FAIL')}</b></div></div>
<div class="fl"><button onclick="f('')">전체</button><button onclick="f('FAIL')">FAIL</button><button onclick="f('WARN')">WARN</button><button onclick="f('PASS')">PASS</button></div>
<div class="wrap"><table><thead><tr><th>#</th><th>결과</th><th>화면</th><th>ms</th><th>내용</th><th>캡처</th></tr></thead><tbody>${rows}</tbody></table></div>
<script>function f(s){document.querySelectorAll('tbody tr').forEach(t=>t.style.display=!s||t.className===s?'':'none')}</script></body></html>`;
  fs.writeFileSync(path.join(OUT, 'report.html'), html);
}

/* ---------- 실행 ---------- */
(async () => {
  const start = new Date();
  log(`점검 시작: ${BASE_URL}`);
  const browser = await chromium.launch({ headless: HEADLESS });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, locale: 'ko-KR' });
  await blockWrites(ctx);
  const page = await ctx.newPage();
  wire(page);

  const login = await testLogin(page);
  if (login.status !== 'FAIL') {
    await testShell(page);
    let screens = await listScreens(page);
    if (ONLY.length) screens = screens.filter(s => ONLY.includes(s.name) || ONLY.includes(s.title) || ONLY.includes(s.file));
    log(`화면 ${screens.length}개 점검`);
    for (let i = 0; i < screens.length; i++) await testScreen(page, screens[i], i + 3);
    await testMobile(browser, await ctx.storageState());
  }
  await browser.close();

  const sec = Math.round((Date.now() - start) / 1000);
  writeReport({ baseUrl: BASE_URL, start: start.toLocaleString('ko-KR'), sec, user: USER });
  const c = k => results.filter(r => r.status === k).length;
  log(`완료 ${sec}s — PASS ${c('PASS')} / WARN ${c('WARN')} / FAIL ${c('FAIL')}`);
  log(`리포트: ${path.join(OUT, 'report.html')}`);
  process.exit(c('FAIL') ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
