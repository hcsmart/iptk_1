/* ── v170: 발주서 메일 (전 화면 공용) ───────────────────────────────────────
 * MESMAIL.order({category:'원재료'|'구매품'|'외주가공', vendor, job, item, lines:[{part,name,mat,spec,proc,qty,price,amt,rdate,image_url}], by})
 *   → 받는 사람(협력업체 email)·제목·본문을 채운 창 → [✉ 보내기] / [🖨 발주서(A4)] / [mailto]
 * 보내기 경로
 *   ① 구글 앱스 스크립트 웹앱 GAS_URL (POST text/plain JSON {action:'sendOrderMail',to,cc,subject,text,html,attachments:[{name,url}]}) — mes_mail_gas.gs 참조
 *   ② 함수가 없으면 mailto: 로 메일 앱을 열고(본문 텍스트 + 그림 링크) 발주서 창을 같이 띄운다 → PDF 로 저장해 첨부
 * 부품 그림은 PartList 에 등록한 A4 그림(image_url)을 본문에 넣는다. */
(function(){
if(window.MESMAIL)return;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const won=v=>Math.round(Number(v)||0).toLocaleString('ko-KR');
const T0=()=>new Date().toLocaleDateString('sv-SE');
let O=null,VEND=null,FROM=null;
/* v328: 웹앱이 어느 구글 계정으로 보내는지 물어본다 (한 번만) */
async function senderInfo(){
 if(FROM)return FROM;
 try{const r=await fetch(GAS_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'whoami'}),redirect:'follow'});
  const j=JSON.parse(await r.text());if(j&&j.from)FROM=j.from}catch(e){}
 return FROM;
}
/* v171: 발주서 메일 발송 — 구글 앱스 스크립트 웹앱 (doPost)
 * v328: 메일은 이 웹앱을 「배포한 구글 계정」으로 나간다 → 태진 구글 계정으로 mes_mail_gas.gs 를 배포하고
 *       받은 웹앱 주소(…/exec)를 아래 GAS_URL 에 넣는다. 창 아래 안내줄에 실제 보내는 계정이 표시된다. */
const GAS_URL='https://script.google.com/macros/s/AKfycbxWmPpH0vNtK5Abuk5fAvY1Se0OwRsv24lEXtKVWZ6m0PuzFtCWz3SeKFnCMgtbxxAf/exec';

function ensureUI(){
 if($('mlMask'))return;
 const st=document.createElement('style');st.textContent=`
#mlMask{position:fixed;inset:0;background:rgba(20,30,40,.5);z-index:9600;display:none}#mlMask.on{display:block}
#mlPop{position:fixed;z-index:9601;left:50%;top:50%;transform:translate(-50%,-50%);width:min(760px,96vw);max-height:94vh;overflow:auto;background:#fff;border:1px solid #5f7080;box-shadow:0 12px 40px rgba(0,0,0,.35);display:none;font:12px 'Malgun Gothic',맑은 고딕,sans-serif;color:#344758}
#mlPop.on{display:block}
#mlPop .mh{height:34px;display:flex;align-items:center;gap:10px;padding:0 10px;color:#fff;font-weight:700;background:linear-gradient(#5e9e46,#3f7a2c)}#mlPop .mh .x{margin-left:auto;border:0;background:transparent;color:#fff;font-size:16px;cursor:pointer}
#mlPop .g{display:grid;grid-template-columns:76px 1fr;gap:6px 8px;align-items:center;padding:10px 12px 4px}#mlPop .g label{font-weight:700;text-align:right;color:#4d5c69}
#mlPop .g input,#mlPop .g textarea{border:1px solid #b5c0c9;font:inherit;padding:3px 6px;width:100%}#mlPop .g input{height:27px}#mlPop .g textarea{height:96px;resize:vertical}
#mlPop table{width:calc(100% - 24px);margin:6px 12px;border-collapse:collapse}#mlPop th,#mlPop td{border:1px solid #d5dde3;height:26px;padding:0 6px;font-size:11.5px;white-space:nowrap}#mlPop th{background:linear-gradient(#e9f1f8,#d3e1ee)}
#mlPop td.r{text-align:right}#mlPop td.c{text-align:center}#mlPop img.th{width:34px;height:34px;object-fit:cover;border:1px solid #c5d0d8;vertical-align:middle}
#mlPop .note{margin:4px 12px;padding:5px 8px;border:1px solid #e1e7ec;background:#f7f9fb;border-radius:3px;color:#5d6d7b;font-size:11px;line-height:1.5}
#mlPop .note.warn{border-color:#e5ad62;background:#fff7ea;color:#8a4f08}
#mlPop .mf{display:flex;gap:6px;align-items:center;padding:8px 12px 12px;flex-wrap:wrap}#mlPop .mf .msg{flex:1;color:#1d5da3;font-weight:700}
#mlPop .mf button{height:28px;padding:0 12px;border:1px solid #8b9ba9;background:linear-gradient(#fff,#e9eef2);cursor:pointer;border-radius:2px;font:inherit}#mlPop .mf button.go{background:linear-gradient(#e9f3fc,#c9def0);border-color:#6f9cc4;font-weight:700}
`;document.head.appendChild(st);
 const m=document.createElement('div');m.id='mlMask';document.body.appendChild(m);
 const p=document.createElement('div');p.id='mlPop';p.innerHTML=`<div class="mh"><span id="mlTitle">발주서 메일</span><button class="x" onclick="MESMAIL.close()">×</button></div>
 <div class="g"><label>받는 사람</label><input id="mlTo" placeholder="업체 이메일 (기준정보 › 협력업체관리의 이메일)"><label>참조</label><input id="mlCc" placeholder="선택"><label>제목</label><input id="mlSubj"><label>본문</label><textarea id="mlBody"></textarea></div>
 <div id="mlLines"></div><div class="note" id="mlNote"></div>
 <div class="mf"><span class="msg" id="mlMsg"></span><button onclick="MESMAIL.preview()">🖨 발주서(A4)</button><button onclick="MESMAIL.mailto()" title="메일 앱으로 열기 (그림은 링크로)">📨 메일 앱</button><button class="go" id="mlSend" onclick="MESMAIL.send()">✉ 보내기</button><button onclick="MESMAIL.close()">닫기</button></div>`;
 document.body.appendChild(p);
}
const say=t=>{const m=$('mlMsg');if(m)m.textContent=t};

