/* mes_cycle.js — v227  발주 차수(신규진행 · 차수 취소 · 차수 종료)
 *  부품이 이미 진행 중인데 설계변경·가공불량·파손 등으로 처음부터 다시 구매/가공할 때 「신규진행」으로 차수를 올린다.
 *  차수는 화면(구분)마다 따로 센다 — 원재료 2차, 구매품 1차, 외주가공 3차 가 같이 있을 수 있다.
 *  · order_lines.cycle_no        : 그 발주가 속한 차수 (기본 1)
 *  · part_cycles                 : 차수 시작 이력 (제번·구분·품번·차수·사유·메모·시작자·시각)
 *  현재 차수 = part_cycles 의 최대 차수 (없으면 1). 발주 화면은 현재 차수의 order_lines 만 진행으로 본다.
 *
 *  MESCYCLE.load(job, category)             → 제번의 차수 이력을 읽어 둔다 (Map 품번→[{no,reason,memo,by,at}])
 *  MESCYCLE.cur(part)                       → 현재 차수 번호
 *  MESCYCLE.reason(part)                    → 현재 차수 사유 (1차면 '')
 *  MESCYCLE.rowsOf(rows, part?)             → order_lines 행 중 현재 차수 행만 (part 생략 시 행마다 자기 품번 기준)
 *  MESCYCLE.badge(no, part?, why?)          → 'n차' 배지 HTML (1차는 '') — part 가 있으면 이력, 없으면 why(사유)를 말풍선에
 *  MESCYCLE.start({job,category,parts:[{part,name,cur,info}],by,onDone}) → 사유 선택 대화상자 → part_cycles 에 (cur+1) 기록
 */
