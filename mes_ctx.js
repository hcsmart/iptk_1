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
 /* v72: 그리드 입력칸은 종류와 무관하게 200px 로 통일해 좌측에 행렬로 정렬한다 */
 .mes-fit{max-width:200px!important;justify-self:start;width:100%}
 .mes-grid-fit{justify-content:start!important}`;
 (document.head||document.documentElement).appendChild(st);
 /* 그리드 열 정의를 '항목명 폭 / 200px' 반복으로 바꿔 1fr 로 늘어나던 열을 없앤다.
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
  const nt=tr.map((t,i)=>{if(i%2===0){const m=t.match(/^(\d+(?:\.\d+)?)px$/);return (m&&+m[1]<=160)?t:'max-content'}return '200px'});
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
   /* 항목명 바로 뒤의 입력칸: 200px 상한 (화면에서 폭을 직접 지정했거나 data-wide 면 제외) */
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
 /* v72: 잠긴 칸(비활성·읽기전용·자동계산)은 연회색으로 채워 입력칸과 구분한다 */
 input:disabled,select:disabled,textarea:disabled,input[readonly],textarea[readonly],
 .mescb-in:disabled,.mescb:has(.mescb-in:disabled){background-color:#eef1f4!important;color:#78868f!important;cursor:default}
 input:disabled::placeholder,.mescb-in:disabled::placeholder{color:#9aa7b1}
 input[type=checkbox]:disabled,input[type=radio]:disabled{background-color:transparent!important}
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
   e.preventDefault();                           /* 스크롤바 클릭 시 입력창 포커스 유지 → 팝업 닫히지 않음 */
   const it=e.target.closest('.it');if(!it)return;
   choose(Number(it.dataset.i));
  });
  pop.addEventListener('wheel',e=>{              /* 휠은 팝업 안에서만 소비 (부모 스크롤 전파 차단) */
   const d=e.deltaY,top=pop.scrollTop,max=pop.scrollHeight-pop.clientHeight;
   if((d<0&&top<=0)||(d>0&&top>=max))e.preventDefault();
   e.stopPropagation();
  },{passive:false});
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
  const sync=(force)=>{const t=isSel?labelOf(box,el.value):(el.value||'');
   if((force||document.activeElement!==inp)&&inp.value!==t)inp.value=t;
   /* v72: 원본이 잠기면 표시칸도 같이 잠근다 (콤보가 뒤늦게 만들어져도 상태가 어긋나지 않음) */
   const dis=!!(el.disabled||el.readOnly);if(inp.disabled!==dis)inp.disabled=dis;
   const ph=el.getAttribute('placeholder');if(ph!=null&&inp.placeholder!==ph)inp.placeholder=ph;
   if(dis&&inp.value){const keep=isSel?labelOf(box,el.value):(el.value||'');if(!keep)inp.value=''}};
  el.addEventListener('change',()=>sync());
  new MutationObserver(()=>sync()).observe(el,{childList:true,attributes:true,attributeFilter:['value','disabled','readonly','placeholder']});
  if(dl)new MutationObserver(()=>sync()).observe(dl,{childList:true});
  /* v72: 화면 코드가 el.value 로 직접 값을 넣으면 보이는 칸이 '즉시' 따라온다.
   * (800ms 폴링만 믿으면 그 사이 blur 가 나면서 빈 글자로 commit 되어 값이 지워졌다) */
  try{const pr=isSel?HTMLSelectElement.prototype:HTMLInputElement.prototype;
   const d=Object.getOwnPropertyDescriptor(pr,'value');
   if(d&&d.get&&d.set)Object.defineProperty(el,'value',{configurable:true,enumerable:true,
    get(){return d.get.call(this)},
    set(v){d.set.call(this,v);try{sync(true)}catch(e){}}});
  }catch(e){}
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
 window.addEventListener('scroll',e=>{if(!cur)return;if(pop&&(e.target===pop||(e.target&&e.target.nodeType===1&&pop.contains(e.target))))return;close()},true);
 window.addEventListener('resize',()=>{if(cur)close()});
 document.addEventListener('mousedown',e=>{if(cur&&!e.target.closest('.mescb,.mescb-pop'))close()},true);
 window.MESCOMBO={scan:run,build};
})();

/* ── v68: 제작계획 연동 — 외주업체 자동선택 · 세트외주 표시 (발주 화면 3종) ──
 * 제작계획등록에서 고른 단계별 외주업체/세트 체크를 발주 화면으로 흘려보낸다.
 *   외주설계발주등록  : 제번 선택 → 제작계획의 설계 외주업체를 협력업체 목록에서 자동 선택
 *   외주가공 발주     : 제번 선택 → 가공 외주업체 자동 선택
 *   SET외주제작등록   : 세트 체크된 제번에 [SET외주] 표시, 계획 업체가 SET 협력업체면 자동 선택
 * 화면 파일은 그대로 두고 pickJob/pick 을 감싼다. 계획이 없거나 사내 계획이면 안내만 한다. */
(function(){
 const f=(location.pathname||'').split('/').pop();
 const PAGE={'outsourced_design_order_input.html':{phase:'design',label:'설계'},
             'outsourcing_order_input.html':{phase:'machining',label:'가공'},
             'set_order_registration.html':{set:true}}[f];
 if(!PAGE)return;
 const st=document.createElement('style');
 st.textContent=`.mes-pl{display:inline-block;margin-left:6px;padding:0 5px;border-radius:3px;font-size:10px;line-height:15px;border:1px solid;vertical-align:middle;white-space:nowrap}
 .mes-pl.out{background:#fdefe2;border-color:#e0a86a;color:#9a5410;font-weight:700}
 .mes-pl.in{background:#eef3f7;border-color:#b9c8d5;color:#4a5c6b}
 .mes-pl.set{background:#e8f0fb;border-color:#7fa6cf;color:#1e4f86;font-weight:700}
 tr.sel .mes-pl{background:transparent;border-color:#cfe2f4;color:#fff}`;
 (document.head||document.documentElement).appendChild(st);
 const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const say=t=>{try{if(window.MES&&MES.setMessage)return MES.setMessage(t)}catch(e){}const m=document.getElementById('message');if(m)m.textContent=t};
 let PLAN=null,loading=null;
 async function plans(){
  if(PLAN)return PLAN;if(loading)return loading;
  loading=(async()=>{
   for(let i=0;i<80&&!window.MESDB;i++)await new Promise(r=>setTimeout(r,50));
   if(window.MESDB&&MESDB.ready){try{await MESDB.ready}catch(e){}}
   if(!(window.MESDB&&MESDB.online))return {};
   try{const rs=await MESDB.table('sales_plans').select('select=job_no,design_outsourced,design_vendor,design_set_outsourced,machining_outsourced,machining_vendor,machining_set_outsourced,assembly_outsourced,assembly_vendor,assembly_set_outsourced');
    PLAN={};rs.forEach(r=>PLAN[r.job_no]=r);return PLAN}catch(e){return {}}
  })();
  return loading;
 }
 try{if(window.MESDB&&MESDB.onChange)MESDB.onChange(['sales_plans'],()=>{PLAN=null;loading=null;plans().then(decorate)})}catch(e){}
 setTimeout(()=>{try{if(window.MESDB&&MESDB.onChange&&!window.__mesPlHook){window.__mesPlHook=1;MESDB.onChange(['sales_plans'],()=>{PLAN=null;loading=null;plans().then(decorate)})}}catch(e){}},1500);

 const setLabel=p=>['design','machining','assembly'].filter(k=>p[k+'_set_outsourced']===true).map(k=>({design:'설계',machining:'가공',assembly:'조립'})[k]).join('·');

 /* 제번 표 행 장식 */
 function decorate(){
  if(!PLAN)return;
  if(PAGE.phase){
   document.querySelectorAll('#jobBody tr').forEach(tr=>{
    const tds=tr.cells;if(tds.length<3)return;
    const job=(tds[1].textContent||'').trim(),p=PLAN[job];
    let b=tds[2].querySelector('.mes-pl');if(!b){b=document.createElement('span');b.className='mes-pl';tds[2].appendChild(b)}
    if(!p){b.style.display='none';return}
    const out=p[PAGE.phase+'_outsourced']===true;
    b.style.display='';b.className='mes-pl '+(out?'out':'in');
    b.textContent=out?(PAGE.label+'외주'+(p[PAGE.phase+'_vendor']?' · '+p[PAGE.phase+'_vendor']:'')):(PAGE.label+'사내');
    b.title=out?'제작계획에서 외주로 계획됨':'제작계획에서 사내로 계획됨 — 외주 발주 전 계획을 확인하세요';
   });
  }else{
   document.querySelectorAll('#hbody tr').forEach(tr=>{
    const tds=tr.cells;if(tds.length<6)return;
    const job=(tds[0].textContent||'').trim(),p=PLAN[job];
    const cell=tds[5];let b=cell.querySelector('.mes-pl');
    if(!b){b=document.createElement('span');b.className='mes-pl set';b.style.marginLeft='0';cell.appendChild(b)}
    const lab=p?setLabel(p):'';
    b.style.display=lab?'':'none';b.textContent=lab?'SET외주 '+lab:'';
    const v=p&&(p.design_vendor||p.machining_vendor||p.assembly_vendor);
    b.title=lab?('제작계획 세트 체크: '+lab+(v?' / 업체 '+v:'')):'';
   });
  }
 }
 /* 표 본문의 행 교체(childList)만 감시한다. 장식이 셀 안을 바꾸는 것은 subtree 라 다시 울리지 않는다 */
 const body=PAGE.phase?'#jobBody':'#hbody';
 let busy=false;const dec=()=>{if(busy||!PLAN)return;busy=true;try{decorate()}finally{busy=false}};
 (function watch(n){const tb=document.querySelector(body);
  if(tb){new MutationObserver(dec).observe(tb,{childList:true});dec()}else if(n<40)setTimeout(()=>watch(n+1),250)})(0);
 plans().then(dec);

 /* 외주업체 자동 선택 (외주설계 / 외주가공) */
 async function linkVendor(){
  await plans();
  let j=null;try{j=(typeof jobView!=='undefined'&&typeof jobIdx!=='undefined')?jobView[jobIdx]:null}catch(e){}
  if(!j)return;const p=PLAN&&PLAN[j.job];if(!p)return;
  const out=p[PAGE.phase+'_outsourced']===true,vd=p[PAGE.phase+'_vendor'];
  if(!out){say(`${j.job} 은(는) 제작계획에서 ${PAGE.label} '사내' 로 계획된 제번입니다. 외주 발주가 맞는지 확인하세요.`);return}
  if(!vd){say(`${j.job} ${PAGE.label}외주 계획 (업체 미지정) — 협력업체를 선택하세요.`);return}
  try{
   if(typeof VENDORS==='undefined')return;
   if(!VENDORS.includes(vd)){say(`제작계획 업체 '${vd}' 가 협력업체 목록에 없습니다. 업체관리에서 ${PAGE.label==='설계'?'외주설계':'외주가공'} 업체로 등록하세요.`);return}
   if(typeof venQ!=='undefined'&&venQ)venQ.value='';
   venView=[...VENDORS];venIdx=venView.indexOf(vd);
   /* v76: 협력업체가 체크박스 방식인 화면은 체크 상태도 맞춘다 */
   try{if(window.MESVENSEL){window.MESVENSEL.clear();window.MESVENSEL.add(vd)}}catch(e){}
   if(typeof renderVendors==='function')renderVendors();
   say(`${j.job} 제작계획의 ${PAGE.label} 외주업체 '${vd}' 를 자동 선택했습니다.`);
  }catch(e){}
 }
 /* SET외주제작등록: 계획 업체가 SET 협력업체 목록에 있으면 자동 선택 */
 async function linkSet(){
  await plans();
  let s=null;try{s=(typeof sel!=='undefined')?sel:null}catch(e){}
  if(!s)return;const p=PLAN&&PLAN[s.job_no];if(!p)return;
  const lab=setLabel(p);
  const v=p.design_vendor||p.machining_vendor||p.assembly_vendor;
  if(!lab){return}
  try{
   const hit=(typeof partners!=='undefined')&&partners.find(x=>x.partner_vendor_name===v);
   if(hit&&typeof pickP==='function'){pickP(v);say(`${s.job_no} 세트외주(${lab}) 계획 — 업체 '${v}' 자동 선택`)}
   else say(`${s.job_no} 세트외주(${lab}) 계획된 제번입니다.`+(v?` 계획 업체 '${v}' 는 SET 협력업체 목록에 없습니다.`:''));
  }catch(e){}
 }
 function hook(){
  if(PAGE.phase&&typeof window.pickJob==='function'&&!window.pickJob.__pl){
   const o=window.pickJob;const w=function(){const r=o.apply(this,arguments);setTimeout(linkVendor,0);return r};w.__pl=1;window.pickJob=w;
   /* 첫 진입: 목록·업체가 채워진 뒤 한 번 */
   let n=0;const iv=setInterval(()=>{try{if(typeof jobView!=='undefined'&&jobView.length&&typeof VENDORS!=='undefined'&&VENDORS.length){clearInterval(iv);linkVendor()}else if(++n>60)clearInterval(iv)}catch(e){if(++n>60)clearInterval(iv)}},250);
  }
  if(PAGE.set&&typeof window.pick==='function'&&!window.pick.__pl){
   const o=window.pick;const w=async function(){const r=await o.apply(this,arguments);setTimeout(linkSet,0);return r};w.__pl=1;window.pick=w;
  }
 }
 hook();setTimeout(hook,300);setTimeout(hook,1500);
})();

/* ── v68: 외주설계발주입고 — [조회] 시 DB 재조회 ──────────────────────
 * 이 화면은 열릴 때 한 번만 order_lines 를 읽고, [조회] 는 메모리 목록만 걸러낸다.
 * 그래서 탭을 열어 둔 채 제작계획등록에서 외주설계 발주가 생기면 조회해도 안 보였다.
 * → [조회] 를 누르거나 order_lines 변경 알림이 오면 DB 를 다시 읽어 ORD 를 채운 뒤 걸러낸다. */
(function(){
 const f=(location.pathname||'').split('/').pop();
 if(f!=='outsourced_design_receipt_input.html')return;
 const D=v=>v?String(v).slice(0,10):'';
 const Nn=v=>(v===null||v===undefined?'':Number(v));
 async function refetch(){
  if(!(window.MESDB&&MESDB.online))return false;
  try{
   const rows=await MESDB.table('order_lines').select('select=*&order=line_id&category=eq.'+encodeURIComponent('외주설계'));
   if(typeof ORD==='undefined')return false;
   ORD.length=0;
   rows.forEach(r=>ORD.push({_id:r.line_id,seq:Nn(r.line_id),job_no:r.job_no||'',item_name:r.item_name||'',partner_name:r.vendor_name||'',
    process_code:r.process_code||'',order_date:D(r.order_date),expected_date:D(r.required_date),
    nego_price:Nn(r.confirm_price),progress_rate:Nn(r.nego_rate),receipt_date:D(r.receipt_date)}));
   try{RCP=await MESDB.table('outsourced_design_receipts').select('select=*&order=receipt_no')}catch(e){}
   if(typeof fillVen==='function')fillVen();
   return true;
  }catch(e){return false}
 }
 function hook(){
  if(typeof window.search!=='function'||window.search.__rf)return;
  const o=window.search;
  const w=async function(){const ok=await refetch();o.apply(this,arguments);
   if(ok){const m=document.getElementById('message');if(m)m.textContent=m.textContent.replace(/\.$/,'')+' (DB 재조회)'}};
  w.__rf=1;window.search=w;
  const bind=()=>{if(window.MESDB&&MESDB.onChange){MESDB.onChange(['order_lines'],()=>{window.search()});return true}return false};
  if(!bind()){let n=0;const iv=setInterval(()=>{if(bind()||++n>40)clearInterval(iv)},200)}
 }
 hook();setTimeout(hook,300);setTimeout(hook,1500);
})();

/* ── v72: 입력칸 배치 편집 (전 화면 공용) ──────────────────────────────
 * 입력칸을 0.6초 길게 누르면 편집모드가 된다.
 *   · 오른쪽 주황 핸들 드래그  = 폭 조절
 *   · 칸 자체를 드래그해 다른 칸 위에 놓기 = 같은 그리드 안에서 자리 바꿈 (항목명과 함께 이동)
 * 바꾼 배치는 ui_layout(user_key='*') 에 저장되어 전 사용자 화면에 공통 적용된다.
 * (다른 사용자가 열어둔 화면도 DB 변경 알림을 받아 즉시 따라온다)
 * 편집은 마스터(role='master')만 가능. 일반 사용자는 적용만 받는다. */
(function(){
 const PAGE=(location.pathname.split('/').pop()||'').replace(/\.html?$/,'');
 if(!PAGE||PAGE==='index')return;
 const st=document.createElement('style');
 st.textContent=`
 body.mes-le-on input:not([type=checkbox]):not([type=radio]),body.mes-le-on select,body.mes-le-on textarea,body.mes-le-on .mescb{cursor:move!important}
 .mes-le-sel{outline:2px dashed #e0801a!important;outline-offset:1px}
 .mes-le-drop{outline:2px solid #2f75b5!important;outline-offset:1px}
 #mesleH{position:fixed;width:9px;cursor:ew-resize;z-index:9998;background:#e0801a;border-radius:2px;opacity:.85}
 #mesleBar{position:fixed;right:12px;bottom:50px;z-index:9999;background:#fff8ee;border:1px solid #e0a35a;border-radius:4px;padding:5px 8px;font-size:12px;display:flex;gap:5px;align-items:center;box-shadow:0 2px 8px rgba(0,0,0,.2);white-space:nowrap}
 #mesleBar button{height:25px;padding:0 8px;border:1px solid #9ba8b4;background:linear-gradient(#fff,#dfe6eb);cursor:pointer;font:inherit}
 #mesleBar b{color:#b45f06}#mesleBar .id{color:#5a6b7a;min-width:90px}#mesleBar .tip{color:#8a97a3}
 #mesleBar input{width:64px;height:25px;border:1px solid #9ba8b4;padding:0 5px;text-align:right;font:inherit}
 #mesleBar button[data-a=save]{border-color:#e0801a;background:linear-gradient(#fff5e8,#f6d6ab);font-weight:700}
 #mesleBar.dirty button[data-a=save]{background:linear-gradient(#ffe9c9,#f0b45f)}`;
 (document.head||document.documentElement).appendChild(st);

 const FQ='input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not(.mescb-in),select,textarea';
 const auth=()=>{try{return window.MES_AUTH||window.parent.MES_AUTH||null}catch(e){return window.MES_AUTH||null}};
 const KEY='*';                                /* 전 사용자 공통 */
 const isMaster=()=>{const a=auth();return !!a&&a.role==='master'};
 const isGrid=el=>{try{const d=getComputedStyle(el).display;return d==='grid'||d==='inline-grid'}catch(e){return false}};
 const visual=el=>el.__mescbBox?el.__mescbBox.wrap:el;
 const srcOf=t=>{if(!t||t.nodeType!==1)return null;
  const w=t.closest('.mescb');if(w)return w.querySelector('input:not(.mescb-in),select');
  return t.matches(FQ)?t:null};
 /* 그리드 직계 셀과 그리드 */
 function gridOf(el){let c=visual(el);while(c&&c.parentElement){const p=c.parentElement;if(isGrid(p))return{grid:p,cell:c};c=p}return null}
 const isLab=n=>!!n&&n.nodeType===1&&/(^|\s)(label|lab|lb)(\s|$)/.test(n.className);
 const pairOf=cell=>isLab(cell.previousElementSibling)?[cell.previousElementSibling,cell]:[cell];
 function tracks(grid){
  let s='';try{s=getComputedStyle(grid).gridTemplateColumns||''}catch(e){return []}
  if(!s||s==='none')return [];
  /* 레이아웃 전이면 computed 값에 repeat() 가 그대로 남는다 → 펴서 실제 열 수를 맞춘다 */
  s=s.replace(/repeat\((\d+),([^()]*(?:\([^()]*\)[^()]*)*)\)/g,(m,n,inner)=>Array(+n).fill(inner.trim()).join(' '));
  if(/repeat\(|auto-fill|auto-fit|\[/.test(s))return [];
  const o=[];let d=0,c='';
  for(const ch of s){if(ch==='(')d++;if(ch===')')d--;if(ch===' '&&!d){if(c)o.push(c);c=''}else c+=ch}if(c)o.push(c);
  return o.length>1?o:[]}
 function colOf(grid,cell){const t=tracks(grid);if(!t.length)return-1;return[...grid.children].indexOf(cell)%t.length}
 /* 그리드 안의 필드(id 있는 것) → 셀 단위로 중복 제거 */
 function fields(grid){const out=[],seen=new Set();grid.querySelectorAll(FQ).forEach(el=>{if(!el.id)return;
  const g=gridOf(el);if(!g||g.grid!==grid||seen.has(g.cell))return;seen.add(g.cell);out.push({el,cell:g.cell})});return out}

 /* ── 적용 ── */
 const S={};                                   /* elem_id → {width, ord} */
 function setWidth(el,w){
  const g=gridOf(el);const v=visual(el);
  el.classList.remove('mes-fit');v.classList.remove('mes-fit');
  el.style.width=w+'px';el.style.maxWidth='none';v.style.width=w+'px';v.style.maxWidth='none';
  if(g){const ci=colOf(g.grid,g.cell);if(ci>=0){const t=tracks(g.grid);t[ci]=w+'px';g.grid.style.gridTemplateColumns=t.join(' ')}}
 }
 function applyOrder(grid){
  const fs=fields(grid);const has=fs.filter(f=>S[f.el.id]&&S[f.el.id].ord!=null);if(has.length<2)return;
  const sorted=has.slice().sort((a,b)=>S[a.el.id].ord-S[b.el.id].ord);
  if(has.every((f,i)=>f===sorted[i]))return;             /* 이미 그 순서 */
  const head=new Map();has.forEach((f,i)=>head.set(pairOf(f.cell)[0],sorted[i]));   /* 자리의 첫 셀 → 그 자리에 올 필드 */
  const skip=new Set();has.forEach(f=>pairOf(f.cell).forEach(c=>skip.add(c)));
  const out=[];for(const c of [...grid.children]){
   if(head.has(c)){pairOf(head.get(c).cell).forEach(x=>out.push(x));continue}
   if(skip.has(c))continue;out.push(c)}
  out.forEach(c=>grid.appendChild(c));
 }
 function applyAll(){
  const grids=new Set();
  document.querySelectorAll(FQ).forEach(el=>{if(!el.id||!S[el.id])return;const g=gridOf(el);if(g)grids.add(g.grid)});
  grids.forEach(applyOrder);
  document.querySelectorAll(FQ).forEach(el=>{const s=el.id&&S[el.id];if(s&&s.width)setWidth(el,s.width)});
 }
 async function load(){
  for(let i=0;i<80&&!window.MESDB;i++)await new Promise(r=>setTimeout(r,50));
  if(!window.MESDB)return;try{await MESDB.ready}catch(e){}
  if(!MESDB.online)return;
  let rows=[];try{rows=await MESDB.table('ui_layout').select(`select=elem_id,width,ord&page=eq.${encodeURIComponent(PAGE)}&user_key=eq.*`)}catch(e){return}
  for(const k in S)delete S[k];
  for(const r of rows||[])S[r.elem_id]={width:r.width,ord:r.ord};
  applyAll();setTimeout(applyAll,800);setTimeout(applyAll,1800);
  if(!load.bound&&MESDB.onChange){load.bound=1;MESDB.onChange(['ui_layout'],()=>{if(!on)load()})}   /* 다른 사용자가 바꾸면 따라온다 */
 }
 async function persist(ids,key){
  if(!window.MESDB||!MESDB.online)return;
  const rows=ids.filter(id=>S[id]).map(id=>({page:PAGE,elem_id:id,user_key:key,width:S[id].width??null,ord:S[id].ord??null,updated_at:new Date().toISOString()}));
  if(rows.length)try{await MESDB.table('ui_layout').upsert(rows,'page,elem_id,user_key');try{MESDB.notify&&MESDB.notify(['ui_layout'])}catch(e){}}catch(e){hint('저장 실패: '+String(e.message||e).slice(0,60))}
 }
 async function wipe(key){try{await MESDB.table('ui_layout').delete({page:PAGE,user_key:key})}catch(e){}}

 /* ── 편집모드 UI ── */
 let on=false,sel=null,bar=null,hand=null,drag=null,press=null;
 const dirty=new Set();                        /* 아직 저장하지 않은 항목 */
 const mark=id=>{dirty.add(id);if(bar){bar.classList.add('dirty');hint('저장 안 됨 '+dirty.size+'건 — [저장]을 누르세요')}};
 const hint=t=>{if(bar)bar.querySelector('.tip').textContent=t};
 function ui(){
  if(bar)return;
  bar=document.createElement('div');bar.id='mesleBar';
  bar.innerHTML=`<b>배치 편집(전체 공통)</b><span class="id"></span>`+
   `<span>폭</span><input type="number" class="w" min="60" max="900" step="5" title="선택한 칸의 폭(px). 입력 후 Enter"><span>px</span>`+
   `<button data-a="save">▤ 저장</button><button data-a="reset">초기화</button><button data-a="close">닫기(Esc)</button>`+
   `<span class="tip">핸들 드래그=폭 · 칸 드래그=자리 이동</span>`;
  const wi=bar.querySelector('.w');
  const applyW=()=>{if(!sel)return;const v=Math.max(60,Math.min(900,Math.round(Number(wi.value)||0)));
   if(!v)return;wi.value=v;setWidth(sel,v);S[sel.id]=Object.assign(S[sel.id]||{},{width:v});mark(sel.id);place()};
  wi.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();applyW()}e.stopPropagation()});
  wi.addEventListener('change',applyW);
  wi.addEventListener('mousedown',e=>e.stopPropagation());
  bar.addEventListener('click',async e=>{const a=e.target.dataset.a;if(!a)return;
   if(a==='close')exit();
   else if(a==='save'){if(!dirty.size){hint('바뀐 내용이 없습니다.');return}
    const ids=[...dirty];hint('저장 중…');await persist(ids,KEY);dirty.clear();bar.classList.remove('dirty');
    hint(ids.length+'건 저장됨 — 전 사용자에게 적용됩니다.')}
   else if(a==='reset'){if(confirm('이 화면의 배치를 원래대로 되돌릴까요? (전 사용자에게 적용)')){await wipe(KEY);try{MESDB.notify&&MESDB.notify(['ui_layout'])}catch(e){}location.reload()}}
  });
  document.body.appendChild(bar);
  hand=document.createElement('div');hand.id='mesleH';hand.style.display='none';document.body.appendChild(hand);
  hand.addEventListener('mousedown',e=>{if(!sel)return;e.preventDefault();e.stopPropagation();
   drag={mode:'size',el:sel,x0:e.clientX,w0:visual(sel).getBoundingClientRect().width}});
 }
 function place(){if(!sel||!hand)return;const r=visual(sel).getBoundingClientRect();
  hand.style.display='';hand.style.left=(r.right-4)+'px';hand.style.top=r.top+'px';hand.style.height=r.height+'px'}
 function select(el){if(sel)visual(sel).classList.remove('mes-le-sel');sel=el;
  if(el){visual(el).classList.add('mes-le-sel');bar.querySelector('.id').textContent='#'+el.id;
   const wi=bar.querySelector('.w');if(wi)wi.value=Math.round(visual(el).getBoundingClientRect().width);place()}
  else if(hand)hand.style.display='none'}
 function enter(el){if(!isMaster())return;if(!on){on=true;document.body.classList.add('mes-le-on');ui()}select(el)}
 function exit(){if(dirty.size&&!confirm('저장하지 않은 변경이 '+dirty.size+'건 있습니다. 저장하지 않고 닫을까요?'))return;dirty.clear();on=false;document.body.classList.remove('mes-le-on');select(null);if(bar){bar.remove();bar=null}if(hand){hand.remove();hand=null}drag=null}

 /* 길게 누르기 → 편집모드. 편집모드 안에서는 클릭=선택+이동 드래그 시작 */
 document.addEventListener('mousedown',e=>{
  if(e.button!==0)return;
  const el=srcOf(e.target);
  if(on){
   if(e.target.closest('#mesleBar,#mesleH'))return;
   e.preventDefault();e.stopPropagation();
   if(!el||!el.id||!gridOf(el))return;
   select(el);drag={mode:'move',el,x0:e.clientX,y0:e.clientY,moved:false,over:null};return;
  }
  if(!el||!el.id||!gridOf(el)||!isMaster())return;
  press={el,x:e.clientX,y:e.clientY,t:setTimeout(()=>{press=null;enter(el);
   try{el.blur();if(el.__mescbBox)el.__mescbBox.inp.blur();document.activeElement&&document.activeElement.blur()}catch(x){}
   drag={mode:'move',el,x0:e.clientX,y0:e.clientY,moved:false,over:null}},600)};
 },true);
 document.addEventListener('mousemove',e=>{
  if(press&&(Math.abs(e.clientX-press.x)>4||Math.abs(e.clientY-press.y)>4)){clearTimeout(press.t);press=null}
  if(!drag)return;e.preventDefault();
  if(drag.mode==='size'){const w=Math.max(60,Math.min(900,Math.round(drag.w0+e.clientX-drag.x0)));setWidth(drag.el,w);S[drag.el.id]=Object.assign(S[drag.el.id]||{},{width:w});place();const wi=bar&&bar.querySelector('.w');if(wi)wi.value=w;hint(w+'px');return}
  if(Math.abs(e.clientX-drag.x0)>4||Math.abs(e.clientY-drag.y0)>4)drag.moved=true;
  if(!drag.moved)return;
  const t=srcOf(document.elementFromPoint(e.clientX,e.clientY));
  if(drag.over&&drag.over!==t)visual(drag.over).classList.remove('mes-le-drop');
  const a=gridOf(drag.el),b=t&&t.id&&t!==drag.el?gridOf(t):null;
  drag.over=(b&&a&&b.grid===a.grid&&pairOf(b.cell).length===pairOf(a.cell).length)?t:null;
  if(drag.over)visual(drag.over).classList.add('mes-le-drop');
 },true);
 document.addEventListener('mouseup',async()=>{
  if(press){clearTimeout(press.t);press=null}
  if(!drag)return;const d=drag;drag=null;
  if(d.mode==='size'){place();mark(d.el.id);return}
  if(!d.over)return;
  visual(d.over).classList.remove('mes-le-drop');
  const a=gridOf(d.el),b=gridOf(d.over);const pa=pairOf(a.cell),pb=pairOf(b.cell);
  const g=a.grid,ma=document.createComment(''),mb=document.createComment('');
  g.insertBefore(ma,pa[0]);g.insertBefore(mb,pb[0]);
  pa.forEach(n=>g.insertBefore(n,mb));pb.forEach(n=>g.insertBefore(n,ma));ma.remove();mb.remove();
  /* 이 그리드 안 모든 필드의 순서를 기록 */
  const fs=fields(g);fs.forEach((f,i)=>{S[f.el.id]=Object.assign(S[f.el.id]||{},{ord:i})});
  fs.forEach(f=>{if(S[f.el.id].width)setWidth(f.el,S[f.el.id].width)});
  place();fs.forEach(f=>mark(f.el.id));
 },true);
 document.addEventListener('keydown',e=>{if(on&&e.key==='Escape'){e.preventDefault();e.stopPropagation();exit()}},true);
 window.addEventListener('scroll',place,true);window.addEventListener('resize',place);

 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
 window.MESLAYOUT={apply:applyAll,state:S,edit:enter,exit};
})();

/* ── v77: 금액 입력칸 천단위 쉼표 (전 화면 공용) ──────────────────────
 * 화면에는 1,234,567 로 보이고, 화면 코드가 .value 로 읽으면 항상 1234567 이 온다
 * (value 속성을 감싸서 getter 는 쉼표를 뺀 값, setter 는 쉼표를 넣은 표시).
 * 대상: id/name 에 price·amount·amt·cost·nego·quote… 가 들어가는 input,
 *       또는 class=num 이면서 항목명이 …가/금액/단가/원가/비용 인 input.
 * 제외: rate·pct·qty·cnt·days·code·date·no 등 수량·비율·코드성 칸, 콤보, data-nomoney. */
(function(){
 const MONEY=/(price|amount|amt|cost|nego|quote|budget|fee|pay|revenue|profit|won|salary|wage)/i;
 const NOT=/(rate|pct|percent|ratio|qty|cnt|count|days|minute|min\b|hour|seq|code|phone|tel|zip|date|_no\b|no$|id$|ver|rev)/i;
 const LAB=/(가|금액|단가|비용|원가|경비|이익금|매입|매출|합계|급여)\s*(\(.*\))?$/;
 const isLab=n=>!!n&&n.nodeType===1&&/(^|\s)(label|lab|lb)(\s|$)/.test(n.className);
 function labelText(el){
  let n=el.previousElementSibling;if(isLab(n))return n.textContent.trim();
  const p=el.parentElement;if(p){n=p.previousElementSibling;if(isLab(n))return n.textContent.trim()}
  return '';
 }
 function isMoney(el){
  if(!el||el.tagName!=='INPUT')return false;
  const t=(el.getAttribute('type')||'text').toLowerCase();
  if(!['text','number','tel'].includes(t))return false;
  if(el.hasAttribute('data-nomoney')||el.classList.contains('mescb-in')||el.classList.contains('cbo')||el.hasAttribute('list'))return false;
  if(el.hasAttribute('data-money'))return true;
  const key=(el.id||'')+' '+(el.name||'');
  if(NOT.test(key))return false;
  if(MONEY.test(key))return true;
  if(el.classList.contains('num')&&LAB.test(labelText(el).replace(/\s+/g,'')))return true;
  return false;
 }
 const raw=v=>String(v??'').replace(/,/g,'');
 function fmt(v){
  const s=raw(v).trim();if(s===''||s==='-')return s;
  if(!/^-?\d*(\.\d*)?$/.test(s))return s;              /* 숫자 아닌 글자는 건드리지 않음 */
  const neg=s.startsWith('-');let [i,d]=s.replace('-','').split('.');
  i=i.replace(/^0+(?=\d)/,'');
  return (neg?'-':'')+i.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(d!=null?'.'+d:'');
 }
 const D=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
 function enhance(el){
  if(el.__mesMoney||!D||!D.get||!D.set)return;el.__mesMoney=1;
  if((el.getAttribute('type')||'').toLowerCase()==='number'){el.setAttribute('type','text');el.setAttribute('inputmode','decimal')}
  if(!el.style.textAlign)el.style.textAlign='right';
  const own=Object.getOwnPropertyDescriptor(el,'value');       /* 다른 모듈이 이미 감쌌으면 그 위에 얹는다 */
  const g=own&&own.get?()=>own.get.call(el):()=>D.get.call(el);
  const s=own&&own.set?v=>own.set.call(el,v):v=>D.set.call(el,v);
  Object.defineProperty(el,'value',{configurable:true,enumerable:true,
   get(){return raw(g())},
   set(v){s(document.activeElement===el?raw(v):fmt(v))}});
  el.addEventListener('focus',()=>{const v=raw(g());if(v!==g())s(v)});
  el.addEventListener('blur',()=>{const v=fmt(g());if(v!==g())s(v)});
  const v0=fmt(g());if(v0!==g())s(v0);
 }
 function scan(root){(root&&root.querySelectorAll?root:document).querySelectorAll('input').forEach(el=>{try{if(isMoney(el))enhance(el)}catch(e){}})}
 const run=()=>scan(document);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
 setTimeout(run,500);setTimeout(run,1500);
 new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(n.nodeType===1)scan(n.parentNode||document)})
  .observe(document.documentElement,{childList:true,subtree:true});
 window.MESMONEY={fmt,raw,scan:run,isMoney};
})();
