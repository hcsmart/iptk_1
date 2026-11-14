/* v348: 공용 출력 — [🖨 출력 ▾] 버튼 하나로 A4 인쇄 · A3 인쇄 · PDF 저장 · Excel 저장
 *  - 인쇄·PDF : 지금 화면 모습 그대로 찍어서(html2canvas) 용지(가로)에 맞춘다. 스크롤에 가려진 행까지 전부, 행 중간에서 안 잘리게 나눈다.
 *  - Excel    : 화면마다 넘겨준 excel(ExcelJS) 함수가 서식 있는 양식(테두리·색·병합)으로 만든다.
 *  사용: MESPRINT.mount({where, capture, expand, hide, breaks, title, name, excel})
 */
(function(){
if(window.MESPRINT)return;
const CDN={h2c:'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
 pdf:'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
 xl:'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js'};
const PAPER={A4:[297,210],A3:[420,297]};   /* 가로(mm) */
const MARGIN=6;
const lib=(src,test)=>test()?Promise.resolve():new Promise((ok,ng)=>{const s=document.createElement('script');s.src=src;s.onload=ok;
 s.onerror=()=>ng(new Error('출력 모듈을 불러오지 못했습니다 (인터넷 연결 확인)'));document.head.appendChild(s)});
const say=t=>{const m=document.getElementById('message');if(m)m.textContent=t;else console.log(t)};
const stamp=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`};
const safe=s=>String(s||'').replace(/[\\/:*?"<>|\s]+/g,'_');

const css=document.createElement('style');
css.textContent=`
.prtwrap{margin-left:auto;position:relative;font-weight:400;display:inline-flex}
.prtbtn{height:24px;min-width:0;padding:0 10px;font-size:11.5px;font-weight:700;border:1px solid #6f9cc4;background:linear-gradient(#e9f3fc,#c9def0);cursor:pointer;color:#22303a;white-space:nowrap}
.prtbtn:hover{background:#fff}
.prtmenu{display:none;position:absolute;right:0;top:27px;z-index:60;min-width:176px;background:#fff;border:1px solid #8fa3b5;box-shadow:0 3px 10px rgba(0,0,0,.18);padding:3px 0}
.prtmenu.on{display:block}
.prtmenu button{display:flex;width:100%;gap:8px;align-items:center;border:0;background:transparent;padding:6px 12px;text-align:left;cursor:pointer;font:inherit;font-size:12px;color:#344757}
.prtmenu button:hover{background:#edf6fd}.prtmenu i{font-style:normal;width:18px;text-align:center}.prtmenu small{margin-left:auto;color:#8b98a3;font-size:10.5px}
.prtmenu hr{border:0;border-top:1px solid #e1e7ec;margin:3px 0}
#mesprtHost{display:none}
html.mesprt-cap,html.mesprt-cap body{overflow:visible!important;height:auto!important}
html.mesprt-cap .screen{height:auto!important;min-height:0!important}
html.mesprt-cap .prtwrap,html.mesprt-cap .foot{display:none!important}
@media print{
 html,body{overflow:visible!important;height:auto!important;background:#fff!important}
 body>*:not(#mesprtHost){display:none!important}
 #mesprtHost{display:block!important}
 #mesprtHost .pg{break-after:page;page-break-after:always;display:flex;align-items:flex-start;justify-content:center}
 #mesprtHost .pg:last-child{break-after:auto;page-break-after:auto}
 #mesprtHost img{display:block;max-width:100%;object-fit:contain}
}`;
document.head.appendChild(css);

/* ── 화면 찍기: 스크롤 칸을 펼치고, 가리는 것(버튼·하단바)을 숨긴 채로 찍는다 ── */
async function snap(o){
 await lib(CDN.h2c,()=>window.html2canvas);
 const root=o.capture();const html=document.documentElement;
 const saved=[];
 const tmp=(el,k,v)=>{saved.push([el,k,el.style.getPropertyValue(k),el.style.getPropertyPriority(k)]);el.style.setProperty(k,v,'important')};
 html.classList.add('mesprt-cap');
 (o.hide||[]).forEach(s=>document.querySelectorAll(s).forEach(el=>tmp(el,'display','none')));
 if(o.expand)document.querySelectorAll(o.expand).forEach(el=>{el.scrollTop=0;el.scrollLeft=0;tmp(el,'overflow','visible');tmp(el,'height','auto');tmp(el,'max-height','none');tmp(el,'flex','none')});
 /* 빈 칸의 안내 글자(placeholder, 예: '예) MAZ…')가 실제 값처럼 찍히지 않게 잠시 지운다 */
 const ph=[...root.querySelectorAll('[placeholder]')].map(el=>[el,el.getAttribute('placeholder')]);ph.forEach(([el])=>el.setAttribute('placeholder',''));
 /* 여러 줄 메모(textarea)는 줄바꿈이 사라지므로 같은 모양의 글 상자로 잠시 바꿔 찍는다 */
 const tas=[...root.querySelectorAll('textarea')].filter(t=>t.offsetParent).map(t=>{const cs=getComputedStyle(t),d=document.createElement('div');
  ['width','height','margin','padding','border','font','color','background','line-height','box-sizing'].forEach(k=>d.style.setProperty(k,cs.getPropertyValue(k)));
  d.style.width=t.offsetWidth+'px';d.style.height=t.offsetHeight+'px';d.style.whiteSpace='pre-wrap';d.style.overflow='hidden';d.style.wordBreak='break-all';
  d.textContent=t.value;t.after(d);tmp(t,'display','none');return d});
 const sx=window.scrollX,sy=window.scrollY;window.scrollTo(0,0);
 try{
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  if(o.beforeSnap)try{o.beforeSnap()}catch(e){}
  const W=Math.max(root.scrollWidth,root.getBoundingClientRect().width),H=Math.max(root.scrollHeight,root.getBoundingClientRect().height);
  if(W>root.getBoundingClientRect().width+1)tmp(root,'width',W+'px');
  const top=root.getBoundingClientRect().top;
  const br=[...new Set([...root.querySelectorAll(o.breaks||'tr')].map(el=>Math.round(el.getBoundingClientRect().top-top)).filter(y=>y>0&&y<H))].sort((a,b)=>a-b);
  const scale=Math.min(2,Math.max(1,6000/W));
  const opt={scale,backgroundColor:'#ffffff',useCORS:true,width:W,height:H,windowWidth:Math.max(window.innerWidth,W),scrollX:0,scrollY:0,
   ignoreElements:el=>el.id==='mesprtHost'||el.classList?.contains('prtwrap')};
  let cv=await html2canvas(root,opt);
  try{cv.toDataURL('image/png').length}catch(e){cv=await html2canvas(root,{...opt,useCORS:false,ignoreElements:el=>opt.ignoreElements(el)||el.tagName==='IMG'})}
  return {cv,breaks:br.map(y=>Math.round(y*scale)),scale};
 }finally{
  saved.reverse().forEach(([el,k,v,p])=>{if(v)el.style.setProperty(k,v,p);else el.style.removeProperty(k)});
  ph.forEach(([el,v])=>el.setAttribute('placeholder',v));tas.forEach(d=>d.remove());
  html.classList.remove('mesprt-cap');window.scrollTo(sx,sy);
  if(o.afterSnap)try{o.afterSnap()}catch(e){}
 }
}

/* ── 용지에 나누기: 위쪽에 제목줄을 그리고, 행 경계에서 자른다. 1.25쪽 이하이면 한 장에 줄여 넣는다 ── */
function paginate(s,size,title){
 const [pw,ph]=PAPER[size];const cw=pw-MARGIN*2,ch=ph-MARGIN*2;
 const {cv,breaks,scale}=s;
 const headH=Math.round(30*scale);
 const pageHpx=Math.floor(cv.width*ch/cw)-headH;
 const out=[];
 const draw=(y,h,shrink)=>{
  const k=shrink||1;
  const c=document.createElement('canvas');c.width=cv.width;c.height=Math.round((h*k)+headH);
  const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);
  g.fillStyle='#1d3f5f';g.font=`bold ${Math.round(15*scale)}px "Malgun Gothic","맑은 고딕",sans-serif`;g.textBaseline='middle';
  g.fillText(title||document.title,Math.round(6*scale),headH/2);
  g.font=`${Math.round(11*scale)}px "Malgun Gothic","맑은 고딕",sans-serif`;g.fillStyle='#666';
  const r=`출력 ${stamp()}`;const tw=g.measureText(r).width;g.fillText(r,c.width-tw-Math.round(6*scale),headH/2);
  g.strokeStyle='#2f5f8a';g.lineWidth=Math.max(1,scale);g.beginPath();g.moveTo(0,headH-2);g.lineTo(c.width,headH-2);g.stroke();
  g.drawImage(cv,0,y,cv.width,h,(c.width-cv.width*k)/2,headH,cv.width*k,h*k);
  out.push(c);
 };
 if(cv.height<=pageHpx*1.25){draw(0,cv.height,Math.min(1,pageHpx/cv.height));return out}
 let y=0;
 while(y<cv.height){
  let end=Math.min(cv.height,y+pageHpx);
  if(end<cv.height){const ok=breaks.filter(b=>b>y+pageHpx*0.45&&b<=end);if(ok.length)end=ok[ok.length-1]}
  draw(y,end-y);y=end;
 }
 out.forEach((c,i)=>{const g=c.getContext('2d');g.font=`${Math.round(10*scale)}px sans-serif`;g.fillStyle='#888';
  const t=`${i+1} / ${out.length}`;g.fillText(t,(c.width-g.measureText(t).width)/2,c.height-Math.round(4*scale))});
 return out;
}

async function doPrint(o,size){
 say(`${size} 인쇄 준비 중… (화면을 찍고 있습니다)`);
 try{
  const pages=paginate(await snap(o),size,o.title&&o.title());
  let host=document.getElementById('mesprtHost');if(!host){host=document.createElement('div');host.id='mesprtHost';document.body.appendChild(host)}
  const [pw,ph]=PAPER[size],cw=pw-MARGIN*2,ch=ph-MARGIN*2;
  host.innerHTML='';
  for(const c of pages){const d=document.createElement('div');d.className='pg';d.style.height=ch+'mm';
   const im=new Image();im.src=c.toDataURL('image/png');im.style.width=cw+'mm';im.style.maxHeight=ch+'mm';d.appendChild(im);host.appendChild(d);
   try{await im.decode()}catch(e){}}
  let ps=document.getElementById('mesprtPage');if(!ps){ps=document.createElement('style');ps.id='mesprtPage';document.head.appendChild(ps)}
  ps.textContent=`@page{size:${size} landscape;margin:${MARGIN}mm}`;
  say(`${size} 가로 ${pages.length}장 — 인쇄 창에서 프린터·용지(${size})를 확인하세요.`);
  window.focus();window.print();
 }catch(e){say('인쇄 준비 실패: '+String(e.message||e).slice(0,120))}
}
window.addEventListener('afterprint',()=>{const h=document.getElementById('mesprtHost');if(h)h.innerHTML=''});

async function doPdf(o){
 say('PDF 만드는 중… (화면을 찍고 있습니다)');
 try{
  await lib(CDN.pdf,()=>window.jspdf);
  const size='A4',pages=paginate(await snap(o),size,o.title&&o.title());
  const [pw,ph]=PAPER[size],cw=pw-MARGIN*2,ch=ph-MARGIN*2;
  const pdf=new window.jspdf.jsPDF({unit:'mm',format:'a4',orientation:'landscape'});
  pages.forEach((c,i)=>{if(i)pdf.addPage('a4','landscape');
   let w=cw,h=c.height*cw/c.width;if(h>ch){h=ch;w=c.width*ch/c.height}
   pdf.addImage(c.toDataURL('image/jpeg',0.92),'JPEG',MARGIN+(cw-w)/2,MARGIN,w,h)});
  const f=o.name('pdf');pdf.save(f);say(`${f} (A4 가로 ${pages.length}장) 저장했습니다.`);
 }catch(e){say('PDF 저장 실패: '+String(e.message||e).slice(0,120))}
}

async function doXlsx(o){
 say('엑셀 만드는 중…');
 try{
  await lib(CDN.xl,()=>window.ExcelJS);
  const wb=await o.excel(window.ExcelJS,XL);
  const buf=await wb.xlsx.writeBuffer();
  const f=o.name('xlsx');const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  a.download=f;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500);
  say(`${f} 저장했습니다.`);
 }catch(e){say('엑셀 저장 실패: '+String(e.message||e).slice(0,120))}
}

/* ── 엑셀 서식 도우미 (화면별 양식에서 같이 쓴다) ── */
const thin={style:'thin',color:{argb:'FF7D8B97'}};
const XL={
 stamp,
 border:{top:thin,left:thin,bottom:thin,right:thin},
 fill:c=>({type:'pattern',pattern:'solid',fgColor:{argb:'FF'+c}}),
 C:{head:'E8EFF5',sect:'C8DBE9',goal:'F4F9FF',goalHead:'D9E8F5',late:'FFE45C',early:'E6F6E6',total:'DFE9F2',label:'F3F6F9'},
 font:(o)=>({name:'맑은 고딕',size:10,...(o||{})}),
 /* 칸 하나 채우기: v=값, s={b(굵게),fill,al(가로),num(숫자서식),wrap,color,size} */
 put(ws,addr,v,s){s=s||{};const c=ws.getCell(addr);c.value=v===undefined?null:v;
  c.font=XL.font({bold:!!s.b,color:s.color?{argb:'FF'+s.color}:undefined,size:s.size||10});
  c.alignment={vertical:'middle',horizontal:s.al||'left',wrapText:s.wrap!==false};
  if(s.fill)c.fill=XL.fill(s.fill);if(s.num)c.numFmt=s.num;if(s.border!==false)c.border=XL.border;return c},
 /* 병합 + 병합 범위 전체에 테두리 */
 merge(ws,r1,c1,r2,c2,v,s){for(let r=r1;r<=r2;r++)for(let c=c1;c<=c2;c++){const x=ws.getCell(r,c);x.border=XL.border;if(s&&s.fill)x.fill=XL.fill(s.fill)}
  if(r1!==r2||c1!==c2)ws.mergeCells(r1,c1,r2,c2);return XL.put(ws,ws.getCell(r1,c1).address,v,s)},
 num:v=>{const s=String(v??'').replace(/,/g,'').trim();return s!==''&&isFinite(Number(s))?Number(s):(v??'')},
 /* 그림(URL)을 PNG 로 바꿔 넣는다 — 다른 서버 그림이 막히면 건너뜀 */
 async image(wb,url,max){if(!url)return null;
  try{const im=await new Promise((ok,ng)=>{const i=new Image();i.crossOrigin='anonymous';i.onload=()=>ok(i);i.onerror=ng;i.src=url;setTimeout(ng,6000)});
   const k=Math.min(1,(max||300)/Math.max(im.naturalWidth,im.naturalHeight));const c=document.createElement('canvas');
   c.width=Math.max(1,Math.round(im.naturalWidth*k));c.height=Math.max(1,Math.round(im.naturalHeight*k));c.getContext('2d').drawImage(im,0,0,c.width,c.height);
   return {id:wb.addImage({base64:c.toDataURL('image/png'),extension:'png'}),w:c.width,h:c.height}}catch(e){return null}},
 page(ws,o){ws.pageSetup={paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,horizontalCentered:true,
  margins:{left:.3,right:.3,top:.4,bottom:.4,header:.2,footer:.2},...(o||{})}}
};

function mount(o){
 const where=typeof o.where==='string'?document.querySelector(o.where):o.where;if(!where)return;
 const w=document.createElement('span');w.className='prtwrap';
 w.innerHTML=`<button type="button" class="prtbtn" title="인쇄하거나 PDF·엑셀 파일로 내려받습니다">🖨 출력 ▾</button><span class="prtmenu">
  <button type="button" data-k="A4"><i>🖨</i>A4 인쇄<small>가로</small></button>
  <button type="button" data-k="A3"><i>🖨</i>A3 인쇄<small>가로</small></button><hr>
  <button type="button" data-k="PDF"><i>📄</i>PDF 저장<small>화면 그대로</small></button>
  <button type="button" data-k="XLSX"><i>▦</i>Excel 저장<small>양식</small></button></span>`;
 where.appendChild(w);
 const menu=w.querySelector('.prtmenu');let busy=false;
 w.querySelector('.prtbtn').addEventListener('click',e=>{e.stopPropagation();menu.classList.toggle('on')});
 document.addEventListener('click',e=>{if(!w.contains(e.target))menu.classList.remove('on')});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')menu.classList.remove('on')});
 menu.addEventListener('click',async e=>{const b=e.target.closest('button[data-k]');if(!b)return;menu.classList.remove('on');
  if(busy)return say('출력 중입니다. 잠시만 기다리세요.');busy=true;
  try{const k=b.dataset.k;if(o.check&&o.check(k)===false)return;
   if(k==='A4'||k==='A3')await doPrint(o,k);else if(k==='PDF')await doPdf(o);else await doXlsx(o)}finally{busy=false}});
 if(!o.name)o.name=ext=>`${safe(document.title)}_${stamp().slice(0,10).replace(/-/g,'')}.${ext}`;
}
window.MESPRINT={mount,XL,stamp,safe};
})();
