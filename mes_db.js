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

const MES_VER='v75';window.MES_VER=MES_VER;
const CFG={url:'https://ipggvrzxfcryzryileuv.supabase.co',key:'sb_publishable_CHO-dAOU00HNwno52255mg_H3C1_vew'};
/* v117: DB 에 아직 없는 컬럼 하나 때문에 저장 전체가 실패하지 않게 한다.
   PostgREST 가 PGRST204(해당 컬럼 없음)로 거절하면 그 컬럼만 빼고 다시 보낸다.
   (예: 새 Supabase 로 옮길 때 order_lines.reorder_reason 가 빠진 경우)
   빠진 컬럼은 배지와 에러로그에 남기므로, DB 에 컬럼을 추가하면 원래대로 저장된다. */
const MISSINGCOL=new Set();
/* 없는 컬럼 오류(PGRST204)면 그 컬럼을 뺀 행 목록을 돌려주고, 아니면 null */
function stripMissing(name,e,rows){
  const m=String(e&&e.message||e);
  const col=(m.match(/Could not find the '([^']+)' column/)||[])[1];
  if(!col)return null;
  const k=name+'.'+col;
  if(!MISSINGCOL.has(k)){MISSINGCOL.add(k);
    try{badge(`DB 에 ${name}.${col} 컬럼이 없어 그 값은 빼고 저장합니다 — SQL 실행이 필요합니다`,'#f57c00')}catch(_){}
    ELOG.push({level:'WARN',message:`컬럼 없음: ${name}.${col} — 이 값을 빼고 저장했습니다`,source:'POST '+name,detail:m.slice(0,1000)});}
  const a=rows.map(r=>{const o={...r};delete o[col];return o});
  return (a.length&&Object.keys(a[0]).length)?a:null;
}
async function sendRows(name,path,rows,headers){
  let a=rows;
  for(let i=0;i<40;i++){                       /* v168: 새 화면은 빠진 컬럼이 20개도 넘을 수 있다 */
    try{return await rest(path,{method:'POST',headers,body:JSON.stringify(a)})}
    catch(e){const b=stripMissing(name,e,a);if(!b)throw e;a=b}
  }
  throw new Error('저장 실패: 없는 컬럼이 계속 나옵니다. 기준정보 › 에러로그를 확인하세요.');
}
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
  online=true;   /* v72(MES): 실제 요청이 성공했으면 연결 상태로 본다 (첫 ping 실패로 화면 전체가 미연결로 남던 문제) */
  const t=await r.text();return t?JSON.parse(t):null}
/* v72: 쓰기가 끝나면 해당 테이블 변경을 자동으로 알린다.
 * 화면마다 MESDB.notify() 를 직접 부르게 했더니 빠뜨린 화면이 많아
 * (예: 외주설계 입고 → 금형진척현황이 5분 뒤에야 갱신) 여기서 일괄 처리한다.
 * 화면이 직접 부르는 notify 와 겹쳐도 무해하다. */
