/* mes_ctx.js — v2
 * 삭제·취소 확인 다이얼로그 (전 화면 공용)
 *   모든 화면의 삭제/취소 버튼 클릭을 가로채 확인창을 한 번 더 띄운다.
 *   화면 자체에 confirm()이 있으면 중복 질문이 되지 않도록 1회 통과시킨다.
 * 화면별 제외: window.MES_CTX_OPT = {noGuard:/라벨 또는 onclick 정규식/}
 */
(function(){
if(window.__mesCtx)return; window.__mesCtx=1;

const DEL_TXT=/삭제|취소|제거|remove|delete/i;
const NOGUARD=/^\s*msg\s*\(|closeActive|close\w*\(|hide\w*\(/i;  /* 안내문구·닫기 버튼 제외 */
const HARD=/삭제|제거|remove|delete/i;           /* 삭제 = 되돌리기 어려움 */

const css=`
#mesdlg-bg{position:fixed;inset:0;z-index:100000;background:rgba(20,28,35,.38);display:flex;
 align-items:center;justify-content:center;font:12px/1.6 'Malgun Gothic',맑은 고딕,sans-serif}
#mesdlg{min-width:330px;max-width:460px;background:#fff;border:1px solid #7f8f9c;
 box-shadow:0 6px 24px rgba(0,0,0,.3)}
#mesdlg .t{height:30px;display:flex;align-items:center;padding:0 12px;color:#fff;
 background:linear-gradient(#5f7f9f,#3f5f7d);font-weight:700}
#mesdlg .bd{padding:16px 18px 12px;color:#22303a}
#mesdlg .q{font-size:13px;font-weight:700;margin-bottom:9px}
#mesdlg .tg{background:#f4f7f9;border:1px solid #dde3e8;padding:7px 10px;color:#40525f;
 max-height:96px;overflow:auto;word-break:break-all;white-space:pre-wrap}
#mesdlg .w{margin-top:9px;color:#b3261e}
#mesdlg .bt{padding:10px 14px 14px;display:flex;gap:7px;justify-content:flex-end;background:#f7f9fa;
 border-top:1px solid #e3e9ed}
#mesdlg button{height:29px;min-width:78px;border:1px solid #9ba8b4;cursor:pointer;
 background:linear-gradient(#fff,#dfe6eb);font:12px 'Malgun Gothic',맑은 고딕,sans-serif}
#mesdlg button:hover{background:#fff}
#mesdlg button.danger{border-color:#a3312a;color:#fff;background:linear-gradient(#d4453c,#b3261e)}
#mesdlg button.danger:hover{background:linear-gradient(#e05149,#c22d24)}
#mesdlg button:focus{outline:2px solid #2f6fb5;outline-offset:1px}`;

let styled=false;
function ensureCss(){if(styled)return;styled=true;
  const st=document.createElement('style');st.textContent=css;document.head.appendChild(st)}

const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const txt=el=>(el?el.textContent:'').replace(/\s+/g,' ').trim();

function msg(s){
  if(window.MES&&MES.setMessage)return MES.setMessage(s);
  const m=document.getElementById('message');if(m)m.textContent=s;
}
function headers(tr){
  const tb=tr.closest('table');if(!tb)return[];
  const hr=tb.tHead?[...tb.tHead.rows].pop():null;
  return hr?[...hr.cells].map(txt):[];
}
function rowCells(tr){return [...tr.cells].map(td=>{
  const f=td.querySelector('input,select,textarea');
  return f?(f.type==='checkbox'?(f.checked?'Y':'N'):f.value):txt(td);
})}
function rowSummary(){
  const tr=document.querySelector('tbody tr.sel');
  if(!tr||!tr.cells)return '';
  const hs=headers(tr),cs=rowCells(tr);
  return cs.map((v,i)=>(hs[i]&&v.trim())?hs[i]+': '+v:null)
           .filter(Boolean).slice(0,6).join('\n');
}

function dlgConfirm(o){
  ensureCss();
  return new Promise(res=>{
    const bg=document.createElement('div');bg.id='mesdlg-bg';
    bg.innerHTML=`<div id="mesdlg" role="dialog" aria-modal="true">
      <div class="t">${esc(o.title||'확인')}</div>
      <div class="bd">
        <div class="q">${esc(o.q)}</div>
        ${o.target?`<div class="tg">${esc(o.target)}</div>`:''}
        ${o.warn?`<div class="w">${esc(o.warn)}</div>`:''}
      </div>
      <div class="bt">
        <button type="button" data-a="0">취소</button>
        <button type="button" data-a="1" class="${o.danger?'danger':''}">${esc(o.ok||'확인')}</button>
      </div></div>`;
    document.body.appendChild(bg);
    const done=v=>{if(!bg.parentNode)return;bg.remove();document.removeEventListener('keydown',key,true);res(v)};
    function key(e){
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();done(false)}
      else if(e.key==='Enter'&&document.activeElement&&document.activeElement.dataset.a===undefined){
        e.preventDefault();e.stopPropagation();done(false)}   /* Enter 오입력 방지 */
    }
    bg.addEventListener('click',e=>{
      const b=e.target.closest('button[data-a]');
      if(b){e.stopPropagation();done(b.dataset.a==='1');return}
      if(e.target===bg){e.stopPropagation();done(false)}
    },true);
    document.addEventListener('keydown',key,true);
    /* 기본 포커스는 '취소' — 엔터 연타로 지워지는 사고 방지 */
    setTimeout(()=>bg.querySelector('button[data-a="0"]').focus(),0);
  });
}

document.addEventListener('click',async e=>{
  const b=e.target.closest('button');
  if(!b||b.disabled)return;
  if(b.__mesOk){b.__mesOk=false;return}              /* 확인 통과분은 그대로 실행 */
  if(b.closest('#mesdlg-bg'))return;                 /* 확인창 자체 버튼 제외 */
  const label=txt(b),oc=b.getAttribute('onclick')||'';
  if(!DEL_TXT.test(label))return;
  if(NOGUARD.test(oc))return;
  const opt=window.MES_CTX_OPT||{};
  if(opt.noGuard&&(opt.noGuard.test(oc)||opt.noGuard.test(label)))return;

  e.preventDefault();e.stopPropagation();
  const hard=HARD.test(label);
  const name=label.replace(/^[^가-힣A-Za-z]+/,'')||'확인';
  const ok=await dlgConfirm({
    title:name, q:`${name} 하시겠습니까?`,
    target:rowSummary(),
    warn:hard?'이 작업은 되돌릴 수 없습니다.':'',
    ok:hard?'삭제':'실행', danger:hard
  });
  if(!ok){msg('취소했습니다.');return}
  /* 화면 자체 confirm이 있으면 중복 질문이 되므로 1회만 통과시킨다 */
  const orig=window.confirm;window.confirm=()=>true;
  b.__mesOk=true;
  try{b.click()}finally{setTimeout(()=>{window.confirm=orig},0)}
},true);

window.MESCTX={confirm:dlgConfirm};
})();

/* ── v47: 신규·생성 계열 버튼 분홍 강조 (전 화면 공용) ──────────────
 * '신규 / 행추가 / 발주추가 / 지시등록 / 카드발행 / 신규 사용자 등록' 처럼
 * "새로 만든다"는 버튼을 분홍 계열로 통일해 한눈에 띄게 한다.
 * 삭제·닫기·검색 등과 절대 섞이지 않도록 텍스트로만 판별한다. */
(function(){
 const NEW_TXT=/신\s*규|행\s*추가|발주추가|지시등록|카드발행|새로\s*만들기/;
 const EXCLUDE=/삭제|취소|닫기|검색|조회|저장(?!.*신규)/;
 const st=document.createElement('style');
 st.textContent=`
 button.mes-new{background:linear-gradient(#fff5f9,#f7cfe0)!important;
  border-color:#d98cb0!important;color:#a12a66!important;font-weight:700}
 button.mes-new:hover{background:#fff0f6!important;border-color:#c4699a!important}
 button.mes-new:active{background:#f2c3d8!important}
 /* v67: 삭제 버튼은 푸른 계열로 통일 */
 button.mes-del{background:linear-gradient(#f2f7fd,#cfe0f3)!important;
  border-color:#7fa6cf!important;color:#1e4f86!important;font-weight:700}
 button.mes-del:hover{background:#eaf3fc!important;border-color:#5f8fc2!important}
 button.mes-del:active{background:#c2d8ef!important}`;
 (document.head||document.documentElement).appendChild(st);
 function paint(root){
  (root.querySelectorAll?root:document).querySelectorAll('button').forEach(b=>{
   if(b.classList.contains('mes-new')||b.classList.contains('mes-del'))return;
   const t=(b.textContent||'').trim();
   if(!t||t.length>12)return;
   if(NEW_TXT.test(t)&&!EXCLUDE.test(t))b.classList.add('mes-new');
   else if(/^[^\w가-힣]*삭\s*제$/.test(t)&&!b.classList.contains('mes-del'))b.classList.add('mes-del');
  });
 }
 paint(document);
 new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)
   if(n.nodeType===1)paint(n.matches&&n.matches('button')?n.parentNode||document:n)})
  .observe(document.documentElement,{childList:true,subtree:true});
})();
/* ── v67: 입력폼 항목명 우측정렬 (전 화면 공용) ──────────────────────
 * grid 로 짜인 입력폼(.formgrid 등)의 항목명(.label/.lab/.lb)을 우측 정렬해
 * 항목명과 입력칸이 붙어 보이게 한다. 검색줄(.searchline)·표 머리글·버튼 안의
 * 텍스트는 건드리지 않는다. */