/* 협력업체 이메일 (vendors.email) */
async function vendorInfo(name){
 try{if(!VEND){const rs=await MESDB.table('vendors').select('select=vendor_code,vendor_name,email,contact_name,phone');VEND=rs||[]}
  return VEND.find(v=>v.vendor_name===name)||{}}catch(e){return {}}
}
function linesHtml(o,forMail){
 const rows=o.lines.map((l,i)=>`<tr><td class="c">${i+1}</td><td>${esc(l.part||'')}</td><td>${esc(l.name||'')}</td><td>${esc([l.mat,l.spec].filter(Boolean).join(' '))}</td>${o.category==='외주가공'?`<td>${esc(l.proc||'')}</td>`:''}<td class="r">${l.qty??''}</td><td class="r">${l.price?won(l.price):''}</td><td class="r">${l.amt?won(l.amt):''}</td><td class="c">${esc(l.rdate||'')}</td>${forMail?'':`<td class="c">${l.image_url?`<img class="th" src="${esc(l.image_url)}" title="그림 첨부됨">`:'<span style="color:#aab">없음</span>'}</td>`}</tr>`).join('');
 const tot=o.lines.reduce((a,l)=>a+(Number(l.amt)||0),0);
 return `<table><thead><tr><th>No</th><th>품번</th><th>부품명</th><th>재질·규격</th>${o.category==='외주가공'?'<th>공정</th>':''}<th>수량</th><th>단가</th><th>금액</th><th>입고요구일</th>${forMail?'':'<th>그림</th>'}</tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="${o.category==='외주가공'?7:6}" class="r"><b>합계</b></td><td class="r"><b>${won(tot)}</b></td><td colspan="${forMail?1:2}"></td></tr></tfoot></table>`;
}
/* 발주서 HTML (메일 본문 · A4 인쇄 공용) */
function sheetHtml(o,inline){
 const imgs=o.lines.filter(l=>l.image_url);
 const style=`body{font-family:'Malgun Gothic','맑은 고딕',Arial,sans-serif;font-size:12px;color:#222;margin:0}.pg{padding:14mm 12mm}h1{font-size:22px;margin:0 0 4px;letter-spacing:4px;text-align:center}.meta{display:flex;justify-content:space-between;margin:10px 0 8px;font-size:12px}.meta b{color:#000}table{width:100%;border-collapse:collapse}th,td{border:1px solid #444;padding:4px 6px;font-size:11.5px}th{background:#eee}td.r{text-align:right}td.c{text-align:center}.fig{page-break-before:always;padding:10mm}.fig h3{margin:0 0 6px;font-size:14px}.fig img{width:100%;max-height:250mm;object-fit:contain;border:1px solid #999}@page{size:A4;margin:8mm}.bar{position:sticky;top:0;background:#f3f6f8;border-bottom:1px solid #cfd8df;padding:6px 10px;display:flex;gap:6px;align-items:center;font-size:12px}.bar button{height:26px;padding:0 10px;border:1px solid #8b9ba9;background:linear-gradient(#fff,#e9eef2);cursor:pointer;font:inherit}@media print{.bar{display:none}}`;
 const head=`<div class="pg"><h1>발 주 서</h1><div class="meta"><div><b>수신</b> ${esc(o.vendor)} 귀중<br><b>발신</b> ${esc(o.company||'IPTK')} ${esc(o.by||'')}<br><b>발주일</b> ${esc(o.date||T0())}</div><div style="text-align:right"><b>제번</b> ${esc(o.job)}${o.item?'<br><b>품명</b> '+esc(o.item):''}<br><b>구분</b> ${esc(o.category)} 발주</div></div>${linesHtml(o,true)}<p style="margin-top:10px;white-space:pre-wrap">${esc(o.message||'')}</p>${imgs.length?`<p style="color:#555">※ 부품 그림 ${imgs.length}장 ${inline?'다음 장에 첨부':'첨부'}</p>`:''}</div>`;
 const figs=inline?imgs.map(l=>`<div class="fig"><h3>${esc(o.job)} · ${esc(l.part)} ${esc(l.name||'')}</h3><img src="${esc(l.image_url)}"></div>`).join(''):'';
 return `<!doctype html><html><head><meta charset="utf-8"><title>발주서 ${esc(o.job)} ${esc(o.vendor)}</title><style>${style}</style></head><body><div class="bar"><button onclick="print()">🖨 인쇄 / PDF 저장</button><span style="color:#5d6d7b">인쇄 대화상자에서 「PDF로 저장」을 고르면 메일에 첨부할 파일이 됩니다 · 부품 그림은 다음 장부터</span></div>${head}${figs}</body></html>`;
}
function textBody(o){
 const L=o.lines.map((l,i)=>` ${i+1}. ${l.part} ${l.name||''} ${[l.mat,l.spec].filter(Boolean).join(' ')}${l.proc?' / '+l.proc:''} × ${l.qty??''} ${l.amt?won(l.amt)+'원':''} ${l.rdate?'(입고요구 '+l.rdate+')':''}`).join('\n');
 const imgs=o.lines.filter(l=>l.image_url).map(l=>` - ${l.part}: ${l.image_url}`).join('\n');
 return `${o.vendor} 귀중\n\n${o.category} 발주 내역을 보내드립니다.\n제번: ${o.job}${o.item?' ('+o.item+')':''}\n발주일: ${o.date||T0()}\n\n${L}\n\n${o.message||''}${imgs?'\n\n[부품 그림]\n'+imgs:''}\n\n${o.company||'IPTK'} ${o.by||''}`;
}

