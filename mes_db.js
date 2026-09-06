/* IP mes - Supabase 연동 (v55)
 * 1) MESDB.bind(page, ()=>({var:arr,...}))  : page_state 테이블에서 화면 데이터 복원 + 버튼 클릭 후 자동 저장
 * 2) MESDB.table(name).select()/upsert(rows)/delete(match) : 정규화 테이블 직접 접근
 */
(function(){
/* ── v23: 초기 깜빡임 방지 ─────────────────────────────────────
 * 화면은 DB 연결 실패 대비용 인라인 데이터를 먼저 그린다. 그대로 두면
 * 인라인 자료가 잠깐 보였다가 DB 자료로 교체되며 깜빡인다.
 * DB 로드가 끝날 때까지 본문을 가려 최종 결과만 보이게 한다. */
(function(){
  if(window.__mesdbLoading)return; window.__mesdbLoading=true;
  var css='html.mesdb-loading body>*{visibility:hidden}'+
    'html.mesdb-loading:after{content:"불러오는 중…";position:fixed;inset:0;display:flex;'+
    'align-items:center;justify-content:center;font:13px "Malgun Gothic",sans-serif;color:#5b6b7a;'+
    'background:#f7fafc;z-index:99998}';
  var st=document.createElement('style');st.textContent=css;
  (document.head||document.documentElement).appendChild(st);
  document.documentElement.classList.add('mesdb-loading');
  var done=false;
  window.__mesdbReady=function(){if(done)return;done=true;
    document.documentElement.classList.remove('mesdb-loading')};
  setTimeout(window.__mesdbReady,900);   /* v36: 2500 -> 900ms */
  /* v36: MESDB.bind/master/lines 를 쓰지 않는 화면은 기다릴 이유가 없다 → 즉시 해제 */
  document.addEventListener('DOMContentLoaded',function(){
    setTimeout(function(){if(!window.__mesdbBound)window.__mesdbReady()},0)});
  /* v36: DNS/TLS 를 미리 열어 첫 REST 요청 지연 제거 */
  try{var lk=document.createElement('link');lk.rel='preconnect';lk.crossOrigin='';
      lk.href='https://ipggvrzxfcryzryileuv.supabase.co';
      (document.head||document.documentElement).appendChild(lk)}catch(e){}
})();

const MES_VER='v61';window.MES_VER=MES_VER;
const CFG={url:'https://ipggvrzxfcryzryileuv.supabase.co',key:'sb_publishable_CHO-dAOU00HNwno52255mg_H3C1_vew'};
function tok(){try{return (window.MES_AUTH||window.parent.MES_AUTH)?.token||null}catch(e){return null}}
const H=()=>({'apikey':CFG.key,'Authorization':'Bearer '+(tok()||CFG.key),'Content-Type':'application/json'});
/* ── v47: 에러로그 ──────────────────────────────────────────────
 * 화면에서 발생한 오류를 error_log 테이블에 남긴다(디버깅용).
 * 재귀 방지: error_log 전송은 rest()/캐시를 거치지 않고 fetch 직접 호출. */
const ELOG=(function(){
  const recent=new Map();
  const cut=(s,n)=>s==null?null:String(s).slice(0,n||4000);
  function who(){try{const a=window.MES_AUTH||window.parent.MES_AUTH,s=a&&a.session;
    return{user_key:(s&&(s.user_key||s.userKey))||null,user_name:(s&&(s.user_name||s.name))||null}}
    catch(e){return{user_key:null,user_name:null}}}
  function myMenu(){try{const f=location.pathname.split('/').pop();
    return window.parent.MES_MENU_OF?.(f)||null}catch(e){return null}}
  async function push(o){
    try{
      if(!o||!o.message)return;
      const pg=o.page||location.pathname.split('/').pop()||null;
      const k=pg+'|'+o.message, now=Date.now();
      if(recent.get(k)&&now-recent.get(k)<10000)return;   /* 동일 오류 10초 중복 제거 */
      recent.set(k,now);
      const w=who();
      const row={level:o.level||'ERROR',page:pg,menu:o.menu!==undefined?o.menu:myMenu(),
        user_key:w.user_key,user_name:w.user_name,
        message:cut(o.message,500),source:cut(o.source,300),detail:cut(o.detail),
        page_url:cut(location.href,500),user_agent:cut(navigator.userAgent,300)};
      await fetch(CFG.url+'/rest/v1/error_log',{method:'POST',
        headers:{...H(),'Prefer':'return=minimal'},body:JSON.stringify([row])});
    }catch(e){/* 로그 적재 실패는 무시 */}
  }
  return{push};
})();
window.MESLOG={error:(m,d)=>ELOG.push({message:m,detail:d}),
               warn:(m,d)=>ELOG.push({level:'WARN',message:m,detail:d}),
               push:o=>ELOG.push(o)};
window.addEventListener('error',function(e){
  if(e.target&&e.target!==window&&e.target.tagName)
    return ELOG.push({level:'WARN',message:'리소스 로드 실패: '+(e.target.src||e.target.href||e.target.tagName),
                      source:e.target.tagName});
  ELOG.push({message:String(e.message||'스크립트 오류'),
    source:(e.filename||'').split('/').pop()+':'+(e.lineno||0)+':'+(e.colno||0),
    detail:(e.error&&e.error.stack)||null});
},true);
window.addEventListener('unhandledrejection',function(e){
  const r=e.reason;
  ELOG.push({message:'처리되지 않은 Promise 오류: '+String((r&&r.message)||r),detail:(r&&r.stack)||null});
});
/* v36: 최상위 창에 GET 응답 캐시를 두어 화면(iframe)마다 같은 마스터를 다시 받지 않게 한다.
   쓰기(POST/PATCH/DELETE) 시 해당 테이블 캐시는 즉시 무효화한다. */
const XC=(function(){try{var w=window.top;if(!w.__MESXC)w.__MESXC=new Map();return w.__MESXC}
  catch(e){if(!window.__MESXC)window.__MESXC=new Map();return window.__MESXC}})();
const XTTL=20000;
const xclone=v=>(v===null||v===undefined)?v:JSON.parse(JSON.stringify(v));
const xdrop=path=>{const tb=String(path).split(/[?/]/)[0];
  if(tb==='rpc'){XC.clear();return}          /* RPC 는 어느 테이블을 바꿀지 모르므로 전체 무효화 */
  for(const k of [...XC.keys()])if(k.indexOf('|'+tb)>-1)XC.delete(k)};
async function rest(path,opt={}){
  const mth=(opt.method||'GET').toUpperCase();
  if(mth!=='GET'){xdrop(path);return rest_(path,opt)}
  const k=(tok()||'a')+'|'+path, c=XC.get(k);
  if(c&&Date.now()-c.t<XTTL)return xclone(await c.p);
  const p=rest_(path,opt);XC.set(k,{t:Date.now(),p});
  try{return xclone(await p)}catch(e){XC.delete(k);throw e}
}
async function rest_(path,opt={}){
  const mth=(opt.method||'GET').toUpperCase();
  let r;
  try{r=await fetch(CFG.url+'/rest/v1/'+path,{...opt,headers:{...H(),...(opt.headers||{})}})}
  catch(e){ELOG.push({message:'통신 실패: '+e.message,source:mth+' '+path});throw e}
  if(!r.ok){
    const b=await r.text();
    let msg;
    if(r.status===401||r.status===403||/permission denied|row-level security/i.test(b))msg='권한 없음(RLS): 로그인이 필요한 자료입니다. '+r.status;
    else if(/violates foreign key/i.test(b))msg='참조 무결성 위반: 마스터에 없는 코드입니다. 기준정보에 먼저 등록하세요.';
    else if(/violates check constraint/i.test(b))msg='허용되지 않는 값입니다(구분/상태 코드 확인).';
    else msg=r.status+' '+b.slice(0,200);
    ELOG.push({message:msg,source:mth+' '+String(path).split('?')[0],
      detail:'HTTP '+r.status+'\n'+mth+' '+path+'\n'+b.slice(0,3000)
             +(opt.body?'\n\n[body]\n'+String(opt.body).slice(0,1500):'')});
    throw new Error(msg);
  }
  const t=await r.text();return t?JSON.parse(t):null}
/* v72: 쓰기가 끝나면 해당 테이블 변경을 자동으로 알린다.
 * 화면마다 MESDB.notify() 를 직접 부르게 했더니 빠뜨린 화면이 많아
 * (예: 외주설계 입고 → 금형진척현황이 5분 뒤에야 갱신) 여기서 일괄 처리한다.
 * 화면이 직접 부르는 notify 와 겹쳐도 무해하다. */
const autoNotify=(name,p)=>p.then(r=>{try{window.MESDB.notify&&window.MESDB.notify([name])}catch(e){}return r});
const table=name=>({
  select:(q='select=*')=>rest(`${name}?${q}`),
  upsert:(rows,onConflict)=>{const a=Array.isArray(rows)?rows:[rows];const keys=[];for(const r of a)for(const k in r)if(!keys.includes(k))keys.push(k);
    const norm=a.map(r=>{const o={};for(const k of keys)o[k]=(r[k]===undefined?null:r[k]);return o});
    return autoNotify(name,rest(`${name}${onConflict?'?on_conflict='+onConflict:''}`,{method:'POST',headers:{'Prefer':'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(norm)}))},
  delete:(match)=>autoNotify(name,rest(`${name}?`+Object.entries(match).map(([k,v])=>`${k}=eq.${encodeURIComponent(v)}`).join('&'),{method:'DELETE',headers:{'Prefer':'return=minimal'}})),
  /* v39: identity 채번 컬럼을 DB에 맡기고 생성된 행을 돌려받는다.
     (화면에서 max+1 로 직접 채번하면 동시 저장 시 PK 가 충돌한다) */
  insertOne:async(row)=>{const r=await rest(`${name}?select=*`,{method:'POST',
    headers:{'Prefer':'return=representation'},body:JSON.stringify([row])});
    try{window.MESDB.notify&&window.MESDB.notify([name])}catch(e){}
    return Array.isArray(r)?r[0]:r}
});
let page=null,getter=null,last='',timer=null,online=false;
function snapshot(){const o=getter()||{};const out={};for(const k in o)if(Array.isArray(o[k]))out[k]=o[k];return out}
/* v37: 상태 배지 — 개발용 표시. 정상(연결/저장)일 때는 2.5초 뒤 자동으로 사라지고,
   오류·미연결일 때만 남는다. 항상 보고 싶으면 localStorage.mes_badge='on',
   완전히 끄려면 'off'. */
window.__mesBadge=function(t,color){
  var mode=null;try{mode=localStorage.getItem('mes_badge')}catch(e){}
  if(mode==='off')return;
  t=t+' · '+(window.MES_VER||'v43');
  var b=document.getElementById('mesdb-badge');
  if(!b){b=document.createElement('div');b.id='mesdb-badge';
    b.style.cssText='position:fixed;right:8px;bottom:50px;font:11px Malgun Gothic,sans-serif;'+
      'padding:2px 7px;border-radius:9px;color:#fff;opacity:.85;z-index:9999;pointer-events:none;'+
      'transition:opacity .4s';
    (document.body||document.documentElement).appendChild(b)}
  b.textContent=t;b.style.background=color;b.style.opacity='.85';b.style.display='';
  clearTimeout(b.__t);
  var bad=(color==='#c62828'||color==='#9e9e9e'||color==='#f57c00');
  if(mode==='on'||bad)return;
  b.__t=setTimeout(function(){b.style.opacity='0';
    setTimeout(function(){if(b.style.opacity==='0')b.style.display='none'},450)},2500);
};
const badge=(t,c)=>window.__mesBadge(t,c);
async function load(){try{const rows=await rest(`page_state?page=eq.${encodeURIComponent(page)}&select=data`);online=true;if(rows&&rows[0]){const saved=rows[0].data,cur=getter()||{};for(const k in saved){if(Array.isArray(cur[k])&&Array.isArray(saved[k])){cur[k].length=0;cur[k].push(...saved[k])}}
  (window.MES?.search||window.search||window.render||(()=>{}))();last=JSON.stringify(snapshot());badge('DB 연결 · 저장본 복원','#2e7d32');window.__mesdbReady&&window.__mesdbReady()}else{last=JSON.stringify(snapshot());badge('DB 연결 · 초기데이터','#1565c0');window.__mesdbReady&&window.__mesdbReady()}}catch(e){online=false;badge('DB 미연결(로컬)','#9e9e9e');console.warn('MESDB',e.message);window.__mesdbReady&&window.__mesdbReady()}}
async function persist(){if(!online)return;const s=JSON.stringify(snapshot());if(s===last)return;try{await rest('page_state',{method:'POST',headers:{'Prefer':'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{page,data:JSON.parse(s),updated_at:new Date().toISOString()}])});last=s;badge('DB 저장됨 '+new Date().toLocaleTimeString('ko-KR'),'#2e7d32')}catch(e){badge('DB 저장실패','#c62828');console.warn('MESDB',e.message)}}
function bind(p,g){window.__mesdbBound=1;page=p;getter=g;load();document.addEventListener('click',e=>{if(e.target.closest('button,[onclick]')){clearTimeout(timer);timer=setTimeout(persist,400)}},true);document.addEventListener('change',()=>{clearTimeout(timer);timer=setTimeout(persist,400)},true)}
async function reset(){await rest(`page_state?page=eq.${encodeURIComponent(page)}`,{method:'DELETE'});location.reload()}
/* RPC (Postgres 함수) 호출 */
async function rpc(fn,args){
  const r=await rest('rpc/'+fn,{method:'POST',body:JSON.stringify(args||{})});
  return Array.isArray(r)?r[0]:r;
}
window.MESDB={cfg:CFG,rest,table,bind,persist,reset,rpc,get online(){return online}};
MESDB.auth=()=>{try{return window.MES_AUTH||window.parent.MES_AUTH||null}catch(e){return null}};
MESDB.pageMenu=()=>{try{const f=location.pathname.split('/').pop();return window.parent.MES_MENU_OF?.(f)||null}catch(e){return null}};
MESDB.canSave=()=>{const a=MESDB.auth();if(!a)return true;const m=MESDB.pageMenu();return m?a.can(m,'save'):true};
/* 저장 권한이 없으면 저장/삭제류 버튼 비활성
 * v72: 부모의 loadPerms() 가 비동기라 iframe 이 먼저 뜨면 role 이 아직 null 이다.
 *      그 상태로 판정하면 마스터인데도 저장 버튼이 꺼진 채 남으므로, role 이
 *      정해질 때까지 기다렸다가 한 번만 적용한다. */
(function(){
  const apply=()=>{
    const a=MESDB.auth();if(!a)return true;                 /* 로그인 모듈 없음 → 제한 없음 */
    if(!a.role)return false;                                /* 권한 로딩 전 → 다시 시도 */
    if(a.role==='admin'||a.role==='master')return true;
    const m=MESDB.pageMenu();if(!m)return true;
    const cs=a.can(m,'save'),cd=a.can(m,'delete');
    document.querySelectorAll('button[onclick]').forEach(b=>{const oc=b.getAttribute('onclick');
      if(/save|receive|confirm|apply|register/i.test(oc)&&!cs||/remove|del|cancel/i.test(oc)&&!cd){
        b.disabled=true;b.title='권한이 없습니다';b.style.opacity=.45}});
    return true;
  };
  const start=()=>{if(apply())return;let n=0;
    const iv=setInterval(()=>{if(apply()||++n>60)clearInterval(iv)},200)};   /* 최대 12초 대기 */
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
MESDB.ping=async()=>{try{await rest('page_state?select=page&limit=1');online=true}catch(e){online=false}return online};MESDB.ready=MESDB.ping();
})();

/* ── v17: 마스터 화면 ↔ 정규화 테이블 직결 ──────────────────────────
 * MESDB.master({page, table, pk, map, get, render})
 *   map : 화면키 -> DB컬럼명(문자열) 또는 {col, type:'text|num|bool|ynbool'}
 *   화면 배열을 DB에서 로드해 교체하고, 저장/삭제 시 변경분만 업서트/삭제한다.
 *   page_state 방식(MESDB.bind)과 달리 실제 정규화 테이블에 반영된다.
 */
(function(){
const norm=m=>{const o={};for(const k in m){const v=m[k];o[k]=typeof v==='string'?{col:v,type:'text'}:{type:'text',...v}}return o};
function toScreen(row,map){const o={};for(const k in map){const{col,type}=map[k];let v=row[col];
  if(type==='ynbool')v=(v===true?'Y':v===false?'N':'');
  else if(type==='bool')v=!!v;
  else if(type==='num')v=(v===null||v===undefined?'':v);
  else v=(v===null||v===undefined?'':String(v));
  o[k]=v}return o}
function toDb(row,map){const o={};for(const k in map){const{col,type}=map[k];let v=row[k];
  if(type==='ynbool')v=(v==='Y'?true:v==='N'?false:null);
  else if(type==='bool')v=(v===''||v===undefined||v===null)?null:!!v;
  else if(type==='num'){v=(v===''||v===null||v===undefined)?null:Number(v);if(Number.isNaN(v))v=null}
  else v=(v===''||v===undefined||v===null)?null:String(v);
  o[col]=v}return o}
const badge=(t,c)=>window.__mesBadge(t,c);

async function master(opt){
  window.__mesdbBound=1;
  const map=norm(opt.map), pkScreen=opt.pk, pkCol=map[pkScreen].col;
  let snap=new Map(), online=false, timer=null, selfAt=0;
  const arr=()=>opt.get();
  const key=r=>String(r[pkScreen]??'');
  function take(){snap=new Map(arr().map(r=>[key(r),JSON.stringify(r)]))}

  /* v56: 최초 로드를 함수로 분리 - 실패해도 클릭 리스너는 등록하고, 저장 시 재접속을 시도한다.
   *  (종전에는 최초 로드 실패 시 return 되어 이후 저장이 화면에만 남고 DB 에 전혀 반영되지 않았다) */
  async function load(keepLocal){
    try{
      const rows=await MESDB.table(opt.table).select('select=*');
      const a=arr();
      /* 미연결 이후 화면에서 바뀐 행만 보존 (HTML 에 박힌 초기 예시 자료는 제외) */
      const local=keepLocal?a.filter(r=>key(r)&&snap.get(key(r))!==JSON.stringify(r)):[];
      a.length=0; a.push(...rows.map(r=>toScreen(r,map)));
      online=true;
      take();
      /* 미연결 중 화면에서 입력한 행은 DB 값 위에 덮어 유지 → 이어지는 sync 에서 업서트 */
      for(const r of local){const k=key(r);if(!k)continue;const i=a.findIndex(x=>key(x)===k);if(i>=0)a[i]=r;else a.push(r)}
      /* v39: 렌더 예외를 격리 (마스터 화면 저장 불능 방지) */
      try{(opt.render||window.render||(()=>{}))()}catch(e){console.warn('MESDB.master render',e.message);
        badge('화면 표시 오류(자료는 정상 로드)','#f57c00')}
      badge(`DB: ${opt.table} ${rows.length}건`,'#2e7d32');
      return true;
    }catch(e){online=false;badge('DB 미연결(로컬)','#9e9e9e');console.warn('MESDB.master',e.message);
      if(!snap.size)take();                               /* 현재(초기) 자료를 기준점으로 잡아 이후 변경분만 추적 */
      return false}
  }
  const first=await load(false);
  window.__mesdbReady&&window.__mesdbReady();
  if(!first&&window.MES?.setMessage)window.MES.setMessage('DB 연결 실패: 저장 시 다시 접속을 시도합니다. 계속 실패하면 로그인/네트워크를 확인하세요.');

  /* v55: 변경 컬럼만 보낸다 (부분 갱신)
   *  - 기존 행: pk + 화면에서 바뀐 컬럼만 → 다른 세션·트리거가 갱신한 컬럼(car_no, current_rev,
   *    next_cal_date, 총점/등급 등)을 화면의 옛값으로 되돌리지 않는다.
   *  - 신규 행: 값이 있는 컬럼만 (identity 채번 컬럼에 null 을 보내지 않기 위함)
   *  - 빈값으로 지운 컬럼은 null 로 정상 반영된다 (종전에는 단일 행 저장 시 누락)
   *  PostgREST 일괄 upsert 는 키 집합이 같아야 하므로 키 집합별로 나눠 보낸다. */
  const inList=keys=>'('+keys.map(k=>'"'+String(k).replace(/"/g,'')+'"').join(',')+')';
  function diffCols(r,prev){const cols=[pkCol],a=toDb(r,map),b=toDb(prev,map);   /* DB 형으로 정규화해 비교 ('7' vs 7) */
    for(const k in map){const c=map[k].col;if(c===pkCol)continue;
      if(JSON.stringify(a[c])!==JSON.stringify(b[c]))cols.push(c)}
    return cols}
  /* v55: 신규 행 번호가 DB 에 이미 있으면(다른 세션이 먼저 채번) 자동 재부여 */
  async function renumber(rows){
    const keys=rows.map(r=>String(r[pkScreen]));
    let ex=[];try{ex=await MESDB.table(opt.table).select(`select=${pkCol}&${pkCol}=in.${encodeURIComponent(inList(keys))}`)}catch(e){return []}
    const dup=new Set(ex.map(x=>String(x[pkCol])));if(!dup.size)return [];
    const done=[],hold=[];
    for(const r of rows){const k=String(r[pkScreen]);if(!dup.has(k))continue;
      const m=k.match(/^(.+-)(\d+)$/);
      if(!m){hold.push(k);continue}
      let more=[];try{more=await MESDB.table(opt.table).select(`select=${pkCol}&${pkCol}=like.${encodeURIComponent(m[1]+'*')}`)}catch(e){}
      let mx=0;const seen=[...more.map(x=>x[pkCol]),...arr().map(x=>x[pkScreen])];
      for(const v of seen){const s=String(v||'');if(s.startsWith(m[1])){const n=parseInt(s.slice(m[1].length),10);if(n>mx)mx=n}}
      const nk=m[1]+String(mx+1).padStart(m[2].length,'0');
      const el=document.getElementById(pkScreen);if(el&&el.value===k)el.value=nk;
      r[pkScreen]=nk;done.push(k+' → '+nk)}
    if(hold.length){const t='이미 등록된 번호입니다(다른 사용자가 먼저 저장): '+hold.join(', ')+' — 번호를 바꿔 다시 저장하세요.';
      badge('번호 중복','#c62828');if(window.MES?.setMessage)window.MES.setMessage(t);throw new Error(t)}
    return done}
  /* v55: 저장 후 DB 값(트리거 산출 컬럼)을 화면 행에 되돌려 넣는다 */
  async function refresh(keys){
    if(!keys.length)return false;
    let rows=[];try{rows=await MESDB.table(opt.table).select(`select=*&${pkCol}=in.${encodeURIComponent(inList(keys))}`)}catch(e){return false}
    let changed=false;
    for(const row of rows){const sc=toScreen(row,map);const r=arr().find(x=>key(x)===String(sc[pkScreen]));if(!r)continue;
      for(const k in sc){if(JSON.stringify(r[k])!==JSON.stringify(sc[k])){r[k]=sc[k];changed=true;
        const el=document.getElementById(k);
        if(el&&'value' in el&&el.tagName!=='BUTTON'&&document.getElementById(pkScreen)?.value===String(r[pkScreen]))el.value=sc[k]}}}
    if(changed){try{(opt.render||window.render||(()=>{}))()}catch(e){}}
    return changed}
  async function sync(){
    if(!online){                                          /* v56: 미연결이면 재접속 후 저장 */
      const ok=await load(true);
      if(!ok){badge('DB 미연결 - 저장 안 됨','#c62828');
        if(window.MES?.setMessage)window.MES.setMessage('DB 미연결: 저장되지 않았습니다. 로그인/네트워크 확인 후 다시 [저장]을 누르세요.');
        return}
    }
    const cur=arr(), curKeys=new Set(cur.map(key));
    const up=[], del=[];
    for(const r of cur){const k=key(r);if(!k)continue;if(snap.get(k)!==JSON.stringify(r))up.push(r)}
    for(const k of snap.keys())if(!curKeys.has(k))del.push(k);
    if(!up.length&&!del.length)return;
    selfAt=Date.now();                                     /* v72: 자동 통지가 자기 화면을 되읽지 않게 */
    try{
      const fresh=up.filter(r=>!snap.has(key(r)));
      const renamed=fresh.length?await renumber(fresh):[];
      const groups=new Map();
      for(const r of up){const prev=snap.has(key(r))?JSON.parse(snap.get(key(r))):null;
        const full=toDb(r,map);let cols;
        if(prev)cols=diffCols(r,prev);
        else cols=Object.keys(full).filter(c=>c===pkCol||full[c]!==null);
        if(prev&&cols.length===1)continue;                 /* 실제 변경 없음 */
        const o={};for(const c of cols)o[c]=full[c];
        const g=cols.slice().sort().join(',');if(!groups.has(g))groups.set(g,[]);groups.get(g).push(o)}
      for(const rows of groups.values())if(rows.length)await MESDB.table(opt.table).upsert(rows,pkCol);
      for(const k of del)await MESDB.table(opt.table).delete({[pkCol]:k});
      const back=await refresh(up.map(r=>String(r[pkScreen])));
      take();
      badge(`DB 반영 ${up.length?'저장'+up.length:''}${del.length?' 삭제'+del.length:''}${back?' · 갱신':''} · ${new Date().toLocaleTimeString('ko-KR')}`,'#2e7d32');
      /* v56: 안내문에도 DB 반영 결과를 붙여 저장 여부를 바로 알 수 있게 한다 */
      try{const m=document.getElementById('message');if(m&&m.textContent&&!/DB /.test(m.textContent))m.textContent+=` (DB 반영: ${up.length?'저장 '+up.length+'건':''}${del.length?' 삭제 '+del.length+'건':''})`}catch(e){}
      if(renamed.length&&window.MES?.setMessage)window.MES.setMessage('번호 중복으로 재부여: '+renamed.join(', '));
      /* v60: 기준정보에서 바꾼 내용을 다른 화면의 조회 팝업 캐시에 알린다 */
      selfAt=Date.now();
      try{window.MESDB.notify&&window.MESDB.notify([opt.table])}catch(e){}
      selfAt=Date.now();
    }catch(e){badge('DB 반영 실패','#c62828');console.warn('MESDB.master',e.message);
      if(window.MES?.setMessage)window.MES.setMessage('DB 반영 실패: '+e.message.slice(0,120));
      /* v55: 삭제가 거부된 행(FK 등)은 DB 에서 다시 읽어 화면과 맞춘다 */
      if(del.length){try{await reload()}catch(e2){}}}
  }
  /* v60: 다른 화면(조회 팝업 등)이 같은 테이블을 바꾸면 다시 읽어 화면을 맞춘다.
     snap 도 함께 갱신해야 이후 클릭 동기화가 되돌리기/재저장을 하지 않는다. */
  async function reload(){
    if(!online)return false;
    try{
      const rows=await MESDB.table(opt.table).select('select=*');
      const a=arr(); a.length=0; a.push(...rows.map(r=>toScreen(r,map)));
      try{(opt.render||window.render||(()=>{}))()}catch(e){console.warn('MESDB.master reload render',e.message)}
      take();
      badge(`DB 갱신: ${opt.table} ${rows.length}건`,'#2e7d32');
      return true;
    }catch(e){console.warn('MESDB.master reload',e.message);return false}
  }
  window.MESDB.reloadMaster=reload;
  let rtimer=null;
  try{window.MESDB.onChange&&window.MESDB.onChange([opt.table],()=>{
    if(Date.now()-selfAt<1500)return;                     /* 내가 낸 통지는 무시 (검색조건 유지) */
    clearTimeout(rtimer);rtimer=setTimeout(reload,200);   /* 연속 통지 묶기 */
  })}catch(e){}

  document.addEventListener('click',e=>{if(e.target.closest('button,[onclick]')){clearTimeout(timer);timer=setTimeout(sync,350)}},true);
  window.MESDB.syncMaster=sync;
}
window.MESDB.master=master;

/* v52: 화면 간 데이터 변경 알림.
   저장한 화면이 MESDB.notify(['테이블']) 를 호출하면, 같은 창(index.html)에 열린 다른 화면 중
   MESDB.onChange(['테이블'], fn) 으로 구독한 화면의 fn 이 호출된다. (현황 화면 자동 갱신용) */
function notify(tables){
  const list=Array.isArray(tables)?tables:[tables];
  const ev=new CustomEvent('mes-data-changed',{detail:{tables:list,at:Date.now()}});
  try{(window.parent&&window.parent!==window?window.parent:window).dispatchEvent(ev)}catch(e){window.dispatchEvent(ev)}
}
function onChange(tables,fn){
  const want=new Set(Array.isArray(tables)?tables:[tables]);
  const host=(()=>{try{return window.parent&&window.parent!==window?window.parent:window}catch(e){return window}})();
  const h=e=>{const t=(e.detail&&e.detail.tables)||[];if(t.some(x=>want.has(x))){try{fn(e.detail)}catch(err){console.warn('MESDB.onChange',err.message)}}};
  host.addEventListener('mes-data-changed',h);
  window.addEventListener('unload',()=>{try{host.removeEventListener('mes-data-changed',h)}catch(e){}});
}
window.MESDB.notify=notify; window.MESDB.onChange=onChange;
})();

/* ── v18: 발주→입고→입고확정 라인 (order_lines) ─────────────────────
 * MESDB.lines({page, category, statuses, map, get, render, pk:'_id'})
 *   order_lines 테이블에서 category/status로 필터해 화면 배열에 로드하고,
 *   화면에서 바뀐 행만 되돌려 쓴다. 신규 발주는 MESDB.newLines()로 insert.
 */
(function(){
const N=m=>{const o={};for(const k in m){const v=m[k];o[k]=typeof v==='string'?{col:v,type:'text'}:{type:'text',...v}}return o};
const S2D={'대기':'발주','발주':'발주','입고':'입고','확정':'입고확정','입고확정':'입고확정'};
const D2S={'발주':'대기','입고':'입고','입고확정':'확정'};
const toS=(row,map)=>{const o={_id:row.line_id};for(const k in map){const{col,type}=map[k];let v=row[col];
  if(type==='num')v=(v===null||v===undefined?'':Number(v));
  else if(type==='date')v=(v?String(v).slice(0,10):'');
  else if(type==='status')v=D2S[v]||v||'대기';
  else v=(v===null||v===undefined?'':String(v));o[k]=v}return o};
const toD=(row,map)=>{const o={};for(const k in map){const{col,type}=map[k];let v=row[k];
  if(col==='line_id')continue;
  if(type==='num'){v=(v===''||v===null||v===undefined)?null:Number(v);if(Number.isNaN(v))v=null}
  else if(type==='date'){v=(v&&v!=='null'&&v!=='undefined')?String(v).slice(0,10):null;if(v&&!/^\d{4}-\d{2}-\d{2}$/.test(v))v=null}
  else if(type==='status')v=S2D[v]||'발주';
  else v=(v===''||v===undefined||v===null)?null:String(v);o[col]=v}return o};
const badge=(t,c)=>window.__mesBadge(t,c);

async function lines(opt){
  window.__mesdbBound=1;
  const map=N(opt.map);let snap=new Map(),online=false,timer=null;
  const arr=()=>opt.get();
  const q=['select=*','order=line_id',`category=eq.${encodeURIComponent(opt.category)}`];
  if(opt.statuses&&opt.statuses.length)q.push(`status=in.(${opt.statuses.map(encodeURIComponent).join(',')})`);
  const take=()=>{snap=new Map(arr().filter(r=>r._id).map(r=>[r._id,JSON.stringify(r)]))};
  try{
    const rows=await MESDB.table('order_lines').select(q.join('&'));
    const a=arr();a.length=0;a.push(...rows.map(r=>toS(r,map)));
    online=true;
    /* v39: 화면 렌더 오류가 DB 연결 상태까지 죽이지 않도록 격리한다.
       (이전에는 render 예외 → catch → online=false → syncLines 미등록 → 저장 불능) */
    try{(opt.render||window.render||(()=>{}))()}catch(e){console.warn('MESDB.lines render',e.message);
      badge('화면 표시 오류(자료는 정상 로드)','#f57c00')}
    take();
    badge(`DB: order_lines ${opt.category} ${rows.length}건`,'#2e7d32');window.__mesdbReady&&window.__mesdbReady();
  }catch(e){online=false;badge('DB 미연결(로컬)','#9e9e9e');console.warn('MESDB.lines',e.message);window.__mesdbReady&&window.__mesdbReady();return}

  async function sync(){
    if(!online)return;
    const cur=arr(),up=[],ins=[];
    for(const r of cur){
      if(!r._id){ins.push({...toD(r,map),category:opt.category,status:r.status||'발주'});continue}
      if(snap.get(r._id)!==JSON.stringify(r))up.push({line_id:r._id,...toD(r,map),updated_at:new Date().toISOString()});
    }
    if(!up.length&&!ins.length)return;
    try{
      if(up.length)await MESDB.table('order_lines').upsert(up,'line_id');
      if(ins.length)await MESDB.table('order_lines').upsert(ins);
      take();
      badge(`DB 반영 ${up.length+ins.length}건 · ${new Date().toLocaleTimeString('ko-KR')}`,'#2e7d32');
    }catch(e){badge('DB 반영 실패','#c62828');console.warn('MESDB.lines',e.message);
      if(window.MES?.setMessage)window.MES.setMessage('DB 반영 실패: '+e.message.slice(0,120))}
  }
  document.addEventListener('click',e=>{if(e.target.closest('button,[onclick]')){clearTimeout(timer);timer=setTimeout(sync,350)}},true);
  document.addEventListener('change',()=>{clearTimeout(timer);timer=setTimeout(sync,350)},true);
  window.MESDB.syncLines=sync;
}
/* v26: 발주취소 등 라인 삭제 (화면 배열에서만 지우고 DB에 남던 문제 수정) */
async function delLines(ids){
  const list=[].concat(ids||[]).map(Number).filter(n=>!Number.isNaN(n));
  if(!list.length)return 0;
  for(const id of list)await MESDB.table('order_lines').delete({line_id:id});
  badge(`DB 발주취소 ${list.length}건 삭제`,'#c62828');return list.length;
}
window.MESDB.delLines=delLines;
/* 발주등록 화면용: 신규 발주 라인 insert */
/* v34: order_lines 는 part_no→parts, material→materials, vendor_name→vendors FK 를 가진다.
   PartList/발주 화면에서 입력한 신규 품번·재질이 마스터에 없으면 저장이 통째로 실패하므로,
   자식 행을 버리지 않고 부모(마스터) 행을 먼저 만들어 준다. */
async function ensureRefs(rows){
  const created=[];
  const specs=[
    {col:'part_no',  table:'parts',     key:'part_code',    name:'part_name',    label:'품번'},
    {col:'material', table:'materials', key:'material_code',name:'material_name',label:'재질'},
  ];
  for(const s of specs){
    const vals=[...new Set(rows.map(r=>r[s.col]).filter(v=>v!==null&&v!==undefined&&String(v).trim()!==''))];
    if(!vals.length)continue;
    const inList='('+vals.map(v=>'"'+String(v).replace(/"/g,'')+'"').join(',')+')';
    let ex=[];
    try{ex=await MESDB.table(s.table).select(`select=${s.key}&${s.key}=in.${encodeURIComponent(inList)}`)}catch(e){continue}
    const have=new Set(ex.map(x=>x[s.key]));
    const miss=vals.filter(v=>!have.has(v));
    if(!miss.length)continue;
    const add=miss.map(v=>{
      const src=rows.find(r=>r[s.col]===v)||{};
      const o={};o[s.key]=v;o[s.name]=src.part_name||src[s.col]||v;o.remark='발주등록 시 자동 생성';return o});
    try{await MESDB.table(s.table).upsert(add,s.key);created.push(`${s.label} ${miss.length}건`)}catch(e){}
  }
  if(created.length)badge('마스터 자동 등록: '+created.join(' / '),'#f57c00');
  return created;
}
async function newLines(rows){
  if(!rows||!rows.length)return 0;
  await ensureRefs(rows);
  await MESDB.table('order_lines').upsert(rows);
  badge(`DB 발주 ${rows.length}건 등록`,'#2e7d32');return rows.length;
}
window.MESDB.lines=lines;window.MESDB.newLines=newLines;window.MESDB.ensureRefs=ensureRefs;
})();