(function(){
 const st=document.createElement('style');
 st.textContent=`
 .mes-ralign{text-align:right!important;padding-right:8px!important;box-sizing:border-box}
 .mes-ralign.mes-ralign-flex{justify-content:flex-end!important}
 /* v67: 그리드 입력칸은 종류와 무관하게 320px 로 통일해 좌측에 행렬로 정렬한다 */
 .mes-fit{max-width:320px!important;justify-self:start;width:100%}
 .mes-grid-fit{justify-content:start!important}`;
 (document.head||document.documentElement).appendChild(st);
 /* 그리드 열 정의를 '항목명 폭 / 320px' 반복으로 바꿔 1fr 로 늘어나던 열을 없앤다.
  * 화면 원래 정의가 repeat()/auto-fill 같은 특수형이면 손대지 않는다. */
 function splitTracks(str){const out=[];let dep=0,cur='';for(const ch of str){if(ch==='(')dep++;if(ch===')')dep--;
   if(ch===' '&&!dep){if(cur)out.push(cur);cur=''}else cur+=ch}if(cur)out.push(cur);return out}
 function fitGrid(p){
  if(p.classList.contains('mes-grid-fit'))return;
  let tpl='';try{tpl=getComputedStyle(p).gridTemplateColumns||''}catch(e){return}
  if(!tpl||tpl==='none'||/auto-fill|auto-fit|\[/.test(tpl))return;
  /* repeat(n, a b) 형태는 펼친다 (브라우저 computed 값은 보통 이미 펼쳐져 있음) */
  tpl=tpl.replace(/repeat\((\d+),([^()]*(?:\([^()]*\)[^()]*)*)\)/g,(m,n,inner)=>Array(+n).fill(inner.trim()).join(' '));
  if(/repeat\(/.test(tpl))return;
  const tr=splitTracks(tpl);if(tr.length<2)return;
  const kids=[...p.children];
  /* 첫 열이 항목명인 구조만 대상 */
  if(!kids[0]||!/(^|\s)(label|lab|lb)(\s|$)/.test(kids[0].className))return;
  const nt=tr.map((t,i)=>{if(i%2===0){const m=t.match(/^(\d+(?:\.\d+)?)px$/);return (m&&+m[1]<=160)?t:'max-content'}return '320px'});
  p.style.gridTemplateColumns=nt.join(' ');
  p.classList.add('mes-grid-fit');
 }
 function isGrid(el){try{const d=getComputedStyle(el).display;return d==='grid'||d==='inline-grid'}catch(e){return false}}
 function align(root){
  (root.querySelectorAll?root:document).querySelectorAll('.label,.lab,.lb').forEach(el=>{
   if(el.classList.contains('mes-ralign'))return;
   if(el.closest('.searchline,table,thead,button,.tabs,.title'))return;
   const p=el.parentElement;if(!p||!isGrid(p))return;
   el.classList.add('mes-ralign');
   const d=getComputedStyle(el).display;if(d==='flex'||d==='inline-flex')el.classList.add('mes-ralign-flex');
   /* 항목명 바로 뒤의 입력칸: 320px 상한 (화면에서 폭을 직접 지정했거나 data-wide 면 제외) */
   const f=el.nextElementSibling;
   if(f&&(f.tagName==='INPUT'||f.tagName==='SELECT'||f.tagName==='TEXTAREA')&&!f.classList.contains('mes-fit')&&!f.style.width&&!f.style.maxWidth&&!f.hasAttribute('data-wide'))
    f.classList.add('mes-fit');
   fitGrid(p);
  });
 }
 const run=()=>align(document);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
 setTimeout(run,600);
 new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(n.nodeType===1)align(n.parentNode||document)})
  .observe(document.documentElement,{childList:true,subtree:true});
})();

