/* drawboard.js (v260: 가공계획 적용 결과 회신·확인창 이 창에서 · v221: 적용 공정 1열·나머지 3열 · v220: 공정 목록 3열 · v219: 확인란에 업체명(5자)·사내 표시, 공정명 한 줄 · v217: 그림에 박힌 머리글 자동 잘라내기 · v215: 공정 순서 띠 → 격자(확인란) + QR · v214: 이전·다음 품번은 열 때 받은 부품 리스트 순서로 · v213: ◀ 이전 · 다음 ▶ 품번 — 가공계획이 등록된 부품은 등록된 순서로, 아니면 띠 공정 그대로 / v212: 오른쪽 목록 끌어서 순서·해제 · 기준공정 불러오기 / v211: 공정 목록 — 선택한 공정 위 · 구분선 · 나머지 가나다 / v210: 그림 등록 / v209: 끌어서 순서) — 부품 그림보드 화면 스크립트
 * 사내외가공 발주(mes_drawboard.js)가 sessionStorage 'mes_drawboard' 에 넣어 준 자료를 읽어 그린다.
 * 문서를 스크립트로 써 넣지 않고(document.write 없음) DOM 만 만든다. */
(function(){
 const $=id=>document.getElementById(id);
 const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e};
 let o={};
 try{o=JSON.parse(sessionStorage.getItem('mes_drawboard')||'{}')||{}}catch(e){o={}}
 if(!o.part){try{o=JSON.parse(decodeURIComponent(location.hash.slice(1))||'{}')}catch(e){}}
 /* v206: 오른쪽 버튼은 공정 마스터 전체. 이 부품의 가공계획에 있는 공정은 "계획 n" 표시를 달고, ▶ 전체 순서대로 는 계획 순서로 넣는다 */
 let PLAN=(o.steps||[]);
 let STEPS=(o.all&&o.all.length?o.all:PLAN).map((s,i)=>({idx:i,code:String(s.code||'').trim(),name:s.name||'',inhouse:false,vendor:'',state:'',plan:[]}));
 PLAN.forEach((ps,k)=>{const c=String(ps.code||'').trim();let t=STEPS.find(x=>x.code===c||x.code.toUpperCase()===c.toUpperCase());
  if(!t){t={idx:STEPS.length,code:c,name:ps.name||c,inhouse:false,vendor:'',state:'',plan:[]};STEPS.push(t)}
  t.plan.push(k+1);if(!t.vendor)t.vendor=ps.vendor||'';if(!t.state)t.state=ps.state||'';if(ps.inhouse)t.inhouse=true;if(!t.name)t.name=ps.name||''});
 let PLANSEQ=[];PLAN.forEach(ps=>{const c=String(ps.code||'').trim();const t=STEPS.find(x=>x.code===c||x.code.toUpperCase()===c.toUpperCase());if(t&&!PLANSEQ.includes(t.idx))PLANSEQ.push(t.idx)});
 let SEQ=[];
 document.title='부품 그림보드 '+(o.job||'')+' '+(o.part||'');
 /* 머리글 */
 const meta=$('meta');
 function renderMeta(){meta.textContent='';
  [['제번',(o.job||'')+(o.item?' · '+o.item:'')],['품번',(o.part||'')+((Number(o.cyc)||1)>1||o.cycEnded?' ('+(Number(o.cyc)||1)+'차'+(o.cycEnded?' 종료':'')+')':'')],['부품명',o.name||''],['소요수량',o.qty==null?'':String(o.qty)],['작성',o.by||''],['일자',new Date().toISOString().slice(0,10)]]
   .forEach(([k,v])=>{meta.appendChild(el('b',null,k));meta.appendChild(el('span',null,v))});
  $('footL').textContent=(o.job||'')+' · '+(o.part||'')+((Number(o.cyc)||1)>1?' '+(Number(o.cyc)||1)+'차':'')+' '+(o.name||'');
  document.title='부품 그림보드 '+(o.job||'')+' '+(o.part||'')}
 renderMeta();
 /* 그림 */
 const fig=$('fig');
 /* v217: 그림 편집기가 그림 위에 넣은 머리글(제번·품번 · 품명·재질·규격 · 일자 + 가로줄)은 그림보드 머리글과 겹치므로 잘라낸다.
  *   편집기가 그린 가로줄(#9aa8b5, 폭 M~W-M, y=M+HH-30)을 찾으면 그 아래부터 보여준다. 못 찾으면(캡쳐 원본 등) 그대로. */
 function trimHeader(im){
  try{const w=im.naturalWidth,h=im.naturalHeight;if(!w||!h)return null;
   const K=Math.min(w,h)/1240,M=Math.round(40*K),y0=Math.round(70*K),y1=Math.round(190*K);   /* 편집기 A4 짧은 변 = 1240×K */
   const c=document.createElement('canvas');c.width=w;c.height=Math.min(h,y1+4);const x=c.getContext('2d');x.drawImage(im,0,0);
   const d=x.getImageData(0,0,w,c.height).data;
   let hit=-1;
   for(let y=y0;y<Math.min(c.height,y1);y++){let gray=0,n=0;
    for(let px=M+4;px<w-M-4;px+=3){const k=(y*w+px)*4,r=d[k],g=d[k+1],b=d[k+2];n++;if(r>130&&r<185&&g>145&&g<195&&b>160&&b<210&&b>=r)gray++}
    if(n&&gray/n>0.85){hit=y;break}}
   if(hit<0)return null;
   const top=Math.min(h-1,hit+Math.round(6*K));
   const o2=document.createElement('canvas');o2.width=w;o2.height=h-top;o2.getContext('2d').drawImage(im,0,top,w,h-top,0,0,w,h-top);
   return o2.toDataURL('image/png')}catch(e){return null}}
 function setFig(url){fig.textContent='';
  if(url){const im=el('img');im.alt=o.part||'';im.crossOrigin='anonymous';
   im.addEventListener('load',()=>{if(!im.__trim){im.__trim=1;const t=trimHeader(im);if(t){im.src=t;return}}if(!ORI_SET)setOri(bestOri(im.naturalWidth,im.naturalHeight))});
   im.addEventListener('error',()=>{if(im.crossOrigin){im.crossOrigin=null;im.__trim=1;im.src=url}});
   im.src=url;fig.appendChild(im)}
  else{const n=el('div','none');n.appendChild(el('div',null,'PartList 에 등록된 부품 그림이 없습니다.'));
   const b=el('button','addpic','📷 그림 등록 (캡쳐·이미지·PDF)');b.type='button';b.addEventListener('click',picOpen);n.appendChild(b);
   n.appendChild(el('small',null,'여기서 등록하면 PartList 부품 그림에도 같이 저장됩니다.'));fig.appendChild(n)}}
 setFig(o.image);
 /* 용지 방향: 세로 도면이면 자동 세로. @page 는 스타일을 바꿔 넣어 인쇄 방향을 맞춘다 */
 let ORI='landscape',ORI_SET=false;const pageSt=el('style');document.head.appendChild(pageSt);
 /* 도면 화소 비율로 가로·세로 중 도면이 더 크게 실리는 쪽을 고른다 (머리글 약 48mm 제외한 도면 영역: 가로 285×150, 세로 198×237) */
 function bestOri(w,h){if(!w||!h)return 'landscape';const L=Math.min(285/w,150/h),P=Math.min(198/w,237/h);return P>L*1.02?'portrait':'landscape'}
 function setOri(v){ORI=v;document.body.classList.toggle('portrait',v==='portrait');pageSt.textContent='@page{size:A4 '+v+';margin:6mm}';$('bOri').textContent='용지: '+(v==='portrait'?'세로':'가로')}
 $('bOri').addEventListener('click',()=>{ORI_SET=true;setOri(ORI==='portrait'?'landscape':'portrait')});
 /* 공정 버튼 */
 $('sideTitle').textContent='가공공정 전체 ('+STEPS.length+') · 계획 '+PLANSEQ.length;
 const btns=$('btns');
 if(!STEPS.length)btns.appendChild(el('div','hint','가공계획에 공정이 없습니다.'));
 function makeBtn(s){const b=el('button','pbtn');b.dataset.i=s.idx;b.type='button';
  const n=el('span','n');n.id='n'+s.idx;b.appendChild(n);
  b.appendChild(el('span','k',s.name||s.code||''));
  if(s.plan.length){b.classList.add('plan');b.appendChild(el('span','p','계획 '+s.plan.join(',')))}
  const hl=el('label','h');hl.title='사내가공이면 체크';const hc=el('input');hc.type='checkbox';hc.checked=!!s.inhouse;hc.addEventListener('click',e=>e.stopPropagation());hc.addEventListener('change',()=>{s.inhouse=hc.checked;draw()});hl.appendChild(hc);hl.appendChild(document.createTextNode('사내'));hl.addEventListener('click',e=>e.stopPropagation());b.appendChild(hl);
  {const vv=el('span','v',[s.vendor,s.state].filter(Boolean).join(' · '));vv.title=[s.name,s.vendor,s.state].filter(Boolean).join(' · ');b.appendChild(vv)}
  b.addEventListener('click',()=>{if(SUPPRESS)return;tg(s.idx)});
  b.addEventListener('pointerdown',e=>{if(e.button||e.target.closest('label'))return;dragStart(e,s.idx,'btn')});btns.appendChild(b);return b}
 STEPS.forEach(makeBtn);
 /* v213: 품번이 바뀌면 「계획 n」 표시 · 업체/상태만 새 부품 기준으로 다시 단다 (띠 순서 · 사내 체크는 그대로) */
 function planBadges(){STEPS.forEach(s=>{const b=btns.querySelector('.pbtn[data-i="'+s.idx+'"]');if(!b)return;
  const old=b.querySelector('.p');if(old)old.remove();b.classList.toggle('plan',!!s.plan.length);
  if(s.plan.length){const p=el('span','p','계획 '+s.plan.join(','));b.querySelector('.k').after(p)}
  const v=b.querySelector('.v');if(v)v.textContent=[s.vendor,s.state].filter(Boolean).join(' · ')})}
 /* v215: QR — 제번_공정(조)_품번 을 담은 현장용 링크(qr_work.html · 로그인 없음). 휴대폰 카메라로 읽으면 이 부품의 공정 목록이 열려 작업완료(외주=입고 처리 · 사내=가공 실적)를 할 수 있다 */
 /* v228: QR 키 = 제번_조_품번~차수 — 차수마다 QR 이 다르다 (옛 QR(차수 없음)은 현재 차수로 본다) */
 function qrKey(){return [o.job||'',String(o.jo??'1').replace(/조$/,'')||'1',o.part||''].join('_')+'~'+(Number(o.cyc)||1)}
 function qrUrl(){const base=location.href.replace(/[^/]*$/,'');return base+'qr_work.html?key='+encodeURIComponent(qrKey())}
 function qrBox(){const box=el('div','qr');
  try{if(window.qrcode){const q=qrcode(0,'M');q.addData(qrUrl());q.make();box.innerHTML=q.createSvgTag({cellSize:2,margin:0,scalable:true})}}catch(e){}
  if(!box.firstChild)box.appendChild(el('div','none','QR'));
  const cap=el('div','cap');cap.appendChild(el('b',null,'QR 스캔 → 작업완료'));cap.appendChild(el('span',null,qrKey()));box.appendChild(cap);
  /* v260: 가공계획 미저장 부품은 QR 화면에 발주된 공정만 나온다 → 알림 (인쇄에는 안 나옴) */
  if(!o.saved){const w=el('div','qrwarn','⚠ 가공계획 미저장 — [가공계획 적용] 후 QR 이 전체 공정을 보여줍니다');w.style.cssText='font-size:9px;color:#b45309;line-height:1.3;margin-top:2px';w.setAttribute('data-noprint','1');box.appendChild(w)}
  box.title='협력업체·사내 작업자가 휴대폰으로 읽으면(로그인 없음) 이 부품의 공정 목록이 열려 작업완료를 할 수 있습니다 — 외주: 입고 처리 · 사내: 가공 실적\n'+qrUrl();return box}
 function draw(){
  const st=$('strip');st.textContent='';
  const L=el('div','stripL');st.appendChild(L);
  const lab=el('div','lab');lab.appendChild(el('b',null,'가공공정 순서'));lab.appendChild(el('small',null,'확인란: 작업자 · 일자'));L.appendChild(lab);
  const grid=el('div','cells');L.appendChild(grid);
  /* 공정이 많을수록 글자를 조금 줄여 한 줄에 맞춘다 (4개 이하 12px … 10개 10px) */
  grid.style.setProperty('--fs',Math.max(9.5,Math.min(12,13-SEQ.length*0.3)).toFixed(1)+'px');grid.classList.toggle('many',SEQ.length>=8);
  if(!SEQ.length)grid.appendChild(el('span','empty','오른쪽 공정 버튼을 누르거나 여기로 끌어 오면 순서대로 표시됩니다.'));
  const LK=lockN();
  SEQ.forEach((i,k)=>{const s=STEPS[i];
   const cell=el('div','cell'+(s.inhouse?' house':''));cell.dataset.i=i;
   const lk=k<LK;const c=el('span','chip'+(lk?' lock':''));c.title=lk?(isDone(i)?'완료된 공정 — 빼기·옮기기 불가':'완료 공정 앞 순서 — 빼기·옮기기 불가'):'누르면 뺍니다 · 끌어서 순서를 바꿉니다';c.dataset.i=i;
   c.appendChild(el('span','n',String(k+1)));const nm=el('span','nm',s.name||s.code||'');nm.title=(s.name||s.code||'')+(s.vendor?' · '+s.vendor:'')+(s.inhouse?' · 사내':'');c.appendChild(nm);
   c.addEventListener('click',()=>{if(SUPPRESS)return;tg(i)});
   c.addEventListener('pointerdown',e=>{if(e.button)return;dragStart(e,i,'chip')});
   cell.appendChild(c);const sg=el('div','sign');
   /* v219: 발주된 업체명(앞 5자) 또는 「사내」 를 확인란 왼쪽 위에 — 작업자 서명은 그 아래 빈 자리에 */
   const who=s.inhouse?'사내':String(s.vendor||'').trim();
   if(who){const v=el('b','who',who.length>5?who.slice(0,5):who);v.title=who+(s.state?' · '+s.state:'');sg.appendChild(v)}
   sg.appendChild(el('i',null,'확인'));cell.appendChild(sg);grid.appendChild(cell)});
  st.appendChild(qrBox());
  STEPS.forEach(s=>{const b=btns.querySelector('.pbtn[data-i="'+s.idx+'"]'),n=$('n'+s.idx);const k=SEQ.indexOf(s.idx);
   if(b){b.classList.toggle('on',k>=0);b.classList.toggle('lock',k>=0&&k<LK);b.classList.toggle('done',isDone(s.idx))}if(n)n.textContent=k>=0?String(k+1):''});
  sortBtns();
 }
 /* v211: 오른쪽 공정 목록 — 띠에 들어간(적용된) 공정은 순서대로 위에, 구분선 아래 나머지는 가나다순 */
 let SEP=null;
 function sortBtns(){if(!STEPS.length)return;
  if(!SEP){SEP=el('div','psep')}
  const nm=s=>String(s.name||s.code||'');
  const on=SEQ.map(i=>STEPS[i]).filter(Boolean);
  const off=STEPS.filter(s=>SEQ.indexOf(s.idx)<0).sort((a,b)=>nm(a).localeCompare(nm(b),'ko',{numeric:true}));
  SEP.textContent=on.length?`▲ 적용 ${on.length} · 나머지 ${off.length} (가나다순)`:`공정 ${off.length} (가나다순) — 누르거나 띠로 끌어 오면 위로 올라갑니다`;
  const want=[...on.map(s=>btns.querySelector('.pbtn[data-i="'+s.idx+'"]')),SEP,...off.map(s=>btns.querySelector('.pbtn[data-i="'+s.idx+'"]'))].filter(Boolean);
  const cur=[...btns.children];if(want.length===cur.length&&want.every((e,k)=>cur[k]===e))return;
  want.forEach(e=>btns.appendChild(e))}
 /* v197: 완료(입고확정)된 공정은 잠금 — 띠의 맨 뒤 완료 공정까지(그 앞 공정 포함)는 빼기·옮기기 불가.
  *   그 뒤 공정만 넣기·빼기·앞뒤 이동이 되고, 잠긴 자리 앞으로는 끼워 넣을 수 없다 */
 const isDone=i=>{const s=STEPS[i];return !!s&&/^완료$|입고확정/.test(String(s.state||'').trim())};
 function lockN(){let n=0;SEQ.forEach((i,k)=>{if(isDone(i))n=k+1});return n}
 const isLocked=i=>{const k=SEQ.indexOf(i);return k>=0&&k<lockN()};
 function lockMsg(i){const s=STEPS[i];try{$('moveTip').textContent=`「${(s&&(s.name||s.code))||''}」 — 완료된 공정(또는 그 앞 공정)은 빼거나 옮길 수 없습니다. 완료 이후 공정만 순서를 바꿀 수 있습니다.`}catch(e){}}
 function tg(i){const k=SEQ.indexOf(i);if(k>=0){if(k<lockN()){lockMsg(i);return}SEQ.splice(k,1)}else SEQ.push(i);draw()}
 /* v209: 끌어서 순서 바꾸기 — 순서 칸(chip)을 끌어 다른 자리에 놓으면 순서가 바뀐다.
  *   오른쪽 공정 버튼을 순서 줄로 끌어 오면 놓은 자리에 끼워 넣는다(이미 있으면 그 자리로 옮김).
  *   6px 이상 움직여야 끌기로 보고, 그보다 적으면 예전처럼 클릭(넣기/빼기)이다. 마우스·터치 모두. */
 let DRAG=null,SUPPRESS=false,GHOST=null,MARK=null;
 function dragStart(e,i,src){if(isLocked(i)){DRAG=null;return}DRAG={i,src,x0:e.clientX,y0:e.clientY,on:false}}
 function dropIndex(x,y){
  const st=$('strip'),r=st.getBoundingClientRect(),pad=24;
  if(x<r.left-pad||x>r.right+pad||y<r.top-pad||y>r.bottom+pad)return null;
  const cs=[...st.querySelectorAll('.cell')];
  for(let k=0;k<cs.length;k++){const b=cs[k].getBoundingClientRect();
   if(y<b.top)return k;
   if(y<=b.bottom&&x<b.left+b.width/2)return k}
  return cs.length}
 /* v212: 오른쪽 목록 위 칸(적용된 공정) 안에서도 끌어서 순서를 바꾼다. 구분선 아래로 놓으면 해제 */
 function panelIndex(x,y){
  const r=btns.getBoundingClientRect();if(x<r.left-20||x>r.right+20||y<r.top-20||y>r.bottom+20)return null;
  if(SEP&&SEP.parentNode&&y>SEP.getBoundingClientRect().top)return 'off';
  const ons=SEQ.map(i=>btns.querySelector('.pbtn[data-i="'+i+'"]')).filter(Boolean);
  /* v220: 3열 격자 — 줄(세로) 먼저, 같은 줄이면 칸의 왼쪽/오른쪽 절반으로 앞·뒤를 정한다 */
  for(let k=0;k<ons.length;k++){const b=ons[k].getBoundingClientRect();
   if(y<b.top-2)return k;
   if(y<=b.bottom+2){if(y<b.top+b.height/2)return k;continue}}
  return ons.length}
 let PMARK=null;
 function showPMark(k){if(!PMARK)PMARK=el('div','pdrop');
  btns.classList.toggle('offdrop',k==='off');
  btns.querySelectorAll('.pdb,.pda').forEach(e=>e.classList.remove('pdb','pda'));
  if(k==null||k==='off')return;
  const ons=SEQ.map(i=>btns.querySelector('.pbtn[data-i="'+i+'"]')).filter(Boolean);
  if(ons[k])ons[k].classList.add('pdb');else if(ons.length)ons[ons.length-1].classList.add('pda');else if(SEP)SEP.classList.add('pdb')}
 function target(x,y){const L=lockN();const a=dropIndex(x,y);if(a!=null)return {where:'strip',k:Math.max(a,L)};const b=panelIndex(x,y);if(b!=null)return {where:'panel',k:b==='off'?b:Math.max(b,L)};return null}
 function showMark(k){const st=$('strip'),grid=st.querySelector('.cells');if(!MARK){MARK=el('span','dropmark')}
  if(k==null||!grid){MARK.remove();st.classList.remove('dropon');return}
  st.classList.add('dropon');const cs=[...grid.querySelectorAll('.cell')];
  const ref=cs[k]||null;
  if(ref){if(MARK.nextSibling!==ref)grid.insertBefore(MARK,ref)}else if(grid.lastChild!==MARK)grid.appendChild(MARK)}
 function dragEnd(){if(GHOST){GHOST.remove();GHOST=null}if(MARK)MARK.remove();if(PMARK)PMARK.remove();btns.querySelectorAll('.pdb,.pda').forEach(e=>e.classList.remove('pdb','pda'));btns.classList.remove('offdrop');$('strip').classList.remove('dropon');
  document.body.classList.remove('dragging');document.querySelectorAll('.dragsrc').forEach(x=>x.classList.remove('dragsrc'))}
 document.addEventListener('pointermove',e=>{if(!DRAG)return;
  if(!DRAG.on){if(Math.hypot(e.clientX-DRAG.x0,e.clientY-DRAG.y0)<6)return;
   DRAG.on=true;document.body.classList.add('dragging');
   const s=STEPS[DRAG.i];GHOST=el('div','dragghost',(s&&(s.name||s.code))||'');document.body.appendChild(GHOST);
   const srcEl=DRAG.src==='chip'?$('strip').querySelector('.chip[data-i="'+DRAG.i+'"]'):btns.querySelector('.pbtn[data-i="'+DRAG.i+'"]');if(srcEl)srcEl.classList.add('dragsrc')}
  e.preventDefault();
  GHOST.style.left=(e.clientX+12)+'px';GHOST.style.top=(e.clientY+10)+'px';
  const t=target(e.clientX,e.clientY);showMark(t&&t.where==='strip'?t.k:null);showPMark(t&&t.where==='panel'?t.k:null)});
 const finish=e=>{if(!DRAG)return;const d=DRAG;DRAG=null;if(!d.on)return;
  SUPPRESS=true;setTimeout(()=>{SUPPRESS=false},0);
  const t=e&&e.type==='pointerup'?target(e.clientX,e.clientY):null;dragEnd();
  if(!t)return;const cur=SEQ.indexOf(d.i);
  if(t.k==='off'){if(cur>=0){SEQ.splice(cur,1);draw()}return}   /* 구분선 아래로 놓으면 해제 */
  let k=t.k;
  if(cur>=0){if(cur===k||cur+1===k)return;SEQ.splice(cur,1);if(cur<k)k--}
  SEQ.splice(k,0,d.i);draw()};
 document.addEventListener('pointerup',finish);document.addEventListener('pointercancel',finish);
 $('bAll').addEventListener('click',()=>{const keep=SEQ.slice(0,lockN());SEQ=keep.concat(PLANSEQ.filter(i=>!keep.includes(i)));draw()});
 $('bClr').addEventListener('click',()=>{SEQ=SEQ.slice(0,lockN());draw()});   /* 완료 공정까지는 남긴다 */
 $('bPrint').addEventListener('click',()=>window.print());
 /* v207: 고른 순서를 사내외가공 발주 화면(연 창)으로 보내 가공계획에 적용 */
 $('bApply').addEventListener('click',()=>{
  if(!SEQ.length)return alert('먼저 오른쪽에서 공정을 순서대로 눌러 주세요.');
  const op=window.opener;if(!op||op.closed)return alert('사내외가공 발주 화면이 닫혀 있어 적용할 수 없습니다.');
  const steps=SEQ.map(i=>({code:STEPS[i].code,house:!!STEPS[i].inhouse}));
  if(!confirm(o.part+' 의 가공공정을 아래 순서로 가공계획에 적용합니다.\n\n'+steps.map((x,k)=>(k+1)+'. '+(STEPS[SEQ[k]].name||x.code)+(x.house?' [사내]':'')).join('\n')))return;
  /* v260: 결과를 받아 이 창에서 알린다 (진행 중 공정 확인도 이 창에서) */
  const btn=$('bApply'),t0='▣ 가공계획 적용';btn.disabled=true;btn.textContent='적용 중…';
  const send=force=>new Promise((res,rej)=>{const id='ap'+Date.now()+Math.random().toString(36).slice(2,6);
   const to=setTimeout(()=>{window.removeEventListener('message',h);rej(new Error('사내외가공 발주 화면이 응답하지 않습니다. 그 화면을 새로고침한 뒤 다시 시도하세요.'))},20000);
   function h(ev){const r=ev.data;if(!r||r.type!=='mes_drawboard_apply_done'||r.id!==id||ev.origin!==location.origin)return;clearTimeout(to);window.removeEventListener('message',h);res(r)}
   window.addEventListener('message',h);
   op.postMessage({type:'mes_drawboard_apply',id,force:!!force,job:o.job||'',part:o.part||'',jo:o.jo==null?null:o.jo,ri:o.ri,steps},location.origin)});
  (async()=>{try{
    let r=await send(false);
    if(!r.ok&&r.need==='confirm'){if(!confirm(r.err))return;r=await send(true)}
    if(!r.ok)return alert('적용하지 못했습니다.\n\n'+(r.err||''));
    if(r.data){o=Object.assign({},o,r.data,{list:o.list,all:o.all,by:o.by,item:o.item});
     if(Array.isArray(o.list)){const k=o.list.findIndex(x=>x.part===o.part&&String(x.jo??'')===String(o.jo??''));if(k>=0)o.list[k]=Object.assign({},o.list[k],r.data)}
     try{sessionStorage.setItem('mes_drawboard',JSON.stringify(o))}catch(e){}}
    btn.textContent='✔ 적용됨';alert('가공계획에 적용했습니다.\n\n'+(r.text||''));
   }catch(e){alert(e.message||String(e))}
   finally{btn.disabled=false;setTimeout(()=>{btn.textContent=t0},1800)}})();
 });
 $('bClose').addEventListener('click',()=>window.close());
 /* v213: ◀ 이전 품번 · 다음 품번 ▶ — 사내외가공 발주 화면의 부품 순서대로 다음 부품을 불러온다.
  *   가공계획이 이미 등록된 부품은 등록된 순서·사내 표시로 띠를 바꾸고,
  *   아직 등록 안 된 부품이면 띠의 가공공정 순서·사내 체크를 그대로 둔다 → 같은 순서를 여러 부품에 [가공계획 적용] 하기 좋다. */
 let MV_SEQ=0;const MV_WAIT={};
 window.addEventListener('message',ev=>{const d=ev.data;if(!d||d.type!=='mes_drawboard_move_done'||ev.origin!==location.origin)return;
  const w=MV_WAIT[d.id];if(!w)return;delete MV_WAIT[d.id];d.ok?w.res(d.data):w.rej(new Error(d.err||'불러오기 실패'))});
 function askMove(dir){return new Promise((res,rej)=>{const op=window.opener;if(!op||op.closed)return rej(new Error('사내외가공 발주 화면이 닫혀 있어 다른 품번을 불러올 수 없습니다.'));
  const id=++MV_SEQ;MV_WAIT[id]={res,rej};setTimeout(()=>{if(MV_WAIT[id]){delete MV_WAIT[id];rej(new Error('응답이 없습니다.'))}},10000);
  op.postMessage({type:'mes_drawboard_move',id,dir,job:o.job||'',part:o.part||'',jo:o.jo==null?null:o.jo,ri:o.ri},location.origin)})}
 function applyPart(n){
  o=Object.assign({},o,n,{by:o.by,all:o.all,item:o.item,list:o.list});
  PLAN=(o.steps||[]);STEPS.forEach(s=>{s.plan=[];s.vendor='';s.state=''});
  PLAN.forEach((ps,k)=>{const c=String(ps.code||'').trim();let t=STEPS.find(x=>x.code===c||x.code.toUpperCase()===c.toUpperCase());
   if(!t){t={idx:STEPS.length,code:c,name:ps.name||c,inhouse:!!ps.inhouse,vendor:'',state:'',plan:[]};STEPS.push(t);makeBtn(t)}
   t.plan.push(k+1);if(!t.vendor)t.vendor=ps.vendor||'';if(!t.state)t.state=ps.state||''});
  PLANSEQ=[];PLAN.forEach(ps=>{const c=String(ps.code||'').trim();const t=STEPS.find(x=>x.code===c||x.code.toUpperCase()===c.toUpperCase());if(t&&!PLANSEQ.includes(t.idx))PLANSEQ.push(t.idx)});
  renderMeta();ORI_SET=false;setFig(o.image);ovImg=null;try{$('ovB').querySelectorAll('img').forEach(x=>x.remove())}catch(e){}
  $('sideTitle').textContent='가공공정 전체 ('+STEPS.length+') · 계획 '+PLANSEQ.length;
  let kept=true;
  if(o.saved&&PLAN.length){kept=false;SEQ=PLANSEQ.slice();   /* 등록된 가공계획 → 등록된 순서 · 사내 표시 그대로 */
   STEPS.forEach(s=>{s.inhouse=false});
   PLAN.forEach(ps=>{const c=String(ps.code||'').trim();const t=STEPS.find(x=>x.code===c||x.code.toUpperCase()===c.toUpperCase());if(t&&ps.inhouse)t.inhouse=true});
   btns.querySelectorAll('.pbtn').forEach(bn=>{const s=STEPS[Number(bn.dataset.i)];const hc=bn.querySelector('label.h input');if(s&&hc)hc.checked=!!s.inhouse})}
  planBadges();draw();try{$('note').textContent=''}catch(e){}
  const tip=$('moveTip');if(tip)tip.textContent=kept?`${o.part} — 가공계획 미등록 · 띠의 공정 순서를 그대로 두었습니다 ([▣ 가공계획 적용]으로 저장)`:`${o.part} — 등록된 가공계획 순서를 불러왔습니다`;
  try{sessionStorage.setItem('mes_drawboard',JSON.stringify(o))}catch(e){}}
 /* v214: 열 때 받은 부품 리스트(사내외가공 발주 화면의 부품별 가공공정 리스트 순서)로 바로 넘긴다. 리스트가 없을 때만 발주 화면에 묻는다 */
 function localMove(dir){const L=o.list;if(!Array.isArray(L)||!L.length)return null;
  let cur=L.findIndex(x=>x.part===o.part&&String(x.jo??'')===String(o.jo??''));if(cur<0)cur=L.findIndex(x=>x.part===o.part);
  const nx=cur+(dir<0?-1:1);if(nx<0)throw new Error('첫 번째 품번입니다.');if(nx>=L.length)throw new Error('마지막 품번입니다.');
  return L[nx]}
 async function movePart(dir){const b=$(dir>0?'bNext':'bPrev');const t0=b?b.textContent:'';if(b){b.disabled=true;b.textContent='불러오는 중…'}
  try{const n=localMove(dir);applyPart(n||await askMove(dir))}catch(e){alert(e.message)}
  finally{if(b){b.disabled=false;b.textContent=t0}}}
 if($('bPrev'))$('bPrev').addEventListener('click',()=>movePart(-1));
 if($('bNext'))$('bNext').addEventListener('click',()=>movePart(1));
 /* v210: 그림 등록 — 그림 편집기(캡쳐·이미지·PDF)로 만든 그림을 사내외가공 발주 화면(연 창)에 보내
  *   PartList(원재료/구매품)의 이 부품 그림으로 저장한다. 저장이 끝나면 그 그림으로 다시 그린다. */
 let PIC_SEQ=0;const PIC_WAIT={};
 window.addEventListener('message',ev=>{const d=ev.data;if(!d||d.type!=='mes_drawboard_image_done'||ev.origin!==location.origin)return;
  const w=PIC_WAIT[d.id];if(!w)return;delete PIC_WAIT[d.id];d.ok?w.res(d.url):w.rej(new Error(d.err||'저장 실패'))});
 function sendPic(f){return new Promise((res,rej)=>{const op=window.opener;
  if(!op||op.closed)return rej(new Error('사내외가공 발주 화면이 닫혀 있어 PartList 에 저장할 수 없습니다.'));
  const id=++PIC_SEQ;PIC_WAIT[id]={res,rej};
  setTimeout(()=>{if(PIC_WAIT[id]){delete PIC_WAIT[id];rej(new Error('응답이 없습니다. 사내외가공 발주 화면을 확인하세요.'))}},60000);
  op.postMessage({type:'mes_drawboard_image',id,job:o.job||'',part:o.part||'',file:f},location.origin)})}
 function picOpen(){
  if(!window.MESIMG)return alert('그림 편집기(mes_imgedit.js)를 불러오지 못했습니다.');
  if(o.image&&!confirm(o.part+' 에 이미 그림이 있습니다. 새 그림으로 바꿀까요?'))return;
  MESIMG.open({title:'부품 그림 등록 (PartList 에 저장)',job:o.job||'',part:o.part||'',name:o.name||'',mat:o.mat||'',spec:o.spec||'',by:o.by||'',
   onSave:async f=>{const url=await sendPic(f);o.image=url;ovImg=null;if($('ovB'))$('ovB').querySelectorAll('img').forEach(x=>x.remove());ORI_SET=false;setFig(url)}})}
 if($('bPic'))$('bPic').addEventListener('click',picOpen);
 /* v212: 기준공정 불러오기 — 가공 기준공정관리의 기준공정을 골라 띠 순서로 넣는다 (자료는 사내외가공 발주 화면이 DB에서 읽어 보내 준다) */
 let RQ_SEQ=0;const RQ_WAIT={};
 window.addEventListener('message',ev=>{const d=ev.data;if(!d||d.type!=='mes_drawboard_std_done'||ev.origin!==location.origin)return;
  const w=RQ_WAIT[d.id];if(!w)return;delete RQ_WAIT[d.id];d.ok?w.res(d.list||[]):w.rej(new Error(d.err||'조회 실패'))});
 function askStd(){return new Promise((res,rej)=>{const op=window.opener;if(!op||op.closed)return rej(new Error('사내외가공 발주 화면이 닫혀 있어 기준공정을 불러올 수 없습니다.'));
  const id=++RQ_SEQ;RQ_WAIT[id]={res,rej};setTimeout(()=>{if(RQ_WAIT[id]){delete RQ_WAIT[id];rej(new Error('응답이 없습니다.'))}},15000);
  op.postMessage({type:'mes_drawboard_std',id},location.origin)})}
 function stdClose(){const m=$('stdPop');if(m)m.remove()}
 async function stdOpen(){
  stdClose();const pop=el('div','stdpop');pop.id='stdPop';
  const hd=el('div','sh');hd.appendChild(el('b',null,'기준공정 불러오기'));const x=el('button',null,'×');x.type='button';x.addEventListener('click',stdClose);hd.appendChild(x);pop.appendChild(hd);
  const bd=el('div','sb',"불러오는 중…");pop.appendChild(bd);document.body.appendChild(pop);
  let list=[];try{list=await askStd()}catch(e){bd.textContent=e.message;return}
  if(!list.length){bd.textContent='등록된 기준공정이 없습니다. 기준정보 › 가공 기준공정관리에서 먼저 등록하세요.';return}
  bd.textContent='';
  const byCode=c=>STEPS.find(s=>s.code===c||s.code.toUpperCase()===String(c).toUpperCase());
  list.forEach(r=>{const st=(r.steps||[]).map(c=>String(c||'').trim()).filter(Boolean);
   const b=el('button','srow');b.type='button';
   b.appendChild(el('b',null,(r.no!=null?r.no+'. ':'')+(r.name||'(이름 없음)')));
   b.appendChild(el('span',null,st.map((c,i)=>{const s=byCode(c);return (i+1)+'.'+((s&&(s.name||s.code))||c)+(r.inhouse&&r.inhouse[i]?'(사내)':'')}).join(' → ')||'공정 없음'));
   b.addEventListener('click',()=>{
    if(SEQ.length&&!confirm('띠에 있는 공정 순서를 「'+(r.name||'')+'」 기준공정으로 바꿀까요?'))return;
    const miss=[];SEQ=SEQ.slice(0,lockN());
    st.forEach((c,i)=>{let s=byCode(c);if(!s){miss.push(c);return}if(SEQ.includes(s.idx))return;SEQ.push(s.idx);s.inhouse=!!(r.inhouse&&r.inhouse[i])});
    btns.querySelectorAll('.pbtn').forEach(bn=>{const s=STEPS[Number(bn.dataset.i)];const hc=bn.querySelector('label.h input');if(s&&hc)hc.checked=!!s.inhouse});
    stdClose();draw();
    if(miss.length)alert('공정 마스터에 없는 공정은 빼고 넣었습니다: '+miss.join(', '))});
   bd.appendChild(b)});
 }
 if($('bStd'))$('bStd').addEventListener('click',stdOpen);
 /* v208: 등록된 이미지만 보기 */
 const ov=$('ov'),ovB=$('ovB');let ovImg=null;
 function ovMode(real){ovB.classList.toggle('real',!!real)}
 $('bImg').addEventListener('click',()=>{
  if(!o.image)return alert('PartList 에 등록된 부품 그림이 없습니다.');
  if(!ovImg){ovImg=el('img');ovImg.alt=o.part||'';ovImg.addEventListener('load',()=>{$('ovS').textContent=' · '+ovImg.naturalWidth+' × '+ovImg.naturalHeight+' px'});ovImg.src=o.image;ovImg.addEventListener('click',()=>ovMode(!ovB.classList.contains('real')));ovB.appendChild(ovImg)}
  $('ovT').textContent='원본 이미지 — '+(o.part||'')+' '+(o.name||'');ovMode(false);ov.classList.add('show')});
 $('ovFit').addEventListener('click',()=>ovMode(false));$('ovReal').addEventListener('click',()=>ovMode(true));
 $('ovClose').addEventListener('click',()=>ov.classList.remove('show'));
 document.addEventListener('keydown',e=>{if(e.key==='Escape')ov.classList.remove('show')});
 draw();
})();