window.MESMAIL={
 async order(o){ensureUI();O=Object.assign({date:T0(),lines:[]},o||{});
  const v=await vendorInfo(O.vendor);O.vendorInfo=v;
  $('mlTitle').textContent=`발주서 메일 — ${O.vendor||''} · ${O.job||''}`;
  $('mlTo').value=v.email||'';$('mlCc').value=O.cc||'';
  $('mlSubj').value=`[발주] ${O.job} ${O.category} ${O.lines.length}건 — ${O.company||'IPTK'}`;
  $('mlBody').value=O.message||`${O.vendor} 귀중\n\n아래와 같이 ${O.category} 발주합니다. 입고요구일을 확인해 주시고, 부품 그림을 참고해 주세요.\n\n감사합니다.`;
  $('mlLines').innerHTML=linesHtml(O,false);
  const ni=O.lines.filter(l=>l.image_url).length;
  $('mlNote').className='note'+(v.email?'':' warn');
  $('mlNote').innerHTML=(v.email?`업체 이메일: <b>${esc(v.email)}</b>${v.contact_name?' ('+esc(v.contact_name)+')':''}`:`<b>${esc(O.vendor)}</b> 의 이메일이 기준정보 › 협력업체관리에 없습니다. 받는 사람을 직접 넣거나 업체관리에 등록하세요.`)
   +` · 부품 그림 ${ni}장 ${ni?'본문 아래에 A4 로 첨부':'(PartList [📷 이미지]로 등록하면 함께 갑니다)'}`;
  {const sb=$('mlSend');sb.disabled=false;sb.textContent='✉ 보내기'}   /* v172: 직전 전송의 '보내는 중…' 상태가 남지 않게 */
  {const nt=$('mlNote'),base=nt.innerHTML;senderInfo().then(f=>{if($('mlNote')===nt&&O)nt.innerHTML=base+'<br>'+(f?`보내는 계정: <b>${esc(f)}</b>`:'보내는 계정 확인 불가 — 웹앱이 예전 버전이면 mes_mail_gas.gs 로 다시 배포하세요')})}
  $('mlMask').classList.add('on');$('mlPop').classList.add('on');say('');
 },
 close(){if($('mlMask'))$('mlMask').classList.remove('on');if($('mlPop'))$('mlPop').classList.remove('on');O=null},
 preview(){if(!O)return;O.message=$('mlBody').value;const w=window.open('','_blank');if(!w)return say('팝업이 차단되었습니다.');w.document.write(sheetHtml(O,true));w.document.close();say('발주서 창이 열렸습니다. 인쇄 → PDF 로 저장하면 메일에 첨부할 수 있습니다.')},
 mailto(){if(!O)return;O.message=$('mlBody').value;
  const u=`mailto:${encodeURIComponent($('mlTo').value)}?${$('mlCc').value?'cc='+encodeURIComponent($('mlCc').value)+'&':''}subject=${encodeURIComponent($('mlSubj').value)}&body=${encodeURIComponent(textBody(O))}`;
  location.href=u;MESMAIL.preview();say('메일 앱을 열었습니다. 발주서 창을 PDF 로 저장해 첨부하세요.')},
 async send(){if(!O)return;O.message=$('mlBody').value;
  const to=$('mlTo').value.trim();if(!to)return say('받는 사람 이메일을 넣으세요.');
  const b=$('mlSend');b.disabled=true;b.textContent='보내는 중…';
  try{
   /* v171: 구글 앱스 스크립트 웹앱으로 발송 (text/plain 으로 보내 CORS 사전요청을 피한다) */
   const payload={action:'sendOrderMail',to,cc:$('mlCc').value.trim()||'',subject:$('mlSubj').value,text:textBody(O),html:sheetHtml(O,true).replace(/<div class="bar">[\s\S]*?<\/div>/,''),
     attachments:O.lines.filter(l=>l.image_url).map(l=>({name:`${O.job}_${l.part}.png`,url:l.image_url})),
     meta:{category:O.category,vendor:O.vendor,job:O.job,by:O.by||'',lines:O.lines.length}};
   let res=null;
   try{
    const r=await fetch(GAS_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),redirect:'follow'});
    const t=await r.text();try{res=JSON.parse(t)}catch(e){res={ok:r.ok,raw:t.slice(0,160)}}
   }catch(e){
    /* 응답을 못 읽는 환경(CORS)이면 no-cors 로 한 번 더 — 전송은 되지만 결과는 확인 못 함 */
    await fetch(GAS_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});
    res={ok:true,unverified:true};
   }
   if(!res||res.ok===false)throw new Error((res&&(res.error||res.raw))||'구글 스크립트 응답 오류');
   try{await MESDB.table('mail_log').upsert([{kind:'발주서',category:O.category,vendor_name:O.vendor,job_no:O.job,to_addr:to,subject:$('mlSubj').value,sent_by:O.by||null,lines:O.lines.length}])}catch(e){}
   if(res.from)FROM=res.from;
   say(res.unverified?`${to} 로 보냈습니다 (응답 확인 불가 — 받은편지함을 확인하세요).`:`${to} 로 발주서를 보냈습니다${res.from?' (보낸 계정 '+res.from+')':''}.`);b.disabled=false;b.textContent='✉ 보내기';setTimeout(MESMAIL.close,1200);
  }catch(e){say('전송 실패: '+String(e.message||e).slice(0,140)+' — [📨 메일 앱]으로 보내세요.');b.disabled=false;b.textContent='✉ 보내기'}
 },
 sheet:sheetHtml,
 /* v173: 사내가공 작업도면 — 부품·공정 머리글 + PartList 부품 그림(A4) */
 async workSheet(q){
  let url=q.image_url||'';
  try{if(!url&&MESDB.partImages){const im=await MESDB.partImages(q.job);url=im[q.part]||''}}catch(e){}
  const w=window.open('','_blank');if(!w)return alert('팝업이 차단되었습니다.');
  const st=`body{font-family:'Malgun Gothic','맑은 고딕',Arial,sans-serif;font-size:12px;color:#222;margin:0}.pg{padding:10mm 12mm}h1{font-size:20px;margin:0 0 8px;letter-spacing:3px;text-align:center}table{width:100%;border-collapse:collapse;margin-bottom:8px}th,td{border:1px solid #444;padding:4px 6px;font-size:12px}th{background:#eee;width:90px}img{width:100%;max-height:235mm;object-fit:contain;border:1px solid #999}.none{border:1px dashed #999;padding:60px;text-align:center;color:#888}@page{size:A4;margin:8mm}.bar{position:sticky;top:0;background:#f3f6f8;border-bottom:1px solid #cfd8df;padding:6px 10px}.bar button{height:26px;padding:0 10px;border:1px solid #8b9ba9;background:linear-gradient(#fff,#e9eef2);cursor:pointer;font:inherit}@media print{.bar{display:none}}`;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>사내가공 작업도면 ${esc(q.job)} ${esc(q.part)}</title><style>${st}</style></head><body><div class="bar"><button onclick="print()">🖨 인쇄 / PDF 저장</button></div><div class="pg"><h1>사내가공 작업도면</h1>
   <table><tr><th>제번</th><td>${esc(q.job)}</td><th>부품</th><td>${esc(q.part)} ${esc(q.name||'')}</td></tr><tr><th>공정</th><td>${esc(q.proc||'')}</td><th>소요수</th><td>${esc(q.qty??'')}</td></tr><tr><th>작업일</th><td>${esc(T0())}</td><th>지시자</th><td>${esc(q.by||'')}</td></tr></table>
   ${url?`<img src="${esc(url)}">`:'<div class="none">등록된 부품 그림이 없습니다.<br>설계관리 › PartList 등록 [📷 이미지]에서 캐드 캡쳐를 붙여넣어 등록하세요.</div>'}</div></body></html>`);
  w.document.close();
 },
 /* 저장된 발주(order_lines)로 발주서 열기 — 같은 제번·업체·발주일 묶음 */
 async sheetFor(q){
  try{
   let f=`select=*&category=eq.${encodeURIComponent(q.category)}&job_no=eq.${encodeURIComponent(q.job)}`;
   if(q.vendor)f+=`&vendor_name=eq.${encodeURIComponent(q.vendor)}`;
   if(q.part)f+=`&part_no=eq.${encodeURIComponent(q.part)}`;   /* v173: 그 부품의 발주건만 (묶음 공정 포함) */
   let rs=await MESDB.table('order_lines').select(f+'&order=line_id',{fresh:true});
   const od=String(q.order_date||'').slice(0,10);
   rs=(rs||[]).filter(l=>String(l.status||'')!=='취소'&&(!od||String(l.order_date||'').slice(0,10)===od)&&(!q.part||l.part_no===q.part));
   if(q.line_id&&!rs.some(l=>Number(l.line_id)===Number(q.line_id))){const one=await MESDB.table('order_lines').select(`select=*&line_id=eq.${Number(q.line_id)}`);rs=[...(one||[]),...rs]}
   if(!rs.length)return alert('발주서를 만들 발주 내역이 없습니다.');
   let im={};try{im=MESDB.partImages?await MESDB.partImages(q.job):{}}catch(e){}
   const o={category:q.category,vendor:q.vendor||rs[0].vendor_name||'',job:q.job,item:q.item||rs[0].item_name||'',date:String(rs[0].order_date||'').slice(0,10),by:q.by||rs[0].owner_name||'',message:q.message||'',
     lines:rs.map(l=>({part:l.part_no,name:l.part_name,mat:l.material,spec:l.spec,proc:q.category==='외주가공'?`${l.step_no?'공정'+l.step_no+' ':''}${l.machining_process_name||l.machining_process_code||''}`:'',qty:l.order_qty,price:l.unit_price,amt:l.quote_price,rdate:String(l.required_date||'').slice(0,10),image_url:im[l.part_no]||''}))};
   const w=window.open('','_blank');if(!w)return alert('팝업이 차단되었습니다.');w.document.write(sheetHtml(o,true));w.document.close();
  }catch(e){alert('발주서 열기 실패: '+String(e.message||e).slice(0,120))}
 },
};
})();