const autoNotify=(name,p)=>p.then(r=>{try{window.MESDB.notify&&window.MESDB.notify([name])}catch(e){}return r});
const table=name=>({
  select:(q='select=*',o)=>{if(o&&o.fresh)xdrop(name);return rest(`${name}?${q}`)},
  upsert:(rows,onConflict)=>{const a=Array.isArray(rows)?rows:[rows];const keys=[];for(const r of a)for(const k in r)if(!keys.includes(k))keys.push(k);
    const norm=a.map(r=>{const o={};for(const k of keys)o[k]=(r[k]===undefined?null:r[k]);return o});
    return autoNotify(name,sendRows(name,`${name}${onConflict?'?on_conflict='+onConflict:''}`,norm,{'Prefer':'resolution=merge-duplicates,return=minimal'}))},
  /* v171: 조건에 맞는 행만 PATCH (기본키가 아닌 열로 고칠 때 — upsert 의 on_conflict 제약 불필요) */
  update:(match,patch)=>autoNotify(name,rest(`${name}?`+Object.entries(match).map(([k,v])=>`${k}=eq.${encodeURIComponent(v)}`).join('&'),{method:'PATCH',headers:{'Prefer':'return=minimal','Content-Type':'application/json'},body:JSON.stringify(patch)})),
  delete:(match)=>autoNotify(name,rest(`${name}?`+Object.entries(match).map(([k,v])=>`${k}=eq.${encodeURIComponent(v)}`).join('&'),{method:'DELETE',headers:{'Prefer':'return=minimal'}})),
  /* v39: identity 채번 컬럼을 DB에 맡기고 생성된 행을 돌려받는다.
     (화면에서 max+1 로 직접 채번하면 동시 저장 시 PK 가 충돌한다) */
  insertOne:async(row)=>{
    /* v168: upsert 와 같이, DB 에 아직 없는 컬럼은 빼고 다시 보낸다 (PGRST204) */
    let a=[row],r=null;
    for(let i=0;i<40;i++){
      try{r=await rest(`${name}?select=*`,{method:'POST',headers:{'Prefer':'return=representation'},body:JSON.stringify(a)});break}
      catch(e){const b=stripMissing(name,e,a);if(!b)throw e;a=b}
    }
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
/* v119: 제작계획(sales_plans)의 설계/조립 외주 여부를 발주 화면이 기록한다.
   (회의록 2-2 — 제작계획등록에서 설계외주·조립외주 입력 항목 삭제)
   kind: 'design' → order_lines(category=외주설계) 존재 여부, 'assembly' → set_order_lines 존재 여부.
   계획 행이 없으면 아무 것도 하지 않는다. 실패해도 발주 처리를 막지 않는다. */
/* ── v120 (회의록 1-1): 관리제번 / 공정 분리 ─────────────────────────────
 * 제번(job_no) '26IPA001A' = 관리제번 '26IPA001' + 공정 'A'.
 * 규칙: 마지막 한 글자가 대문자 A~Z 이고 그 앞이 숫자로 끝나면 공정으로 본다.
 *       (J26137, PT005 처럼 숫자로 끝나면 공정 없음 → 관리제번 = 제번)
 * DB 키(job_no)는 그대로 두고, 화면과 집계에서 이 두 값을 함께 쓴다.
 * SQL 로 jobs / sale_orders 에 같은 규칙의 생성 컬럼(base_job, process_seq)을 두면 리포트에서도 쓸 수 있다. */
const JOB_SEQ_RE=/^(.*\d)([A-Z])$/;
/* ── v159 부품 이미지 (회의록 외 · 제품관리 시트의 3D 그림) ─────────────────
 * Supabase Storage 버킷 mes-attach 에 parts/<제번>/<품번>_<시각>.<확장자> 로 올린다.
 * partlist_materials / partlist_purchases 의 image_url 컬럼에 공개 URL 을 저장한다.
 *   MESDB.imgUpload(file, job, part)  → 공개 URL
 *   MESDB.partImages(job)             → {품번: URL}
 *   MESDB.imgBox(url, size)           → 썸네일 HTML (클릭하면 새 창) */
const IMG_BUCKET='mes-attach';
function sbToken(){try{return (window.MES_AUTH||window.parent.MES_AUTH)?.token||null}catch(e){return null}}
MESDB.imgUrl=p=>CFG.url+'/storage/v1/object/public/'+IMG_BUCKET+'/'+String(p).split('/').map(encodeURIComponent).join('/');
MESDB.imgUpload=async function(file,job,part){
  if(!file)throw new Error('파일이 없습니다.');
  if(!/^image\//.test(file.type||''))throw new Error('이미지 파일만 올릴 수 있습니다.');
  if(file.size>8*1024*1024)throw new Error('이미지가 너무 큽니다 (8MB 이하).');
  const ext=(file.name.split('.').pop()||'png').toLowerCase().replace(/[^a-z0-9]/g,'');
  const safe=String(part||'part').replace(/[^\w.\-가-힣]/g,'_');
  const path='parts/'+String(job||'공통').replace(/[^\w.\-가-힣]/g,'_')+'/'+safe+'_'+Date.now()+'.'+ext;
  const tok=sbToken();
  const r=await fetch(CFG.url+'/storage/v1/object/'+IMG_BUCKET+'/'+path.split('/').map(encodeURIComponent).join('/'),
    {method:'POST',headers:{'apikey':CFG.key,'Authorization':'Bearer '+(tok||CFG.key),
      'Content-Type':file.type||'application/octet-stream','x-upsert':'true'},body:file});
  if(!r.ok){const t=await r.text();throw new Error((tok?'':'로그인 후 이미지를 올릴 수 있습니다. ')+t.slice(0,120))}
  /* v196: 목록용 미리보기(긴 변 240px JPEG, 약 10KB)를 같은 경로 + ".t.jpg" 로 함께 올린다.
     실패해도 원본 등록은 그대로 — 목록은 미리보기가 없으면 원본을 보여준다. */
  try{const tb=await thumbBlob(file,240);
    if(tb)await fetch(CFG.url+'/storage/v1/object/'+IMG_BUCKET+'/'+(path+THUMB_EXT).split('/').map(encodeURIComponent).join('/'),
      {method:'POST',headers:{'apikey':CFG.key,'Authorization':'Bearer '+(tok||CFG.key),'Content-Type':'image/jpeg','x-upsert':'true'},body:tb});
  }catch(e){}
  return MESDB.imgUrl(path);
};
const THUMB_EXT='.t.jpg';
function thumbBlob(file,max){return new Promise(res=>{const u=URL.createObjectURL(file),im=new Image();
  im.onload=()=>{try{const s=Math.min(1,max/Math.max(im.width,im.height)),w=Math.max(1,Math.round(im.width*s)),h=Math.max(1,Math.round(im.height*s));
    const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);
    x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(im,0,0,w,h);
    c.toBlob(b=>{URL.revokeObjectURL(u);res(b)},'image/jpeg',.82)}catch(e){URL.revokeObjectURL(u);res(null)}};
  im.onerror=()=>{URL.revokeObjectURL(u);res(null)};im.src=u})}
/* v196: 부품 그림 URL → 목록용 미리보기 URL (mes-attach 공개 그림만. 그 밖은 그대로) */
MESDB.thumbUrl=function(url){const u=String(url||'');
  return u&&u.includes('/storage/v1/object/public/'+IMG_BUCKET+'/')&&!u.endsWith(THUMB_EXT)?u+THUMB_EXT:u};
/* v196: 부품 그림 파일 지우기 — 원본 + 미리보기(.t.jpg).
 *   같은 그림을 다른 행(다른 제번으로 복사된 PartList, 제작계획 제품그림)이 아직 쓰고 있으면 파일은 남긴다.
 *   DB 의 image_url 을 먼저 비운 뒤 부른다. 조회가 실패하면 안전하게 지우지 않는다. → true(지움)/false(남김) */
MESDB.imgDelete=async function(url){
  const u=String(url||''),key='/storage/v1/object/public/'+IMG_BUCKET+'/';
  const i=u.indexOf(key);if(i<0)return false;
  const path=u.slice(i+key.length).split('?')[0].split('/').map(decodeURIComponent).join('/');
  const base=path.endsWith(THUMB_EXT)?path.slice(0,-THUMB_EXT.length):path,full=MESDB.imgUrl(base);
  for(const t of ['partlist_materials','partlist_purchases','sales_plans']){
    try{const rs=await rest_(`${t}?select=image_url&image_url=eq.${encodeURIComponent(full)}&limit=1`);if(rs&&rs.length)return false}   /* 캐시 없이 */
    catch(e){return false}
  }
  const tok=sbToken();
  const r=await fetch(CFG.url+'/storage/v1/object/'+IMG_BUCKET,{method:'DELETE',
    headers:{'apikey':CFG.key,'Authorization':'Bearer '+(tok||CFG.key),'Content-Type':'application/json'},
    body:JSON.stringify({prefixes:[base,base+THUMB_EXT]})});
  return r.ok;
};
/* 미리보기가 없는 옛 그림은 원본으로 한 번만 바꿔 보여준다 (<img onerror>) */
MESDB.thumbFallback=function(img){const f=img&&img.getAttribute('data-full');if(f&&img.src!==f){img.removeAttribute('data-full');img.src=f}};
MESDB.partImages=async function(job){
  const out={};if(!job||!online)return out;
  const q=`select=part_no,image_url&job_no=eq.${encodeURIComponent(job)}`;
  for(const t of ['partlist_materials','partlist_purchases']){
    try{(await rest(t+'?'+q)||[]).forEach(r=>{if(r.image_url)out[r.part_no]=r.image_url})}catch(e){}
  }
  return out;
};
/* ── v160 도면 보관 (Supabase 비공개 버킷) ─────────────────────────────
 * 도면 PDF 를 mes-drawing(비공개) 에 올리고, drawings.file_url 에 "sb:<경로>" 로 적는다.
 * 열 때마다 5분짜리 서명 URL 을 새로 받으므로 로그인한 사용자만 볼 수 있다.
 *   MESDB.pdfShrink(file, maxKB, onStep) → 0.5MB 이하로 줄인 PDF(Blob)
 *   MESDB.drawingUpload(file, {job,part,dno}) → "sb:<경로>"
 *   MESDB.signedUrl(ref, sec)  → 임시 주소
 *   MESDB.openRef(ref)         → 팝업으로 열기 (http/sb/사내경로 모두 처리) */
const DRW_BUCKET='mes-drawing';
const isRef=u=>/^sb:/i.test(String(u||'').trim());
function libLoad(src,test){return new Promise((res,rej)=>{if(test())return res();
  const s=document.createElement('script');s.src=src;s.onload=()=>test()?res():rej(new Error('라이브러리 로드 실패'));
  s.onerror=()=>rej(new Error('인터넷 연결이 필요합니다 (압축 라이브러리).'));document.head.appendChild(s)})}
async function pdfLibs(){
  await libLoad('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',()=>window.pdfjsLib);
  try{window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'}catch(e){}
  await libLoad('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',()=>window.jspdf&&window.jspdf.jsPDF);
}
async function pdfRender(pdf,scale,q,onStep){
  const {jsPDF}=window.jspdf;let doc=null;
  for(let i=1;i<=pdf.numPages;i++){
    onStep&&onStep(`압축 중… ${i}/${pdf.numPages}쪽`);
    const pg=await pdf.getPage(i),v0=pg.getViewport({scale:1}),vp=pg.getViewport({scale});
    const cv=document.createElement('canvas');cv.width=Math.max(1,Math.ceil(vp.width));cv.height=Math.max(1,Math.ceil(vp.height));
    const cx=cv.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,cv.width,cv.height);
    await pg.render({canvasContext:cx,viewport:vp}).promise;
    const img=cv.toDataURL('image/jpeg',q),w=v0.width,h=v0.height,or=w>h?'l':'p';
    if(!doc)doc=new jsPDF({orientation:or,unit:'pt',format:[w,h],compress:true});
    else doc.addPage([w,h],or);
    doc.addImage(img,'JPEG',0,0,w,h);
    cv.width=cv.height=0;
  }
  return doc?doc.output('blob'):null;
}
MESDB.pdfShrink=async function(file,maxKB,onStep){
  const max=(maxKB||500)*1024;
  if(!file)throw new Error('파일이 없습니다.');
  if(file.size<=max)return file;
  if(!/pdf/i.test(file.type||'')&&!/\.pdf$/i.test(file.name||''))
    throw new Error(`PDF 만 자동 압축합니다. 현재 ${(file.size/1048576).toFixed(1)}MB — PDF 로 저장해 다시 올려 주세요.`);
  await pdfLibs();
  const buf=await file.arrayBuffer();
  const pdf=await window.pdfjsLib.getDocument({data:buf}).promise;
  const steps=[[2.0,.72],[1.6,.62],[1.3,.55],[1.05,.48],[.85,.4],[.7,.34]];
  let best=null;
  for(const [sc,q] of steps){
    const b=await pdfRender(pdf,sc,q,onStep);
    if(!b)break;
    if(!best||b.size<best.size)best=b;
    if(b.size<=max){best=b;break}
  }
  if(!best)throw new Error('압축에 실패했습니다.');
  return new File([best],String(file.name||'drawing.pdf').replace(/\.[^.]+$/,'')+'.pdf',{type:'application/pdf'});
};
MESDB.drawingUpload=async function(file,o){
  o=o||{};
  if(!file)throw new Error('파일이 없습니다.');
  const tok=sbToken();if(!tok)throw new Error('로그인 후 도면을 올릴 수 있습니다.');
  if(file.size>20*1024*1024)throw new Error('파일이 너무 큽니다 (20MB 이하).');
  const ext=(String(file.name||'').split('.').pop()||'pdf').toLowerCase().replace(/[^a-z0-9]/g,'')||'pdf';
  const safe=s=>String(s||'').replace(/[^\w.\-가-힣]/g,'_');
  const path='dwg/'+safe(o.job||'공통')+'/'+safe(o.dno||o.part||'도면')+'_'+Date.now()+'.'+ext;
  const r=await fetch(CFG.url+'/storage/v1/object/'+DRW_BUCKET+'/'+path.split('/').map(encodeURIComponent).join('/'),
    {method:'POST',headers:{'apikey':CFG.key,'Authorization':'Bearer '+tok,
      'Content-Type':file.type||'application/pdf','x-upsert':'true'},body:file});
  if(!r.ok)throw new Error((await r.text()).slice(0,140));
  return 'sb:'+path;
};
MESDB.signedUrl=async function(ref,sec){
  const path=String(ref||'').trim().replace(/^sb:/i,'');
  if(!path)throw new Error('도면 경로가 비어 있습니다.');
  const tok=sbToken();if(!tok)throw new Error('로그인 후 도면을 볼 수 있습니다.');
  const r=await fetch(CFG.url+'/storage/v1/object/sign/'+DRW_BUCKET+'/'+path.split('/').map(encodeURIComponent).join('/'),
    {method:'POST',headers:{'apikey':CFG.key,'Authorization':'Bearer '+tok,'Content-Type':'application/json'},
     body:JSON.stringify({expiresIn:sec||300})});
  if(!r.ok)throw new Error((await r.text()).slice(0,140));
  const j=await r.json(),u=j.signedURL||j.signedUrl||'';
  return /^https?:/i.test(u)?u:CFG.url+'/storage/v1'+(u.startsWith('/')?'':'/')+u;
};
MESDB.openRef=async function(ref,say){
  const u=String(ref||'').trim();
  if(!u){say&&say('파일 위치가 비어 있습니다.');return false}
  if(/^https?:\/\//i.test(u)){window.open(u,'_blank');return true}
  if(isRef(u)){
    const w=window.open('','_blank');           /* 팝업 차단 회피 — 먼저 창을 연다 */
    try{const s=await MESDB.signedUrl(u,300);if(w)w.location=s;else window.open(s,'_blank');return true}
    catch(e){if(w)w.close();say&&say('도면 열기 실패: '+String(e.message||e).slice(0,120));return false}
  }
  try{await navigator.clipboard.writeText(u)}catch(e){}
  say&&say('사내 서버 경로를 복사했습니다. 탐색기 주소창에 붙여넣으세요.');
  return true;
};
/* v159: 부품 메타(이미지·형태) — 키는 "제번|품번". job 생략 시 전체 */
MESDB.partMeta=async function(job){
  const out={};if(!online)return out;
  const f=job?`&job_no=eq.${encodeURIComponent(job)}`:'';
  const src=[['partlist_materials','select=job_no,part_no,image_url,shape'],
             ['partlist_purchases','select=job_no,part_no,image_url']];
  for(const [t,sel] of src){
    try{(await rest(t+'?'+sel+f)||[]).forEach(r=>{
      if(!r.image_url&&!r.shape)return;
      out[String(r.job_no||'')+'|'+String(r.part_no||'')]={image_url:r.image_url||'',shape:r.shape||''};
    })}catch(e){}
  }
  return out;
};
MESDB.imgBox=function(url,size){
  if(!url)return '';
  const s=size||28;
  const q=v=>String(v).replace(/"/g,'&quot;'),full=q(url);   /* v196: 목록엔 미리보기, 클릭하면 원본 */
  return `<img src="${q(MESDB.thumbUrl(url))}" data-full="${full}" loading="lazy" onerror="MESDB.thumbFallback(this)" style="width:${s}px;height:${s}px;object-fit:cover;border:1px solid #c5d0d8;border-radius:3px;cursor:zoom-in;vertical-align:middle" `+
   `data-u="${full}" onclick="event.stopPropagation();window.open(this.dataset.u,'_blank')" title="클릭하면 큰 그림으로 봅니다">`;
};
MESDB.jobSplit=function(job){
  const j=String(job||'').trim();const m=JOB_SEQ_RE.exec(j);
  return m?{job:j,base:m[1],seq:m[2]}:{job:j,base:j,seq:''};
};
MESDB.jobJoin=function(base,seq){
  base=String(base||'').trim().toUpperCase();seq=String(seq||'').trim().toUpperCase();
  return base+(seq&&/^[A-Z]$/.test(seq)?seq:'');
};
/* 여러 행을 관리제번으로 묶는다. rows[].job_no 필요. 반환: [{base, jobs:[row...], seqs:['A','B']}] (관리제번 순) */
MESDB.jobGroup=function(rows){
  const mp=new Map();
  (rows||[]).forEach(r=>{const s=MESDB.jobSplit(r.job_no);let g=mp.get(s.base);if(!g){g={base:s.base,jobs:[],seqs:[]};mp.set(s.base,g)}g.jobs.push(r);if(s.seq)g.seqs.push(s.seq)});
  const out=[...mp.values()];out.forEach(g=>g.seqs.sort());
  return out.sort((a,b)=>String(a.base).localeCompare(String(b.base)));
};
/* ── v121 공통 마스터 헬퍼 (회의록 1-4 · 3-1 · 3-2 · 4-2) ───────────────────
 * procCategories(): 공정카테고리 목록 [{code,name}] — process_categories 테이블, 없으면 기본 목록
 * laborRate(type,key): 작업단가(원/h) — labor_rates 테이블, 없으면 30,000
 * openDrawing(part_no, job_no): drawings 에서 품번의 도면을 찾아 file_url 을 연다 */
const DEF_CATS=[['BLK','블랭킹'],['DRW','드로잉'],['TRM','트리밍'],['PRC','피어싱'],['BND','벤딩'],['FRM','포밍'],['FLG','플랜징'],['CAM','캠'],['CMP','복합']];
let _cats=null,_rates=null;
MESDB.procCategories=async function(){
  if(_cats)return _cats;
  try{if(online){const rs=await rest('process_categories?select=category_code,category_name,sort_order&order=sort_order,category_code');
    if(rs&&rs.length){_cats=rs.map(r=>({code:r.category_code,name:r.category_name}));return _cats}}}catch(e){}
  _cats=DEF_CATS.map(([code,name])=>({code,name}));return _cats;
};
/* v165: 단가는 기준정보 › 단가관리 › 작업단가(labor_rates) 에서 가져온다.
   key 는 하나 또는 여러 개(예: [설비코드, 공정코드])를 줄 수 있고 앞의 것부터 찾는다.
   어디서 온 단가인지 알아야 하는 화면은 laborRateInfo() 를 쓴다. */
MESDB.laborRateInfo=async function(type,key){
  try{if(_rates==null&&online){const rs=await rest('labor_rates?select=rate_code,rate_type,rate_per_hour');_rates=rs||[]}}catch(e){_rates=[]}
  const rs=_rates||[];
  const keys=(Array.isArray(key)?key:[key]).map(k=>String(k||'').trim()).filter(Boolean);
  for(const k of keys){
    const hit=rs.find(r=>String(r.rate_code)===k);
    if(hit&&Number(hit.rate_per_hour)>0)return {rate:Number(hit.rate_per_hour),code:k,source:'작업단가'};
  }
  const common=type==='조립'?'ASM':(type==='검사'?'INS':(type==='설계'?'DSN':'MCH'));   /* v169: 검사 공통 INS */
  const c=rs.find(r=>String(r.rate_code)===common);
  if(c&&Number(c.rate_per_hour)>0)return {rate:Number(c.rate_per_hour),code:common,source:'작업단가(공통)'};
  const t=rs.find(r=>r.rate_type===type&&Number(r.rate_per_hour)>0);
  if(t)return {rate:Number(t.rate_per_hour),code:String(t.rate_code||''),source:'작업단가'};
  return {rate:30000,code:'',source:'미등록(기본값)'};
};
MESDB.laborRate=async function(type,key){return (await MESDB.laborRateInfo(type,key)).rate};
MESDB.laborRateList=async function(type){await MESDB.laborRate(type);return (_rates||[]).filter(r=>!type||r.rate_type===type)};
try{if(typeof onChange==='function'){onChange(['process_categories'],()=>{_cats=null});onChange(['labor_rates'],()=>{_rates=null})}}catch(e){}
MESDB.openDrawing=async function(part,job){
  part=String(part||'').trim();if(!part)return false;
  if(!online){alert('DB 미연결 상태에서는 도면을 찾을 수 없습니다.');return false}
  let rs=[];
  try{rs=await rest(`drawings?select=drawing_no,drawing_name,file_url,current_rev,job_no,drawing_status&part_no=eq.${encodeURIComponent(part)}&order=rev_date.desc.nullslast`)}catch(e){}
  rs=(rs||[]).filter(r=>r.drawing_status!=='폐기');
  let r=job?rs.find(x=>x.job_no===job):null;if(!r)r=rs[0];
  if(!r){alert(`품번 ${part} 의 도면이 등록되어 있지 않습니다.\nSQ › 문서/도면 › 도면등록에서 품번과 파일 위치(사내 서버 주소)를 등록하세요.`);return false}
  const u=String(r.file_url||'').trim();
  if(!u){alert(`도면 ${r.drawing_no} 에 파일 위치가 비어 있습니다. 도면등록에서 도면 파일을 올리거나 사내 서버 주소를 넣어 주세요.`);return false}
  /* v160: sb:경로 = Supabase 비공개 보관 → 5분짜리 임시 주소로 연다 */
  if(isRef(u)){
    const w=window.open('','_blank');
    try{const sg=await MESDB.signedUrl(u,300);if(w)w.location=sg;else window.open(sg,'_blank');return true}
    catch(e){if(w)w.close();alert('도면 열기 실패: '+String(e.message||e).slice(0,140));return false}
  }
  if(/^https?:\/\//i.test(u)){window.open(u,'_blank');return true}
  /* 사내 서버 경로(\\server\... 또는 file://) 는 웹 화면에서 직접 열 수 없다 → 경로를 복사해 준다 */
  try{await navigator.clipboard.writeText(u)}catch(e){}
  alert(`도면 ${r.drawing_no} (${r.drawing_name||''}) Rev.${r.current_rev||'-'}\n\n사내 서버 경로를 복사했습니다. 탐색기 주소창에 붙여넣기(Ctrl+V) 하세요.\n${u}\n\n(웹 화면에서 바로 열려면 도면 파일을 사내 웹 공유(http://…)로 두고 그 주소를 등록합니다)`);
  return true;
};
MESDB.syncPlanOut=async function(job,kind){
  try{
    job=String(job||'').trim();if(!job||!online)return;
    const q=encodeURIComponent(job);
    const pl=await rest(`sales_plans?select=row_no&job_no=eq.${q}&limit=1`);
    if(!pl||!pl[0])return;
    let rows=[],vendor=null;
    if(kind==='design'){rows=await rest(`order_lines?select=vendor_name&category=eq.%EC%99%B8%EC%A3%BC%EC%84%A4%EA%B3%84&job_no=eq.${q}&order=line_id`);vendor=rows[0]&&rows[0].vendor_name||null}
    /* v230: SET외주(order_lines category=외주SET) → 제작계획의 조립(assembly) 외주 여부로 기록 */
    else if(kind==='set'){kind='assembly';rows=await rest(`order_lines?select=vendor_name&category=eq.${encodeURIComponent('외주SET')}&job_no=eq.${q}&order=line_id`);vendor=rows[0]&&rows[0].vendor_name||null}
    else{rows=await rest(`set_order_lines?select=partner_vendor_name&job_no=eq.${q}&order=line_id`);vendor=rows[0]&&rows[0].partner_vendor_name||null}
    const on=rows.length>0;
    const body={row_no:Number(pl[0].row_no)};
    body[kind+'_outsourced']=on;body[kind+'_vendor']=on?vendor:null;
    await table('sales_plans').upsert(body,'row_no');
    try{notify(['sales_plans'])}catch(e){}
  }catch(e){try{ELOG.push({level:'WARN',message:'제작계획 외주여부 동기화 실패: '+String(e.message||e).slice(0,200),source:'syncPlanOut '+kind})}catch(_){}}
};
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
/* v72(MES): 첫 연결 확인 — 로그인 토큰이 아직 없으면 잠깐 기다리고, 실패해도 몇 번 더 시도한다.
 * (종전엔 화면이 열리는 순간 한 번만 ping → 토큰 준비 전이거나 잠깐 끊기면 그 화면은 끝까지 '미연결') */
MESDB.ping=async()=>{const sl=ms=>new Promise(r=>setTimeout(r,ms));
  for(let i=0;i<7;i++){
    if(!tok()&&i<4){await sl(300);continue}
    try{await rest('page_state?select=page&limit=1');online=true;return true}
    catch(e){online=false;if(i<6)await sl(400*(i+1))}
  }return online};MESDB.ready=MESDB.ping();
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
/* v73: 화면이 REST 를 거치지 않고(직접 fetch·RPC) 자료를 바꿨을 때 조회 캐시를 비우는 통로 */
window.MESDB.dropCache=t=>{try{xdrop(t||'rpc')}catch(e){}};
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
  /* v88: 최초 로드와 재조회를 같은 함수로. 화면이 열려 있는 동안 다른 화면에서 생긴
     발주/입고를 [조회] 나 mes-data-changed 알림으로 즉시 다시 읽어온다. */
  let loading=false;
  async function load(){
    if(loading)return -2;                      /* v92: 재진입 차단 (렌더 콜백이 다시 조회를 부르는 경우) */
    loading=true;
    try{
      const rows=await MESDB.table('order_lines').select(q.join('&'),{fresh:true});   /* v73: [조회]·자동갱신은 캐시를 건너뛴다 */
      const a=arr();a.length=0;a.push(...rows.map(r=>toS(r,map)));
      online=true;
      /* v39: 화면 렌더 오류가 DB 연결 상태까지 죽이지 않도록 격리한다.
         (이전에는 render 예외 → catch → online=false → syncLines 미등록 → 저장 불능) */
      try{(opt.render||window.render||(()=>{}))()}catch(e){console.warn('MESDB.lines render',e.message);
        badge('화면 표시 오류(자료는 정상 로드)','#f57c00')}
      take();
      badge(`DB: order_lines ${opt.category} ${rows.length}건`,'#2e7d32');window.__mesdbReady&&window.__mesdbReady();
      return rows.length;
    }catch(e){online=false;badge('DB 미연결(로컬)','#9e9e9e');console.warn('MESDB.lines',e.message);window.__mesdbReady&&window.__mesdbReady();return -1}
    finally{loading=false}
  }
  /* 저장 대기 중인 편집이 있으면 덮어쓰지 않는다 */
  const dirty=()=>arr().some(r=>!r._id||snap.get(r._id)!==JSON.stringify(r));
  window.MESDB.reloadLines=async()=>{if(dirty())return -1;return load()};
  if(await load()===-1)return;
  try{MESDB.onChange('order_lines',()=>{if(!dirty())load()})}catch(e){}

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