/* ── v68: 말줄임(…) 된 글자에 마우스를 올리면 전체 내용 툴팁 (전 화면 공용) ──
 * 항목명(.label/.lab/.lb)·표 머리글·표 셀·읽기전용 입력칸이 잘려 '…' 로 보일 때
 * title 을 붙여 브라우저 툴팁으로 전체 내용을 보여준다. 화면을 훑지 않고
 * 마우스가 올라간 요소만 검사하므로 부담이 없다. */
(function(){
 const SEL='.label,.lab,.lb,.k,th,td,input[readonly],.v';
 document.addEventListener('mouseover',e=>{
  const el=e.target&&e.target.closest?e.target.closest(SEL):null;
  if(!el||el.__mesTipChk)return;
  el.__mesTipChk=1;setTimeout(()=>{el.__mesTipChk=0},1500);
  if(el.getAttribute('title'))return;
  const cut=el.tagName==='INPUT'?(el.scrollWidth>el.clientWidth+1):(el.scrollWidth>el.clientWidth+1||el.scrollHeight>el.clientHeight+2);
  if(!cut)return;
  const t=el.tagName==='INPUT'?el.value:(el.textContent||'').replace(/\s+/g,' ').trim();
  if(t)el.setAttribute('title',t);
 },true);
})();