(function(){
if(window.MESCYCLE)return;
const REASONS=['설계변경','가공불량','파손·분실','추가수량','재제작','기타'];
let JOB='',CAT='',HIST=new Map();          /* 품번 → 차수 이력 배열(오름차순) */
const key=p=>String(p||'').trim();
const online=()=>!!(window.MESDB&&MESDB.online);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const toEntry=r=>({no:Number(r.cycle_no)||1,reason:r.reason||'',memo:r.memo||'',by:r.started_by||'',at:String(r.started_at||'').slice(0,10),
    ended:!!r.ended_at,endAt:String(r.ended_at||'').slice(0,10),endReason:r.end_reason||'',endMemo:r.end_memo||'',endBy:r.ended_by||''});
/* v269: 여러 제번을 한 번에 읽어 제번별 상태(snap)로 돌려준다 — 사내외가공 발주 「전체 부품 보기」용.
   restore(snap) 으로 현재 제번 상태를 바꿔 끼운다 (DB 조회 없음) */
function snap(){return {JOB,CAT,HIST}}
function restore(s){if(!s)return;JOB=String(s.JOB||'');CAT=String(s.CAT||'');HIST=s.HIST instanceof Map?s.HIST:new Map()}
async function loadMany(jobs,category){
 const out=new Map(),C=String(category||'');
 (jobs||[]).forEach(j=>out.set(String(j),{JOB:String(j),CAT:C,HIST:new Map()}));
 if(!C||!online()||!out.size)return out;
 const list=[...out.keys()];
 for(let i=0;i<list.length;i+=40){
  const inl=encodeURIComponent('('+list.slice(i,i+40).map(x=>'"'+x.replace(/"/g,'')+'"').join(',')+')');
  const q=e=>`select=job_no,part_no,cycle_no,reason,memo,started_by,started_at${e?',ended_at,end_reason,end_memo,ended_by':''}&job_no=in.${inl}&category=eq.${encodeURIComponent(C)}&order=cycle_no`;
  let rs=[];try{try{rs=await MESDB.table('part_cycles').select(q(1),{fresh:true})}catch(e){rs=await MESDB.table('part_cycles').select(q(0),{fresh:true})}}catch(e){rs=[]}
  (rs||[]).forEach(r=>{const s=out.get(String(r.job_no));if(!s)return;const k=key(r.part_no);const a=s.HIST.get(k)||[];a.push(toEntry(r));s.HIST.set(k,a)});
 }
 return out;
}
async function load(job,category){
 JOB=String(job||'');CAT=String(category||'');HIST=new Map();
 if(!JOB||!CAT||!online())return HIST;
 try{
  const q=e=>`select=part_no,cycle_no,reason,memo,started_by,started_at${e?',ended_at,end_reason,end_memo,ended_by':''}&job_no=eq.${encodeURIComponent(JOB)}&category=eq.${encodeURIComponent(CAT)}&order=cycle_no`;
  let rs;try{rs=await MESDB.table('part_cycles').select(q(1),{fresh:true})}catch(e){rs=await MESDB.table('part_cycles').select(q(0),{fresh:true})}   /* v227: sql_v227 미실행이어도 돈다 */
  (rs||[]).forEach(r=>{const k=key(r.part_no);const a=HIST.get(k)||[];a.push(toEntry(r));HIST.set(k,a)});
 }catch(e){/* 표(part_cycles)가 아직 없으면 전부 1차로 본다 */}
 return HIST;
}
const hist=p=>HIST.get(key(p))||[];
const cur=p=>{const a=hist(p);return a.length?Math.max(1,...a.map(x=>x.no)):1};
const reason=p=>{const a=hist(p),n=cur(p);const h=a.find(x=>x.no===n);return h?h.reason:''};
const info=(p,no)=>hist(p).find(x=>x.no===(Number(no)||1))||null;
const isEnded=(p,no)=>{const h=info(p,no);return !!(h&&h.ended)};
const lineNo=r=>Number(r&&r.cycle_no)||1;
function rowsOf(rows,part){return (rows||[]).filter(r=>lineNo(r)===cur(part!=null?part:r.part_no))}
function title(p){const a=hist(p);if(!a.length)return '';return a.map(x=>`${x.no}차 — ${x.reason||''}${x.memo?' ('+x.memo+')':''}${x.at?' · '+x.at:''}${x.by?' '+x.by:''}${x.ended?` → 종료 ${x.endAt} ${x.endReason||''}${x.endMemo?' ('+x.endMemo+')':''}`:''}`).join('\n')}
function badge(no,part,why,force){no=Number(no)||1;const en=part!=null&&isEnded(part,no);if(no<=1&&!force&&!en)return '';const t=part!=null?title(part):'';return `<span class="cycb${en?' end':''}" title="${esc(t||(no+'차 진행'+(why?' — '+why:'')))}">${no}차${en?' 종료':''}</span>`}

/* ── 신규진행 대화상자 ── */
function css(){if(document.getElementById('mesCycleCss'))return;const s=document.createElement('style');s.id='mesCycleCss';s.textContent=`
.cycb{display:inline-block;margin-left:4px;padding:0 5px;border-radius:9px;background:#fbe6c8;color:#7a4a12;font-size:10px;font-weight:700;line-height:15px;vertical-align:1px}.cycb.end{background:#e3e7ea;color:#5d6b77;text-decoration:line-through}
#cycPop table button{height:22px;padding:0 8px;border:1px solid #8b9ba9;background:linear-gradient(#fff,#e9eef2);cursor:pointer;border-radius:2px;font-size:11px}#cycPop table button:disabled{opacity:.4;cursor:not-allowed}#cycPop table button.warn{color:#b3261e;border-color:#d9a19b;background:#fff4f2}#cycPop table button.end{color:#5a3a10;border-color:#b8874a;background:#fbe6c8}
#cycMask{position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center}
#cycPop{width:720px;max-width:96vw;max-height:90vh;overflow:auto;background:#fff;border:1px solid #6f8090;box-shadow:0 8px 26px rgba(0,0,0,.28);font-size:12px;color:#243441}
#cycPop .hd{display:flex;align-items:center;gap:8px;padding:8px 12px;background:linear-gradient(#e9f1f8,#d3e1ee);border-bottom:1px solid #b7c2cb;font-weight:700}
#cycPop .hd .x{margin-left:auto;border:0;background:none;font-size:18px;cursor:pointer;color:#456}
#cycPop .bd{padding:10px 12px}
#cycPop .note{border:1px solid #e5ad62;background:#fff7ea;color:#8a4f08;padding:6px 8px;margin-bottom:8px;line-height:1.45}
#cycPop table{border-collapse:collapse;width:100%}#cycPop th,#cycPop td{border:1px solid #c9d3dc;padding:3px 6px;height:24px;white-space:nowrap}#cycPop td:nth-child(5){white-space:normal}#cycPop th{background:#eef3f8;text-align:center}
#cycPop td.c{text-align:center}#cycPop tr.off td{color:#9aa6b1;background:#f7f9fa}
#cycPop .rs{display:flex;flex-wrap:wrap;gap:6px 12px;margin:10px 0 6px}#cycPop .rs label{display:flex;align-items:center;gap:4px;cursor:pointer}
#cycPop input.memo{width:100%;height:26px;border:1px solid #b7c2cb;padding:0 7px;box-sizing:border-box}
#cycPop .ft{display:flex;gap:6px;justify-content:flex-end;padding:8px 12px;border-top:1px solid #d5dde4;background:#f5f7f8}
#cycPop .ft button{height:28px;padding:0 12px;border:1px solid #8b9ba9;background:linear-gradient(#fff,#e9eef2);cursor:pointer;border-radius:2px}
#cycPop .ft button.go{background:linear-gradient(#fbe6c8,#e9c48f);border-color:#b8874a;font-weight:700;color:#5a3a10}
@media (max-width:640px){#cycPop{width:100vw;max-height:100vh}}`;document.head.appendChild(s)}
function close(){const m=document.getElementById('cycMask');if(m)m.remove()}

/* o = {job, category, parts:[{part,name,info,can,why}], by, onDone(startedParts)}
 *   info : 현재 차수의 진행 상태 글 (예: '발주 2 · 입고 1')   can:false 면 체크 불가(why 이유) */
function start(o){
 o=o||{};css();close();
 const parts=(o.parts||[]).map(p=>Object.assign({can:true},p,{cur:cur(p.part)}));
 if(!parts.length){alert('신규진행할 품번이 없습니다.');return}
 const m=document.createElement('div');m.id='cycMask';
 m.innerHTML=`<div id="cycPop" role="dialog">
  <div class="hd">↻ 신규진행 (새 차수 시작) — ${esc(o.category||'')} · ${esc(o.job||'')}<button class="x" type="button" title="닫기">×</button></div>
  <div class="bd">
   <div class="note"><b>신규진행</b>은 이미 진행 중인 부품을 <b>처음부터 다시</b> 구매/가공할 때 씁니다. 지금까지의 발주·입고 이력은 <b>이전 차수</b>로 그대로 남고, 이 화면은 새 차수(빈 상태)부터 다시 진행합니다.
   같은 차수 안에서 수량만 더 사는 것은 [재발주]/[추가발주]를 쓰세요. 차수는 원재료·구매품·사내외가공이 각각 따로 셉니다.</div>
   <div style="max-height:42vh;overflow:auto"><table><thead><tr><th style="width:30px"><input type="checkbox" id="cycAll" title="전체"></th><th>품번</th><th>부품명</th><th>현재</th><th>현재 차수 진행</th><th>다음</th></tr></thead><tbody>
   ${parts.map((p,i)=>`<tr class="${p.can?'':'off'}"${p.can?'':` title="${esc(p.why||'')}"`}><td class="c"><input type="checkbox" data-i="${i}"${p.can?'':' disabled'}></td><td>${esc(p.part)}</td><td>${esc(p.name||'')}</td><td class="c">${p.cur}차</td><td>${esc(p.info||'')}</td><td class="c"><b>${p.cur+1}차</b></td></tr>`).join('')}
   </tbody></table></div>
   <div class="rs">${REASONS.map((r,i)=>`<label><input type="radio" name="cycReason" value="${esc(r)}"${i===0?' checked':''}>${esc(r)}</label>`).join('')}</div>
   <input class="memo" id="cycMemo" placeholder="메모 (선택) — 예: 도면 Rev.B 반영, 열처리 후 크랙">
  </div>
  <div class="ft"><button type="button" class="go" id="cycGo">↻ 신규진행 시작</button><button type="button" id="cycNo">취소</button></div></div>`;
 document.body.appendChild(m);
 const q=s=>m.querySelector(s);
 q('.x').onclick=q('#cycNo').onclick=close;
 m.addEventListener('click',e=>{if(e.target===m)close()});
 q('#cycAll').onchange=e=>m.querySelectorAll('tbody input[data-i]:not(:disabled)').forEach(c=>c.checked=e.target.checked);
 q('#cycGo').onclick=async()=>{
  const picks=[...m.querySelectorAll('tbody input[data-i]:checked')].map(c=>parts[Number(c.dataset.i)]);
  if(!picks.length)return alert('신규진행할 품번을 체크하세요.');
  const why=(m.querySelector('input[name=cycReason]:checked')||{}).value||'기타';
  const memo=(q('#cycMemo').value||'').trim();
  if(!confirm(`${picks.map(p=>p.part+' ('+p.cur+'차 → '+(p.cur+1)+'차)').join(', ')}\n\n사유: ${why}${memo?' — '+memo:''}\n\n위 품번의 새 차수를 시작합니다. 기존 이력은 이전 차수로 남습니다. 계속할까요?`))return;
  if(!online()){alert('DB 미연결 — 신규진행은 DB 연결 상태에서만 됩니다.');return}
  q('#cycGo').disabled=true;
  try{
   await MESDB.table('part_cycles').upsert(picks.map(p=>({job_no:o.job,category:o.category,part_no:p.part,cycle_no:p.cur+1,reason:why,memo:memo||null,started_by:o.by||null})));
   await load(o.job,o.category);
   close();
   if(o.onDone)await o.onDone(picks.map(p=>p.part),why);
  }catch(e){q('#cycGo').disabled=false;alert('신규진행 기록 실패: '+String(e.message||e).slice(0,160)+'\n\nsql_v225_cycle.sql 을 Supabase 에 실행했는지 확인하세요.')}
 };
}
/* ── 차수 관리 (취소 · 종료) ──
 * o = {job, category, by, rows:[{part,name,no,total,open:[{line_id,label}],partial}], onDone(kind,part,no)}
 *   total  : 그 차수의 발주라인 수 (0 이면 취소 가능, 단 1차는 취소 불가)
 *   open   : 미입고(입고수량 0) 발주라인 — 종료 시 삭제된다
 *   partial: 일부 입고된 라인 수 (종료해도 이력으로 남는다)
 *   취소 = 잘못 누른 신규진행 되돌리기 (part_cycles 행 삭제 → 이전 차수가 다시 현재 차수)
 *   종료 = 미입고 발주를 지우고 차수를 닫는다 (이력 유지 · 최종완료 필터에서 숨김) */
const END_REASONS=['설계변경 폐기','업체 문제','중복 발주','수량 조정','기타'];
function manage(o){
 o=o||{};css();close();
 const rows=(o.rows||[]).slice().sort((a,b)=>String(a.part).localeCompare(String(b.part),'ko',{numeric:true})||a.no-b.no);
 if(!rows.length){alert('차수를 관리할 품번이 없습니다.');return}
 const m=document.createElement('div');m.id='cycMask';
 const st=r=>{const en=isEnded(r.part,r.no);if(en)return '종료';if(!r.total)return '발주 없음';if(!r.open.length&&!r.partial)return `완료 (${r.total}건 입고확정)`;return `발주 ${r.total} · 미입고 ${r.open.length}${r.partial?' · 일부입고 '+r.partial:''}`};
 m.innerHTML=`<div id="cycPop" role="dialog">
  <div class="hd">⚙ 차수 관리 — ${esc(o.category||'')} · ${esc(o.job||'')}<button class="x" type="button" title="닫기">×</button></div>
  <div class="bd">
   <div class="note"><b>되돌리기</b>: 잘못 누른 신규진행을 취소합니다 — 그 차수에 발주가 하나도 없을 때만 되고, 이전 차수가 다시 현재 차수가 됩니다.<br>
   <b>종료</b>: 더 진행하지 않을 차수를 닫습니다 — <b>미입고(입고수량 0) 발주는 삭제</b>되고, 일부라도 입고된 건과 완료 건은 이력으로 남습니다. 종료된 차수는 「최종완료 제외」에서 숨겨집니다.</div>
   <div style="max-height:46vh;overflow:auto"><table><thead><tr><th>품번</th><th>부품명</th><th>차수</th><th>시작 사유</th><th>상태</th><th style="width:150px"></th></tr></thead><tbody>
   ${rows.map((r,i)=>{const h=info(r.part,r.no)||{};const en=!!h.ended;const canCancel=r.no>1&&!r.total&&r.no===cur(r.part);const canEnd=!en&&(r.open.length>0||r.partial>0);
    return `<tr class="${en?'off':''}"><td>${esc(r.part)}</td><td>${esc(r.name||'')}</td><td class="c">${r.no}차${r.no===cur(r.part)?' <small>(현재)</small>':''}</td><td>${esc(r.no===1?'처음 진행':(h.reason||''))}${h.memo?` <small>(${esc(h.memo)})</small>`:''}</td><td>${esc(st(r))}${en?` <small>${esc(h.endAt||'')} ${esc(h.endReason||'')}</small>`:''}</td>
     <td class="c"><button type="button" class="warn" data-cancel="${i}"${canCancel?'':' disabled'} title="${canCancel?'이 차수를 없애고 이전 차수로 되돌립니다 (잘못 누른 신규진행 취소)':r.no<=1?'1차(처음 진행)는 되돌릴 수 없습니다':r.total?'발주가 있어 되돌릴 수 없습니다 — 발주를 먼저 취소하거나 [종료]하세요':'현재 차수만 되돌릴 수 있습니다'}">↩ 되돌리기</button>
      <button type="button" class="end" data-end="${i}"${canEnd?'':' disabled'} title="${canEnd?'미입고 발주를 지우고 이 차수를 닫습니다':en?'이미 종료된 차수':r.total?'전부 입고확정된 차수라 종료할 것이 없습니다':'발주가 없는 차수는 [되돌리기]하세요'}">■ 종료</button></td></tr>`}).join('')}
   </tbody></table></div>
   <div class="rs" style="margin-top:12px"><b style="margin-right:6px">종료 사유</b>${END_REASONS.map((r,i)=>`<label><input type="radio" name="cycEndReason" value="${esc(r)}"${i===0?' checked':''}>${esc(r)}</label>`).join('')}</div>
   <input class="memo" id="cycEndMemo" placeholder="종료 메모 (선택)">
  </div>
  <div class="ft"><button type="button" id="cycNo">닫기</button></div></div>`;
 document.body.appendChild(m);
 const q=s=>m.querySelector(s);q('.x').onclick=q('#cycNo').onclick=close;m.addEventListener('click',e=>{if(e.target===m)close()});
 m.querySelectorAll('button[data-cancel]').forEach(b=>b.onclick=async()=>{const r=rows[Number(b.dataset.cancel)];
  if(!confirm(`${r.part} ${r.no}차를 되돌립니다(신규진행 취소).\n이 차수 기록이 지워지고 ${r.no-1}차가 다시 현재 차수가 됩니다. 계속할까요?`))return;
  if(!online())return alert('DB 미연결');b.disabled=true;
  try{await MESDB.table('part_cycles').delete({job_no:o.job,category:o.category,part_no:r.part,cycle_no:r.no});await load(o.job,o.category);close();if(o.onDone)await o.onDone('cancel',r.part,r.no)}
  catch(e){b.disabled=false;alert('차수 취소 실패: '+String(e.message||e).slice(0,160))}});
 m.querySelectorAll('button[data-end]').forEach(b=>b.onclick=async()=>{const r=rows[Number(b.dataset.end)];
  const why=(m.querySelector('input[name=cycEndReason]:checked')||{}).value||'기타',memo=(q('#cycEndMemo').value||'').trim();
  const del=r.open||[];
  if(!confirm(`${r.part} ${r.no}차를 종료합니다.\n사유: ${why}${memo?' — '+memo:''}\n\n`+(del.length?`미입고 발주 ${del.length}건이 삭제됩니다:\n${del.slice(0,8).map(x=>' · '+x.label).join('\n')}${del.length>8?'\n  … 외 '+(del.length-8)+'건':''}\n\n`:'')+(r.partial?`일부 입고된 ${r.partial}건은 이력으로 남습니다.\n\n`:'')+'계속할까요?'))return;
  if(!online())return alert('DB 미연결');b.disabled=true;
  try{
   if(del.length)await MESDB.delLines(del.map(x=>Number(x.line_id)));
   const h=info(r.part,r.no);
   const row={job_no:o.job,category:o.category,part_no:r.part,cycle_no:r.no,ended_at:new Date().toISOString(),end_reason:why,end_memo:memo||null,ended_by:o.by||null};
   if(!h)Object.assign(row,{reason:'(처음 진행)',memo:null,started_by:null});
   await MESDB.table('part_cycles').upsert([row],'job_no,category,part_no,cycle_no');
   await load(o.job,o.category);close();if(o.onDone)await o.onDone('end',r.part,r.no)}
  catch(e){b.disabled=false;alert('차수 종료 실패: '+String(e.message||e).slice(0,160)+'\n\nsql_v227_cycle_end.sql 을 실행했는지 확인하세요.')}});
}
/* 차수 관리용 — 제번·구분의 order_lines 를 품번|차수 로 묶어 {total, open:[{line_id,label}], partial} */
async function linesByCycle(job,category){
 const out=new Map();if(!online())return out;
 const q=c=>`select=line_id,part_no,vendor_name,machining_process_code,step_no,status,order_qty,receipt_qty${c?',cycle_no':''}&category=eq.${encodeURIComponent(category)}&job_no=eq.${encodeURIComponent(job)}&order=line_id`;
 let rs;try{rs=await MESDB.table('order_lines').select(q(1),{fresh:true})}catch(e){rs=await MESDB.table('order_lines').select(q(0),{fresh:true})}
 (rs||[]).forEach(l=>{if(/취소/.test(String(l.status||'')))return;const k=key(l.part_no)+'|'+(Number(l.cycle_no)||1);const g=out.get(k)||{total:0,open:[],partial:0};g.total++;
  const rq=Number(l.receipt_qty)||0,st=String(l.status||'');
  if(st==='발주'&&rq<=0)g.open.push({line_id:l.line_id,label:`${l.vendor_name||''} ${l.machining_process_code?'공정'+(l.step_no||'')+' '+l.machining_process_code+' ':''}${Number(l.order_qty)||0}개 ${st}`.trim()});
  else if(st!=='입고확정'&&rq>0)g.partial++;
  out.set(k,g)});
 return out;
}
/* 화면 공통 — parts:[{part,name}] 를 차수별 행으로 펼쳐 manage() 를 연다 */
async function manageFor(o){
 const map=await linesByCycle(o.job,o.category);const rows=[];
 (o.parts||[]).forEach(p=>{const n=cur(p.part);for(let c=1;c<=n;c++){const g=map.get(key(p.part)+'|'+c)||{total:0,open:[],partial:0};rows.push({part:p.part,name:p.name||'',no:c,total:g.total,open:g.open,partial:g.partial})}});
 manage(Object.assign({},o,{rows}));
}
window.MESCYCLE={load,loadMany,snap,restore,cur,reason,info,isEnded,linesByCycle,manageFor,hist,rowsOf,lineNo,badge,title,start,manage,close,REASONS,END_REASONS,get job(){return JOB},get category(){return CAT}};
})();