/* ── v68: 현황·조회 표 가시성 — 앞 2열 고정 + 글자폭 맞춤 + 행 줄무늬 (전 화면 공용) ──
 * · 넓은 표는 앞 2열(NO/제번 등)을 왼쪽에 고정해 가로 스크롤해도 어느 행인지 보인다.
 * · 열폭을 머리글·내용의 실제 글자폭에 맞춰 다시 잡는다(빈 열은 좁게, 긴 값은 넓게).
 * · 짝수 행에 색을 넣어 행 구분을 또렷하게 한다. 선택·마우스오버 색은 화면 규칙 유지. */
(function(){
 const st=document.createElement('style');
 st.textContent=`
 table.mes-zebra tbody tr:nth-child(even):not(.sel):not(.selected):not(:hover) td{background:#e8eff6!important}
 table.mes-zebra tbody tr:nth-child(odd):not(.sel):not(.selected):not(:hover) td{background:#fff!important}
 table.mes-zebra tbody tr:not(.sel):not(.selected):hover td{background:#d9ecfb!important}
 /* 앞 2열 고정 — 두 번째 열의 left 는 첫 열 폭(--c1) 으로 잡는다 */
 table.mes-freeze th:nth-child(-n+2),table.mes-freeze td:nth-child(-n+2){position:sticky;z-index:1}
 table.mes-freeze th:first-child,table.mes-freeze td:first-child{left:0}
 table.mes-freeze th:nth-child(2),table.mes-freeze td:nth-child(2){left:var(--c1,0px);
  box-shadow:inset -1px 0 0 #b8c4ce}
 table.mes-freeze thead th:nth-child(-n+2){z-index:3}
 table.mes-freeze tfoot td:first-child{z-index:2}
 table.mes-freeze tbody tr:nth-child(odd):not(.sel):not(.selected):not(:hover) td:nth-child(-n+2){background:#f6f8fa!important}
 table.mes-freeze tbody tr:nth-child(even):not(.sel):not(.selected):not(:hover) td:nth-child(-n+2){background:#dfe8f1!important}`;
 (document.head||document.documentElement).appendChild(st);

 const WRAP='.gridbox,.tablewrap,.pb,.entrybox,.grid,.list';
 const PAD=18, MIN=40, MAX=300, SAMPLE=150;
 let mctx=null;
 function textPx(t,font){
  t=String(t??'');if(!t)return 0;
  if(mctx===null){try{mctx=document.createElement('canvas').getContext('2d')||false}catch(e){mctx=false}}
  if(mctx){mctx.font=font;const m=mctx.measureText(t);if(m&&m.width)return m.width}
  let u=0;for(const ch of t)u+=/[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF\u4E00-\u9FFF\uFF00-\uFFEF]/.test(ch)?2:1;
  return u*6.4;
 }
 function cellText(td){
  const f=td.querySelector('input,select,textarea');
  if(f){
   if(f.type==='checkbox'||f.type==='radio')return '■';
   if(f.tagName==='SELECT')return (f.options[f.selectedIndex]||{}).text||'';
   return f.value||f.placeholder||'';
  }
  return (td.textContent||'').replace(/\s+/g,' ').trim();
 }
 /* 열폭을 글자 기준으로 다시 잡는다. 표가 넓으면 가로 스크롤, 좁으면 남는 폭을 넓은 열에 나눠준다. */
 function fit(tb,wrap){
  const head=tb.tHead&&tb.tHead.rows.length===1?tb.tHead.rows[0]:null;   /* 2단 머리글은 대상 제외 */
  if(!head)return null;
  const hs=[...head.cells];
  if(!hs.length||hs.some(c=>c.colSpan>1))return null;
  const n=hs.length;
  let font='12px "Malgun Gothic",sans-serif',bold=font;
  try{const cs=getComputedStyle(hs[0]);font=`${cs.fontSize} ${cs.fontFamily}`;bold=`700 ${font}`}catch(e){}
  const w=hs.map(h=>textPx((h.textContent||'').replace(/\s+/g,' ').trim(),bold)+PAD);
  const rows=tb.tBodies[0]?tb.tBodies[0].rows:[];
  const lim=Math.min(rows.length,SAMPLE);
  for(let i=0;i<lim;i++){
   const cs=rows[i].cells;if(cs.length!==n)continue;
   for(let c=0;c<n;c++){const p=textPx(cellText(cs[c]),font)+PAD;if(p>w[c])w[c]=p}
  }
  for(let c=0;c<n;c++)w[c]=Math.round(Math.max(MIN,Math.min(MAX,w[c])));
  let sum=w.reduce((a,b)=>a+b,0);
  const avail=(wrap.clientWidth||0)-2;
  if(avail>0&&sum<avail){                       /* 남는 폭은 넓은 열에 비례 배분 */
   const extra=avail-sum;
   for(let c=0;c<n;c++)w[c]=Math.round(w[c]+extra*(w[c]/sum));
   sum=w.reduce((a,b)=>a+b,0);
  }
  hs.forEach((h,c)=>{h.style.width=w[c]+'px'});
  tb.style.width=sum+'px';tb.style.minWidth=sum+'px';tb.style.tableLayout='fixed';
  tb.style.setProperty('--c1',w[0]+'px');
  return {w,sum,avail};
 }
 function apply(){
  document.querySelectorAll('table').forEach(tb=>{
   if(!tb.tHead||!tb.tBodies.length)return;
   if(tb.closest('#meslk,#mesdlg,.dlg,.sheet,.doc'))return;      /* 팝업·인쇄용은 제외 */
   const wrap=tb.closest(WRAP);if(!wrap)return;
   tb.classList.add('mes-zebra');
   const r=fit(tb,wrap);
   const cols=tb.tHead.rows[0].cells.length;
   /* 열이 5개 이상이고 실제로 가로 스크롤이 생길 때만 앞 2열 고정 */
   const wide=cols>=5&&r&&r.avail>0&&r.sum>r.avail+4;
   tb.classList.toggle('mes-freeze',!!wide);
  });
 }
 const run=()=>{try{apply()}catch(e){}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
 setTimeout(run,700);setTimeout(run,2000);
 window.addEventListener('resize',()=>{clearTimeout(window.__mesFzT);window.__mesFzT=setTimeout(run,150)});
 let t=null;
 new MutationObserver(()=>{clearTimeout(t);t=setTimeout(run,200)}).observe(document.documentElement,{childList:true,subtree:true});
})();

/* ── v68: 공용 콤보 — 모든 드롭박스를 같은 모양으로, 입력하면 목록이 걸러진다 ──
 * 대상: <select>(옵션이 여러 개인 것)와 <input list="…">(datalist).
 *   · 원래 요소는 그대로 두고(값·이벤트·기존 코드 그대로 동작) 위에 입력칸을 얹는다.
 *   · 글자를 치면 코드·명칭 어디든 포함되는 항목만 남는다. ▼ 를 누르면 전체 목록.
 *   · ↑↓ 이동, Enter 선택, Esc 닫기. datalist 형은 목록에 없는 값도 그대로 입력된다.
 * 제외: [data-nocombo], 옵션 4개 이하의 짧은 선택(진행/보류/완료 등)은 모양만 통일. */
(function(){
 if(window.MESCOMBO)return;
 const MINOPT=5;                       /* 옵션이 이보다 적으면 검색 없이 기본 select 유지 */
 const st=document.createElement('style');
 st.textContent=`
 /* 기본 select 도 콤보와 같은 높이·테두리로 통일 */
 select.field,select.mes-fit{height:27px;border:1px solid #b5c0c9;background:#fff;padding:0 4px}
 .mescb{position:relative;display:inline-block;vertical-align:middle;min-width:0}
 .mescb>select,.mescb>input.mescb-src{display:none!important}
 .mescb-in{width:100%;height:27px;box-sizing:border-box;border:1px solid #b5c0c9;background:#fff;
  padding:0 20px 0 6px;font:inherit;color:inherit;min-width:0}
 .mescb-in:focus{border-color:#4e88bb;outline:none}
 .mescb-in::placeholder{color:#a8b4bd}
 .mescb-ar{position:absolute;right:1px;top:1px;width:18px;height:25px;border:0;background:transparent;
  cursor:pointer;color:#6d7b88;font-size:9px;line-height:25px;padding:0}
 .mescb-ar:hover{color:#2f6fb5}
 .mescb-pop{position:fixed;z-index:100001;background:#fff;border:1px solid #7f8f9c;
  box-shadow:0 6px 20px rgba(0,0,0,.22);max-height:260px;overflow:auto;display:none;
  font:12px 'Malgun Gothic',맑은 고딕,sans-serif}
 .mescb-pop.on{display:block}
 .mescb-pop .it{padding:4px 8px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .mescb-pop .it .sub{color:#7d8b96;margin-left:8px;font-size:11px}
 .mescb-pop .it:hover,.mescb-pop .it.on{background:#2d75b7;color:#fff}
 .mescb-pop .it.on .sub,.mescb-pop .it:hover .sub{color:#dbe9f5}
 .mescb-pop .no{padding:8px;color:#8a97a2;text-align:center}`;
 (document.head||document.documentElement).appendChild(st);

 const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 let pop=null,cur=null,hi=-1,items=[];
 const BOXES=[];                       /* 화면 코드가 값을 직접 바꾸는 경우까지 맞추기 위한 목록 */
 setInterval(()=>{for(const b of BOXES){try{b.sync()}catch(e){}}},800);
 function ensurePop(){
  if(pop)return pop;
  pop=document.createElement('div');pop.className='mescb-pop';
  document.body.appendChild(pop);
  pop.addEventListener('mousedown',e=>{
   const it=e.target.closest('.it');if(!it)return;
   e.preventDefault();choose(Number(it.dataset.i));
  });
  return pop;
 }
 /* 대상 요소에서 목록을 뽑는다 → [{v:값, l:표시, s:부가설명}] */
 function optionsOf(box){
  const el=box.src;
  if(el.tagName==='SELECT')
   return [...el.options].map(o=>({v:o.value,l:(o.textContent||o.value||'').trim(),s:''}))
     .filter(o=>o.v!==''||o.l!=='');
  const dl=box.dl||document.getElementById(el.getAttribute('data-list')||'');
  if(!dl)return [];
  return [...dl.options].map(o=>({v:o.value,l:o.value,s:(o.textContent||'').trim()}));
 }
 function labelOf(box,val){
  const o=optionsOf(box).find(x=>String(x.v)===String(val));
  return o?o.l:(val==null?'':String(val));
 }
 function open(box,all){
  cur=box;const p=ensurePop();
  const q=all?'':String(box.inp.value||'').trim().toLowerCase();
  items=optionsOf(box).filter(o=>!q||(o.l+' '+o.v+' '+o.s).toLowerCase().includes(q));
  p.innerHTML=items.length
   ? items.map((o,i)=>`<div class="it" data-i="${i}">${esc(o.l||'(비움)')}${o.s?`<span class="sub">${esc(o.s)}</span>`:''}</div>`).join('')
   : '<div class="no">검색결과가 없습니다.</div>';
  const r=box.wrap.getBoundingClientRect();
  const h=Math.min(260,items.length?items.length*24+6:40);
  const down=window.innerHeight-r.bottom>h+8||r.top<h+8;
  p.style.left=Math.max(4,Math.min(r.left,window.innerWidth-r.width-6))+'px';
  p.style.width=Math.max(r.width,150)+'px';
  p.style.top=(down?r.bottom+1:r.top-h-1)+'px';
  p.classList.add('on');
  hi=items.findIndex(o=>String(o.v)===String(box.src.value));
  mark();
 }
 function close(){if(pop)pop.classList.remove('on');cur=null;hi=-1;items=[]}
 function mark(){
  if(!pop)return;
  [...pop.querySelectorAll('.it')].forEach((el,i)=>el.classList.toggle('on',i===hi));
  const on=pop.querySelector('.it.on');if(on)try{on.scrollIntoView({block:'nearest'})}catch(e){}
 }
 function setVal(box,v,label){
  const el=box.src;
  el.value=v;
  box.inp.value=label!=null?label:labelOf(box,v);
  el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
 }
 function choose(i){
  const box=cur,o=items[i];if(!box||!o)return;
  close();setVal(box,o.v,o.l);box.inp.focus();
 }
 /* 포커스를 잃을 때: select 형은 목록에 없는 글자를 되돌리고, datalist 형은 그대로 둔다 */
 function commit(box){
  const t=String(box.inp.value||'').trim();
  if(box.src.tagName==='SELECT'){
   const o=optionsOf(box).find(x=>x.l===t)||optionsOf(box).find(x=>String(x.v)===t);
   if(o)setVal(box,o.v,o.l); else box.inp.value=labelOf(box,box.src.value);
  }else if(t!==box.src.value)setVal(box,t,t);
 }
 function build(el){
  if(el.__mescb||el.hasAttribute('data-nocombo'))return;
  const isSel=el.tagName==='SELECT';
  const dl=isSel?null:document.getElementById(el.getAttribute('list')||'');
  if(!isSel&&!dl)return;
  if(isSel&&el.options.length<MINOPT&&!el.hasAttribute('data-combo'))return;   /* 짧은 선택은 그대로 */
  el.__mescb=1;
  const wrap=document.createElement('span');wrap.className='mescb';
  /* 원래 폭 규칙을 이어받는다 (인라인 폭 지정 → 그대로, 아니면 칸 전체) */
  wrap.style.width=el.style.width||'100%';
  if(el.classList.contains('mes-fit'))wrap.classList.add('mes-fit');
  const inp=document.createElement('input');
  inp.type='text';inp.className='mescb-in';inp.autocomplete='off';
  inp.placeholder=el.getAttribute('placeholder')||'입력 또는 선택';
  if(el.disabled||el.readOnly)inp.disabled=true;
  const ar=document.createElement('button');ar.type='button';ar.className='mescb-ar';ar.textContent='▼';
  ar.tabIndex=-1;
  el.parentNode.insertBefore(wrap,el);
  wrap.appendChild(el);wrap.appendChild(inp);wrap.appendChild(ar);
  const box={src:el,inp,wrap,dl};
  el.__mescbBox=box;
  if(!isSel){el.setAttribute('data-list',el.getAttribute('list')||'');el.removeAttribute('list');el.classList.add('mescb-src')}
  inp.value=isSel?labelOf(box,el.value):(el.value||'');

  ar.addEventListener('mousedown',e=>{e.preventDefault();
   if(cur===box&&pop&&pop.classList.contains('on'))close();else{inp.focus();open(box,true)}});
  inp.addEventListener('focus',()=>open(box,true));
  inp.addEventListener('input',()=>{open(box,false);
   if(!isSel){el.value=inp.value;el.dispatchEvent(new Event('input',{bubbles:true}))}});
  inp.addEventListener('blur',()=>{setTimeout(()=>{if(cur===box)close();commit(box)},120)});
  inp.addEventListener('keydown',e=>{
   if(e.key==='ArrowDown'||e.key==='ArrowUp'){
    e.preventDefault();
    if(!pop||!pop.classList.contains('on')||cur!==box)return open(box,false);
    hi=Math.max(0,Math.min(items.length-1,hi+(e.key==='ArrowDown'?1:-1)));mark();
   }else if(e.key==='Enter'){
    if(cur===box&&pop&&pop.classList.contains('on')&&hi>=0){e.preventDefault();choose(hi)}
   }else if(e.key==='Escape'){
    if(cur===box){e.preventDefault();e.stopPropagation();close();inp.value=isSel?labelOf(box,el.value):el.value}
   }
  });
  /* 화면 코드가 값을 바꾸거나 옵션을 다시 채우면 표시도 따라간다 */
  const sync=()=>{const t=isSel?labelOf(box,el.value):(el.value||'');if(document.activeElement!==inp&&inp.value!==t)inp.value=t};
  el.addEventListener('change',sync);
  new MutationObserver(sync).observe(el,{childList:true,attributes:true,attributeFilter:['value']});
  if(dl)new MutationObserver(sync).observe(dl,{childList:true});
  box.sync=sync;BOXES.push(box);
 }
 function scan(root){
  const q='select,input[list]';
  (root&&root.querySelectorAll?root:document).querySelectorAll(q).forEach(el=>{
   if(el.closest('#meslk,#mesdlg,.mescb-pop'))return;
   try{build(el)}catch(e){}
  });
 }
 const run=()=>{try{scan(document)}catch(e){}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
 setTimeout(run,400);setTimeout(run,1500);
 let t=null;
 new MutationObserver(()=>{clearTimeout(t);t=setTimeout(run,250)}).observe(document.documentElement,{childList:true,subtree:true});
 window.addEventListener('scroll',()=>{if(cur)close()},true);
 window.addEventListener('resize',()=>{if(cur)close()});
 document.addEventListener('mousedown',e=>{if(cur&&!e.target.closest('.mescb,.mescb-pop'))close()},true);
 window.MESCOMBO={scan:run,build};
})();
