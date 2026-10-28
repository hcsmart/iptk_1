/* 사내외가공 발주 — 엑셀 실적등록 (v2 : 양식에 기존 실적을 채워 내보내고, 고치거나 덧붙여 올린다)
 *
 * ▣ 쓰는 법 (대량 작업)
 *   1) [▦ 엑셀내보내기] : 보이는 부품별 가공공정을 "부품 × 공정" 한 줄씩 내려받는다.
 *      이미 등록된 발주·입고·사내실적이 있으면 그 값이 ▶ 칸에 채워진 채로 나온다 (발주건·실적이 여러 건이면 줄도 여러 개).
 *      (제번을 비우고 [조회]한 전체 보기면 모든 제번이 한 파일에 들어간다)
 *   2) 엑셀에서 ▶ 로 시작하는 칸을 고치거나 채운다.
 *        외주 공정 : ▶발주업체(+▶발주수량·▶단가·▶발주일·▶입고요구일) → 새 발주 / 발주번호가 있는 줄은 그 발주건 수정(미입고일 때)
 *                    ▶입고수량(+▶입고일) → 입고 (기존 입고수량보다 늘리면 그 차이만큼 추가 입고)
 *                    ▶입고확정 Y → 전량 입고된 발주건 입고확정
 *        사내 공정 : ▶가공시간(분)(+▶작업일·▶작업자·▶설비코드·▶시간당단가) → 새 완료등록 / 실적번호가 있는 줄은 그 실적 수정
 *                    실적번호가 있는 줄의 가공시간을 비우면 그 실적 삭제
 *      바뀌지 않은 줄·비워 둔 줄은 건드리지 않는다.
 *   3) [⇪ 엑셀 실적등록] 으로 올리면 미리보기(무엇을 할지·오류)를 보여 주고, [▣ 등록] 으로 반영한다.
 *
 * ▣ 저장 경로는 화면에서 하나씩 할 때와 같다
 *   발주/수정  → MESDB.newLines / order_lines upsert(line_id)  (새 발주는 dupCheck 로 순서 확인)
 *   입고       → fn_osp_receive RPC (+ 입고확정은 order_lines.status='입고확정')
 *   사내완료   → design_results (work_type=가공) upsert(row_no) / delete
 *
 * outsourcing_order_input.html 의 전역(ROUTES·jobView·loadRoutes·stepInfo …)을 그대로 쓴다. 그 화면 끝에서만 로드한다.
 * 태진(TJD)·IPTK 두 저장소의 화면에서 같은 파일을 쓴다 — 다른 곳은 '전체 보기' 구현만이라 아래 A 에서 갈라 탄다.
 */
(function(){
'use strict';
const XL_LIB='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
const SHEET='가공실적';
/* 열 정의: [머리글, 키, 설명]. ▶ 가 붙은 열이 입력 칸 */
const COLS=[
 ['제번','job','수주 제번 (바꾸지 않음)'],
 ['조','jo','공정(조) 번호'],
 ['부품코드','part','부품코드 (바꾸지 않음)'],
 ['부품명','name',''],
 ['소요수량','qty','PartList 소요수량 — 새 발주의 발주수량 기본값'],
 ['차수','cyc','가공 차수 (바꾸지 않음)'],
 ['공정순번','sn','공정1~10 의 번호 (바꾸지 않음)'],
 ['가공공정코드','mp',''],
 ['가공공정','mpName',''],
 ['구분','kind','사내 / 외주'],
 ['현재상태','state','내보낸 시점의 상태: 미발주·출고·입고·완료·사내완료·사내미완'],
 ['발주번호','lid','【외주】 이미 등록된 발주건 번호 — 있으면 그 발주건을 고친다 (바꾸지 않음). 비어 있으면 새 발주'],
 ['실적번호','rid','【사내】 이미 등록된 실적 번호 — 있으면 그 실적을 고친다 (바꾸지 않음). 비어 있으면 새 실적'],
 ['▶발주업체','vendor','【외주】 업체명 (기준정보 › 업체관리에 있는 이름). 새 줄에 채우면 발주'],
 ['▶발주수량','oqty','【외주】 비우면 소요수량. 미입고 발주건만 고칠 수 있음'],
 ['▶단가','price','【외주】 비우면 공정단가(단가관리)에서 자동. 발주금액 = 단가 × 수량'],
 ['▶발주일','odate','【외주】 비우면 오늘'],
 ['▶입고요구일','rdate','【외주】 비우면 발주일+12일'],
 ['▶입고수량','iqty','【외주】 누계 입고수량. 지금보다 크게 쓰면 그 차이만큼 입고. 줄이는 것(입고취소)은 화면에서'],
 ['▶입고일','idate','【외주】 추가 입고의 입고일, 비우면 오늘'],
 ['▶입고확정','ifix','【외주】 Y 를 쓰면 전량 입고된 발주건을 입고확정(확정가=발주금액). 확정 취소는 화면에서'],
 ['▶작업일','wdate','【사내】 비우면 오늘'],
 ['▶가공시간(분)','wmin','【사내】 새 줄에 채우면 완료등록. 실적번호 있는 줄에서 비우면 그 실적 삭제'],
 ['▶작업자','worker','【사내】'],
 ['▶설비코드','equip','【사내】 단가 조회에 쓰임'],
 ['▶시간당단가','wrate','【사내】 비우면 작업단가(설비코드→공정코드→MCH) 자동. 가공비 = 시간 × 단가'],
 ['▶비고','remark','발주 비고 / 입고 비고']
];
const KEY=h=>String(h||'').replace(/[▶*\s]/g,'').replace(/\(.*\)$/,'');
const COLK=Object.fromEntries(COLS.map(c=>[KEY(c[0]),c[1]]));
const HEAD=Object.fromEntries(COLS.map(c=>[c[1],c[0]]));
const IN=COLS.filter(c=>c[0].startsWith('▶')).map(c=>c[1]);
const DATES=['odate','rdate','idate','wdate'],NUMS=['oqty','price','iqty','wmin','wrate','sn','cyc','qty','lid','rid'];
const T=()=>new Date().toISOString().slice(0,10);
const esc=v=>String(v??'').replace(/[&<>"]/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[x]));
const num=v=>{const t=String(v??'').replace(/[,\s원]/g,'');return t===''?null:(Number.isNaN(Number(t))?NaN:Number(t))};
const d10=v=>String(v||'').slice(0,10);
const won=v=>(Number(v)||0).toLocaleString('ko-KR');
function xdate(v){
 if(v==null||v==='')return '';
 if(v instanceof Date)return isNaN(v)?null:new Date(v.getTime()-v.getTimezoneOffset()*6e4).toISOString().slice(0,10);
 if(typeof v==='number'&&v>20000&&v<80000){return new Date(Date.UTC(1899,11,30)+Math.round(v)*864e5).toISOString().slice(0,10)}
 const t=String(v).trim();const m=/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/.exec(t)||/^(\d{4})(\d{2})(\d{2})$/.exec(t);
 if(m)return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
 return null;
}
function lib(){if(window.XLSX)return Promise.resolve();return new Promise((ok,no)=>{const s=document.createElement('script');
 s.src=XL_LIB;s.onload=()=>ok();s.onerror=()=>no(new Error('엑셀 모듈을 불러오지 못했습니다 (인터넷 연결 확인)'));document.head.appendChild(s)})}
const online=()=>!!(window.MESDB&&MESDB.online);
/* ── 저장소별 '전체 보기' 차이 ──
 *   TJD : ALLMODE/ALLBUSY, searchAll(), preloadAll()/preTable() — 제번마다 loadRoutes 를 돌려 표를 모은다
 *   IPTK: ALL/JS/CURJ, loadAll(), useJob(job,true) — ROUTES 에 모든 제번 줄(r.job)을 두고 제번별 상태를 바꿔 끼운다 */
const A={
 tjd:()=>typeof ALLMODE!=='undefined',
 isAll(){return this.tjd()?!!ALLMODE:(typeof ALL!=='undefined'&&!!ALL)},
 leave(){if(this.tjd()){if(ALLMODE||ALLBUSY){ALLMODE=false;ALLBUSY=false;_allSeq++}}else if(typeof ALL!=='undefined'&&ALL){ALL=false;JS.clear();CURJ=''}},
 async restore(){if(this.tjd()){if(typeof searchAll==='function')await searchAll(true)}else if(typeof loadAll==='function'){ALL=true;await loadAll()}},
 allJobs(){return this.tjd()?[...routeBody.querySelectorAll('tr.allhd')].map(t=>t.dataset.hjob).filter(Boolean):[...new Set(ROUTES.map(r=>r.job).filter(Boolean))]}
};

/* ───────── 현재 상태 ───────── */
function stateOf(r,i){
 if(isHouse(r,i))return houseDone(r,i)?'사내완료':'사내미완';
 const st=stepState(r,i);return st===''?'미발주':st;
}
const lineSt=l=>ST_DB[String(l.status||'')]||l.status||'';
function rowAllDone(r){
 const codes=(r.steps||[]).map(stepCode).filter(Boolean);
 return codes.length>0&&nextStep(r)===-1&&codes.every((c,i)=>isHouse(r,i)?houseDone(r,i):RECV(stepState(r,i)));
}
const houseRate=e=>{const m=Number(e.work_minutes)||0,c=Number(e.labor_cost)||0;return m?Math.round(c/m*60):''};
/* 지금 ROUTES(선택 제번)의 공정 줄들을 엑셀 행으로 — 기존 발주건·실적을 채워서 */
function rowsOfJob(j,hideDone){
 const out=[];
 ROUTES.forEach(r=>{
  if(r.job&&r.job!==j.job)return;                  /* IPTK 전체 보기: 다른 제번 줄 */
  if(r.old)return;                                  /* 이전 차수 줄은 손댈 수 없다 */
  if(hideDone&&(rowAllDone(r)||(window.MESCYCLE&&MESCYCLE.isEnded(r.part,rowCyc(r)))))return;
  const codes=(r.steps||[]).map(stepCode).filter(Boolean);
  codes.forEach((c,i)=>{
   const base={job:j.job,jo:r.jo??'',part:r.part,name:r.name||'',qty:r.qty!=null?Number(r.qty):1,cyc:rowCyc(r),
    sn:i+1,mp:c,mpName:procName(c),kind:isHouse(r,i)?'사내':'외주',state:stateOf(r,i),lid:'',rid:'',
    vendor:'',oqty:'',price:'',odate:'',rdate:'',iqty:'',idate:'',ifix:'',wdate:'',wmin:'',worker:'',equip:'',wrate:'',remark:''};
   if(isHouse(r,i)){
    const rows=houseInfo(r,i).rows||[];
    if(!rows.length)return out.push(base);
    rows.forEach(e=>out.push({...base,rid:e.row_no,wdate:d10(e.work_date),wmin:Number(e.work_minutes)||'',worker:e.worker_name||'',equip:e.equipment_code||'',wrate:houseRate(e)}));
   }else{
    const lines=(stepInfo(r,i).lines||[]).slice().sort((a,b)=>(Number(a.line_id)||0)-(Number(b.line_id)||0));
    if(!lines.length)return out.push(base);
    lines.forEach(l=>out.push({...base,state:lineSt(l),lid:l.line_id,vendor:l.vendor_name||'',oqty:Number(l.order_qty)||'',
     price:l.unit_price!=null?Number(l.unit_price):'',odate:d10(l.order_date),rdate:d10(l.required_date),
     iqty:Number(l.receipt_qty)||'',idate:d10(l.receipt_date),ifix:String(l.status||'')==='입고확정'?'Y':'',remark:String(l.remark||'')}));
   }
  });
 });
 return out;
}
/* 제번 하나를 골라 부품별 가공공정을 읽는다 (pickJob 과 같은 뒷정리) */
async function openJob(job){
 let i=jobView.findIndex(x=>x.job===job);
 if(i<0){const k=JOBS.findIndex(x=>x.job===job);if(k<0)return null;jobView.length=0;jobView.push(...JOBS);renderJobs();i=k}
 A.leave();
 jobIdx=i;renderJobs();
 await loadRoutes();
 return jobView[i];
}

/* ───────── ① 엑셀내보내기 ───────── */
async function exportXl(){
 try{await lib()}catch(e){return msg(e.message)}
 if(!online())return msg('DB 미연결 — 엑셀로 내보낼 수 없습니다.');
 const hideDone=(document.getElementById('doneF')||{}).value==='x';
 let jobs=[];
 if(A.isAll())jobs=A.allJobs();
 else{const j=jobView[jobIdx];if(j)jobs=[j.job]}
 if(!jobs.length)return msg('내보낼 제번이 없습니다. 제번을 고르거나 [조회]로 전체 부품을 먼저 불러오세요.');
 const wasAll=A.isAll(),keepIdx=jobIdx;let left=false;
 const rows=[];
 const b=document.getElementById('btnXlOut');if(b)b.disabled=true;
 try{
  if(wasAll&&!A.tjd()){
   /* IPTK 전체 보기: 줄은 이미 ROUTES 에 다 있다 — 제번별 상태(ORDERED·HOUSE)만 바꿔 끼우며 읽는다 */
   for(const job of jobs){const j=jobView.find(x=>x.job===job);if(!j)continue;useJob(job,true);rows.push(...rowsOfJob(j,hideDone))}
  }else if(jobs.length===1){
   if(wasAll){left=true;await openJob(jobs[0])}
   rows.push(...rowsOfJob(jobView[jobIdx],hideDone));
  }else{
   left=true;
   /* 전체 보기: 표 5개를 한 번에 읽어 두고 제번별로 걸러 쓴다 (searchAll 과 같은 방법) */
   msg(`엑셀 내보내기 — 제번 ${jobs.length}개 자료를 읽는 중…`);
   A.leave();
   const PRE=await preloadAll();const orig=MESDB.table;MESDB.table=preTable(orig,PRE);
   try{for(let k=0;k<jobs.length;k++){
     const i=jobView.findIndex(x=>x.job===jobs[k]);if(i<0)continue;
     jobIdx=i;await loadRoutes();rows.push(...rowsOfJob(jobView[i],hideDone));
     if((k&7)===7)msg(`엑셀 내보내기 — ${k+1}/${jobs.length} 제번`);
   }}finally{if(MESDB.table!==orig)MESDB.table=orig}
  }
  if(!rows.length){msg('내보낼 공정 줄이 없습니다. (최종완료 「포함」으로 바꾸면 완료된 줄도 나옵니다)');return}
  const aoa=[COLS.map(c=>c[0]),...rows.map(r=>COLS.map(c=>r[c[1]]))];
  const ws=XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols']=COLS.map(c=>({wch:Math.max(8,Math.min(22,String(c[0]).replace(/[▶]/g,'').length*2+2))}));
  ws['!freeze']={xSplit:3,ySplit:1};ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:rows.length,c:COLS.length-1}})};
  const guide=XLSX.utils.aoa_to_sheet([['항목','설명'],...COLS.map(c=>[c[0],c[2]]),[],
   ['쓰는 법','이 파일은 지금 등록된 발주·입고·사내실적이 ▶ 칸에 채워진 양식입니다. ▶ 칸을 고치거나 빈 줄에 채운 뒤 [⇪ 엑셀 실적등록]으로 올리세요.'],
   ['','제번·부품코드·공정순번·차수·발주번호·실적번호는 줄을 찾는 열쇠이므로 바꾸지 마세요. 바뀌지 않은 줄은 그대로 둡니다.'],
   ['','같은 공정에 발주건(실적)을 하나 더 넣으려면 그 줄을 복사해 발주번호(실적번호)를 지우고 값을 쓰세요.'],
   ['','외주 공정의 새 발주는 직전 외주 공정이 입고된 뒤에만 됩니다. 한 파일에서 앞 공정 입고와 뒤 공정 발주를 함께 처리할 수 있습니다.'],
   ['','날짜는 2026-10-28 처럼 쓰거나 엑셀 날짜 형식이면 됩니다.']]);
  guide['!cols']=[{wch:16},{wch:110}];
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,SHEET);XLSX.utils.book_append_sheet(wb,guide,'작성안내');
  const name=`가공실적_${jobs.length===1?jobs[0]:'전체'+jobs.length+'제번'}_${T()}.xlsx`;
  XLSX.writeFile(wb,name);
  const nl=rows.filter(r=>r.lid).length,nr=rows.filter(r=>r.rid).length;
  msg(`${name} — 공정 ${rows.length}줄(제번 ${jobs.length}개, 기존 발주 ${nl}건·사내실적 ${nr}건 포함)을 내보냈습니다. 고치거나 채워서 [⇪ 엑셀 실적등록]으로 올리세요.`);
 }catch(e){msg('엑셀 내보내기 실패: '+String(e.message||e).slice(0,120))}
 finally{if(b)b.disabled=false;
  if(wasAll&&left){try{await A.restore()}catch(e){}}else if(!wasAll&&jobIdx!==keepIdx&&jobView[keepIdx]){jobIdx=keepIdx;renderJobs();await loadRoutes()}}
}

/* ───────── ② 엑셀 읽기 → 미리보기 ───────── */
let XL=[];           /* 읽은 줄 */
let XL_WASALL=false;
async function loadXl(file){
 if(!file)return;
 try{await lib()}catch(e){return msg(e.message)}
 if(!online())return msg('DB 미연결 — 엑셀 실적등록을 할 수 없습니다.');
 msg(file.name+' 읽는 중…');
 let grid;
 try{const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});const ws=wb.Sheets[SHEET]||wb.Sheets[wb.SheetNames[0]];
  grid=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:'',blankrows:false})}catch(e){return msg('엑셀을 읽지 못했습니다: '+String(e.message||e).slice(0,100))}
 const hi=grid.findIndex(r=>r.some(c=>KEY(c)==='제번')&&r.some(c=>KEY(c)==='부품코드'));
 if(hi<0)return msg('「제번」「부품코드」 머리글을 찾지 못했습니다. [▦ 엑셀내보내기]로 받은 파일을 쓰세요.');
 const col={};grid[hi].forEach((h,i)=>{const k=COLK[KEY(h)];if(k&&col[k]==null)col[k]=i});
 for(const k of ['job','part','sn'])if(col[k]==null)return msg(`엑셀에 「${HEAD[k]}」 열이 없습니다.`);
 XL=[];
 grid.slice(hi+1).forEach((row,n)=>{
  const g=k=>col[k]==null?'':row[col[k]];
  const v={line:hi+n+2,err:[],warn:[],acts:[]};
  for(const c of COLS){const k=c[1];let x=g(k);
   if(DATES.includes(k)){const d=xdate(x);if(d===null){v.err.push(`${c[0]} 날짜 형식 오류(${x})`);x=''}else x=d}
   else if(NUMS.includes(k)){const t=num(x);if(Number.isNaN(t)){v.err.push(`${c[0]} 숫자 아님(${x})`);x=null}else x=t}
   else x=String(x??'').trim();
   v[k]=x}
  if(!v.job&&!v.part)return;                          /* 빈 줄 */
  v.job=String(v.job).trim();v.part=String(v.part).trim();
  v.ifix=/^(y|yes|예|확정|o|1|true)$/i.test(String(v.ifix||''));
  /* 입력 칸에 무엇이든 있거나, 기존 건(발주번호·실적번호)이 있는 줄은 확인 대상 */
  v.touched=IN.some(k=>k==='ifix'?v.ifix:(v[k]!==''&&v[k]!=null))||v.lid!=null||v.rid!=null;
  XL.push(v);
 });
 if(!XL.length)return msg('엑셀에 줄이 없습니다.');
 if(!XL.some(v=>v.touched))return msg(`${XL.length}줄을 읽었지만 ▶ 입력 칸이 채워진 줄이 없습니다.`);
 XL_WASALL=A.isAll();
 await analyze();
 ui();render();
 document.getElementById('xlrMask').classList.add('on');
 const n=XL.filter(v=>v.acts.length).length,e=XL.filter(v=>v.err.length).length;
 msg(`${file.name} — ${XL.length}줄 확인: 바뀐 것 ${n}줄${e?` · 오류 ${e}줄`:''}. 미리보기에서 확인 후 [▣ 등록]을 누르세요.`);
}
/* 제번별로 현재 상태를 읽어 각 줄에 '무엇을 할지'를 정한다 */
async function analyze(){
 const jobs=[...new Set(XL.filter(v=>v.touched).map(v=>v.job))];
 const venMap=new Map((VENDORS||[]).map(v=>[String(v).trim().toLowerCase(),String(v).trim()]));
 for(let k=0;k<jobs.length;k++){
  const job=jobs[k];msg(`엑셀 확인 중… ${k+1}/${jobs.length} — ${job}`);
  const j=await openJob(job);
  const mine=XL.filter(v=>v.touched&&v.job===job);
  if(!j){mine.forEach(v=>v.err.push(`제번 ${job} 이(가) 제번리스트에 없습니다`));continue}
  for(const v of mine){planRow(v,venMap);await priceCheck(v)}
 }
}
/* 새 발주 줄의 단가가 비어 있으면 공정단가(단가관리)에서 미리 찾아 보여 주고, 없으면 0원 경고 */
async function priceCheck(v){
 if(!v.acts.includes('발주'))return;
 if(v.price!=null){if(!(v.price>0))v.warn.push('단가 0원 — 외주가공비가 잡히지 않습니다');return}
 let hit=null;try{if(window.MESPRICE)hit=await MESPRICE.process(v.c,v.vendor,{asOf:v.odate})}catch(e){}
 if(hit&&hit.price>0){v.price=hit.price;v.priceAuto=true}
 else v.warn.push('단가 미등록 → 0원 발주 (공정단가변동등록 확인)');
}
function findRoute(v){
 const cyc=v.cyc!=null&&v.cyc!==''?Number(v.cyc):null;
 let cands=ROUTES.filter(r=>!r.old&&String(r.part)===v.part&&(cyc==null||rowCyc(r)===cyc)&&(v.jo===''||String(r.jo??'')===String(v.jo)));
 if(!cands.length&&cyc==null)cands=ROUTES.filter(r=>String(r.part)===v.part&&(v.jo===''||String(r.jo??'')===String(v.jo)));
 return cands[0]||null;
}
const venOk=(v,venMap)=>{if(!v.vendor){v.err.push('발주업체를 입력하세요');return false}
 const hit=venMap.get(v.vendor.toLowerCase());if(!hit){v.err.push(`업체 「${v.vendor}」 가 업체관리에 없습니다`);return false}v.vendor=hit;return true};
function planRow(v,venMap){
 v.acts=[];v.warn=[];
 const r=findRoute(v);
 if(!r){v.err.push(`부품 ${v.part}${v.cyc?' '+v.cyc+'차':''} 을(를) ${v.job} 에서 찾지 못했습니다`);return}
 if(r.old||(window.MESCYCLE&&MESCYCLE.isEnded(r.part,rowCyc(r)))){v.err.push('이전(종료) 차수 줄은 등록할 수 없습니다');return}
 const i=Number(v.sn)-1,codes=(r.steps||[]).map(stepCode).filter(Boolean);
 if(!(i>=0&&i<codes.length)){v.err.push(`공정순번 ${v.sn} 이(가) 이 부품의 공정 범위(1~${codes.length})를 벗어났습니다`);return}
 const c=codes[i];
 if(v.mp&&String(v.mp).trim().toUpperCase()!==c.toUpperCase())v.err.push(`공정순번 ${v.sn} 의 가공공정코드가 다릅니다 (엑셀 ${v.mp} / 화면 ${c}) — 공정이 바뀌었으면 다시 내보내세요`);
 v.r=r;v.i=i;v.c=c;v.cycNow=rowCyc(r);v.mpName=procName(c);v.kindNow=isHouse(r,i)?'사내':'외주';v.stateNow=stateOf(r,i);
 const hasOrderIn=!!v.vendor||v.oqty!=null||v.price!=null||!!v.odate||!!v.rdate;
 const hasRecvIn=v.iqty!=null||!!v.idate||v.ifix;
 const hasHouseIn=v.wmin!=null||!!v.wdate||!!v.worker||!!v.equip||v.wrate!=null;

 /* ── 사내 공정 ── */
 if(isHouse(r,i)){
  if(hasOrderIn||hasRecvIn)v.err.push('사내 공정에는 발주·입고를 할 수 없습니다 (▶가공시간 칸을 쓰세요)');
  if(v.rid!=null){                                   /* 기존 실적 수정·삭제 */
   const e=(houseInfo(r,i).rows||[]).find(x=>Number(x.row_no)===Number(v.rid));
   if(!e){v.err.push(`실적번호 ${v.rid} 가 이 공정에 없습니다 (이미 지워졌으면 다시 내보내세요)`);return}
   v.cur=e;
   if(v.wmin==null){v.acts.push('사내삭제');return}
   if(!(v.wmin>0)){v.err.push('가공시간(분)은 1 이상');return}
   const rate0=houseRate(e);
   const chg=Math.round(v.wmin)!==(Number(e.work_minutes)||0)||(v.wdate&&v.wdate!==d10(e.work_date))||(v.worker!==String(e.worker_name||''))||(v.equip!==String(e.equipment_code||''))||(v.wrate!=null&&Math.round(v.wrate)!==rate0);
   if(chg)v.acts.push('사내수정');
   return;
  }
  if(hasHouseIn){if(!(v.wmin>0))v.err.push('가공시간(분)을 1 이상 입력하세요');else v.acts.push('사내완료')}
  return;
 }

 /* ── 외주 공정 ── */
 if(hasHouseIn)v.err.push('외주 공정에는 사내 가공시간을 등록할 수 없습니다');
 const st=stepState(r,i),o=stepInfo(r,i);
 if(v.lid!=null){                                    /* 기존 발주건 수정·입고·확정 */
  const l=(o.lines||[]).find(x=>Number(x.line_id)===Number(v.lid));
  if(!l){v.err.push(`발주번호 ${v.lid} 가 이 공정에 없습니다 (취소됐으면 다시 내보내세요)`);return}
  v.cur=l;
  const got=Number(l.receipt_qty)||0,ord=Number(l.order_qty)||1,lst=String(l.status||'');
  const patch={};
  if(v.vendor&&v.vendor!==String(l.vendor_name||'')){if(venOk(v,venMap))patch.vendor_name=v.vendor}
  if(v.oqty!=null&&Math.round(v.oqty)!==ord){if(!(v.oqty>0))v.err.push('발주수량은 1 이상');else patch.order_qty=Math.round(v.oqty)}
  if(v.price!=null&&(l.unit_price==null||Number(v.price)!==Number(l.unit_price)))patch.unit_price=v.price;
  if(v.odate&&v.odate!==d10(l.order_date))patch.order_date=v.odate;
  if(v.rdate&&v.rdate!==d10(l.required_date))patch.required_date=v.rdate;
  if(v.remark!==String(l.remark||''))patch.remark=v.remark||null;
  if(patch.vendor_name!=null||patch.order_qty!=null){
   if(got>0||/입고/.test(lst))v.err.push('이미 입고된 발주건은 업체·수량을 바꿀 수 없습니다 (화면에서 입고취소 후)');
  }
  if(patch.order_qty!=null&&patch.order_qty<got)v.err.push(`발주수량 ${patch.order_qty} 이 입고수량 ${got} 보다 작습니다`);
  if(Object.keys(patch).length){
   if(patch.unit_price!=null||patch.order_qty!=null){const q=patch.order_qty??ord,p=patch.unit_price??(Number(l.unit_price)||0);patch.quote_price=p*q||null}
   v.patch=patch;if(!v.err.length)v.acts.push('발주수정');
  }
  if(v.iqty!=null){
   const want=Math.round(v.iqty);
   if(want<got)v.err.push(`입고수량 ${want} 이 지금 입고수량 ${got} 보다 작습니다 — 입고취소는 화면에서`);
   else if(want>got){
    const ordN=patch.order_qty??ord;
    if(lst==='입고확정')v.err.push('입고확정된 발주건에는 더 입고할 수 없습니다');
    else if(want>ordN)v.err.push(`입고수량 ${want} 이 발주수량 ${ordN} 보다 큽니다`);
    else{v.addQty=want-got;v.idate=v.idate||T();v.acts.push('입고')}
   }
  }
  if(v.ifix&&lst!=='입고확정'){
   const after=got+(v.addQty||0),ordN=patch.order_qty??ord;
   if(after>=ordN){v.acts.push('입고확정')}else v.warn.push(`잔량 ${ordN-after} 이 남아 입고확정은 하지 않습니다`);
  }
  return;
 }
 /* 새 발주 */
 if(hasOrderIn){
  if(st!==''&&!(o.lines||[]).length)v.err.push(`이미 ${st} 상태라 발주할 수 없습니다`);
  else if(st!==''&&st!=='완료')v.err.push(`이 공정은 이미 ${st} 상태입니다 — 추가발주는 발주번호를 지운 새 줄로만, 기존 건 수정은 발주번호가 있는 줄에서`);
  if(st==='완료')v.warn.push('완료된 공정에 추가발주');
  venOk(v,venMap);
  if(v.oqty!=null&&!(v.oqty>0))v.err.push('발주수량은 1 이상');
  v.oqty=v.oqty!=null&&v.oqty>0?Math.round(v.oqty):(Number(r.qty)||1);
  v.odate=v.odate||T();v.rdate=v.rdate||new Date(new Date(v.odate).getTime()+12*864e5).toISOString().slice(0,10);
  /* 직전 외주 공정 확인 — 같은 파일에서 그 공정을 입고하는 줄이 있으면 통과 (실행 순서가 앞) */
  const po=prevOut(r,i);
  if(po>=0&&!RECV(stepState(r,po))){
   const pre=XL.find(x=>x!==v&&x.touched&&x.job===v.job&&x.part===v.part&&Number(x.sn)===po+1&&(Number(x.cyc)||v.cycNow)===v.cycNow&&(x.iqty!=null));
   if(!pre)v.err.push(`직전 공정${po+1} ${procName(codes[po])} 이(가) ${stepState(r,po)||'미발주'} — 입고 후 발주 가능`);
  }
  if(!v.err.length)v.acts.push('발주');
  if(hasRecvIn){
   if(!(v.iqty>0))v.err.push('입고수량을 1 이상 입력하세요');
   else if(v.iqty>v.oqty)v.err.push(`입고수량 ${v.iqty} 이 발주수량 ${v.oqty} 보다 큽니다`);
   else{v.addQty=Math.round(v.iqty);v.idate=v.idate||T();if(!v.err.length){v.acts.push('입고');if(v.ifix&&v.addQty>=v.oqty)v.acts.push('입고확정')}}
  }
  return;
 }
 if(hasRecvIn)v.err.push('발주번호가 없는 줄은 입고할 수 없습니다 — 내보낸 발주건 줄에서 입고수량을 고치거나, ▶발주업체도 채워 새로 발주하세요');
}

/* ───────── 미리보기 창 ───────── */
function ui(){
 if(document.getElementById('xlrMask'))return;
 const st=document.createElement('style');st.textContent=`
#xlrMask{position:fixed;inset:0;background:rgba(40,50,60,.3);display:none;align-items:flex-start;justify-content:center;z-index:9500}#xlrMask.on{display:flex}
#xlrMask .dlg{margin-top:28px;width:min(1280px,97vw);max-height:92vh;display:flex;flex-direction:column;background:#f3f6f8;border:1px solid #7d8d99;box-shadow:0 8px 26px rgba(0,0,0,.25);font-size:12px;color:#22303a}
#xlrMask .hd{display:flex;align-items:center;height:32px;padding:0 6px 0 12px;background:linear-gradient(#eef4f9,#dbe6ef);border-bottom:1px solid #b9c6d0;font-weight:700}
#xlrMask .hd span{font-weight:400;color:#56708a;margin-left:10px}#xlrMask .hd button{margin-left:auto;border:0;background:none;font-size:15px;cursor:pointer}
#xlrMask .bd{overflow:auto;flex:1;padding:8px}#xlrMask table{border-collapse:collapse;width:100%;background:#fff}
#xlrMask th,#xlrMask td{border:1px solid #d5dde3;padding:2px 6px;white-space:nowrap;font-size:11.5px}#xlrMask th{background:#e4ecf3;position:sticky;top:0}
#xlrMask td.c{text-align:center}#xlrMask td.r{text-align:right}#xlrMask tr.bad td{background:#fff5f4}#xlrMask tr.skip td{color:#9aa6b0}
#xlrMask .act{display:inline-block;padding:0 6px;border-radius:8px;color:#fff;font-size:10.5px;margin-right:3px}
#xlrMask .a-order{background:#e07a1f}#xlrMask .a-recv{background:#2f6fb5}#xlrMask .a-house{background:#8a6d3b}#xlrMask .a-del{background:#b02a37}
#xlrMask .ft{display:flex;gap:8px;align-items:center;padding:8px 12px;border-top:1px solid #b9c6d0;background:#eef2f5}#xlrMask .ft .m{margin-left:auto;color:#56708a}
#xlrMask .note{font-size:11px;color:#6d7b88;margin:0 0 6px}#xlrMask .note label{margin-left:10px;cursor:pointer}`;
 document.head.appendChild(st);
 const d=document.createElement('div');d.id='xlrMask';d.innerHTML=`<div class="dlg"><div class="hd">엑셀 실적등록 — 미리보기<span id="xlrInfo"></span><button onclick="MESXLR.close()" title="닫기">✕</button></div>
 <div class="bd"><div class="note"><b>동작</b> 열이 무엇을 할지, <b>확인</b> 열이 막힌 이유입니다. 바뀌지 않은 줄은 건드리지 않고, 오류 줄은 건너뛰고 나머지만 등록합니다. 같은 제번 안에서는 부품·공정 순서대로 처리하므로 앞 공정 입고 → 뒤 공정 발주가 한 번에 됩니다.<label><input type="checkbox" id="xlrAll" onchange="MESXLR.render()"> 바뀌지 않은 줄도 보기</label></div>
 <table><thead><tr><th>엑셀행</th><th>제번</th><th>부품코드</th><th>부품명</th><th>차수</th><th>공정</th><th>가공공정</th><th>구분</th><th>현재</th><th>번호</th><th>동작</th><th>업체</th><th>발주수량</th><th>단가</th><th>입고수량</th><th>입고일</th><th>가공시간</th><th>작업자</th><th>확인</th></tr></thead><tbody id="xlrBody"></tbody></table></div>
 <div class="ft"><button class="btn primary" id="xlrGo" onclick="MESXLR.run()">▣ 등록</button><button class="btn" onclick="MESXLR.close()">닫기</button><span class="m" id="xlrMsg"></span></div></div>`;
 document.body.appendChild(d);
}
const okRow=v=>v.touched&&!v.err.length&&v.acts.length&&!v.done;
function render(){
 const body=document.getElementById('xlrBody');if(!body)return;
 const showAll=!!(document.getElementById('xlrAll')||{}).checked;
 const cls=a=>a.startsWith('발주')?'a-order':a.startsWith('입고')?'a-recv':a==='사내삭제'?'a-del':'a-house';
 const tag=a=>`<span class="act ${cls(a)}">${a}</span>`;
 const list=XL.filter(v=>v.touched&&(showAll||v.acts.length||v.err.length||v.done||v.fail));
 body.innerHTML=list.map(v=>{
  const res=v.done?`<span style="color:#1d6b3a">✔ ${esc(v.done)}</span>`:v.fail?`<span style="color:#b02a37">✖ ${esc(v.fail)}</span>`
   :v.err.length?`<span style="color:#b02a37">${esc(v.err.join(' · '))}</span>`:(v.acts.length?'<span style="color:#1d5da3">등록 예정</span>':'<span style="color:#9aa6b0">변경 없음</span>')+(v.warn.length?` <span style="color:#b8681a">⚠ ${esc(v.warn.join(' · '))}</span>`:'');
  const no=v.lid!=null?'발주#'+v.lid:v.rid!=null?'실적#'+v.rid:'<span style="color:#1d5da3">신규</span>';
  return `<tr class="${v.err.length||v.fail?'bad':(!v.acts.length?'skip':'')}"><td class="c">${v.line}</td><td>${esc(v.job)}</td><td>${esc(v.part)}</td><td>${esc(v.name)}</td><td class="c">${esc(v.cycNow??v.cyc??'')}</td><td class="c">${esc(v.sn)}</td><td>${esc(v.mpName||v.mp)}</td><td class="c">${esc(v.kindNow||v.kind)}</td><td class="c">${esc(v.stateNow||v.state)}</td><td class="c">${no}</td><td>${v.acts.map(tag).join('')}</td><td>${esc(v.vendor)}</td><td class="r">${v.oqty!=null?esc(v.oqty):''}</td><td class="r">${v.price!=null?esc(v.price)+(v.priceAuto?'<small style="color:#8a97a2"> 자동</small>':''):''}</td><td class="r">${v.iqty!=null?esc(v.iqty)+(v.addQty?`<small style="color:#1a4f7a"> (+${v.addQty})</small>`:''):''}</td><td class="c">${esc(v.addQty?v.idate:'')}</td><td class="r">${v.wmin!=null?esc(v.wmin):''}</td><td>${esc(v.worker)}</td><td style="white-space:normal;min-width:220px">${res}</td></tr>`}).join('');
 const all=XL.filter(v=>v.touched),ok=all.filter(okRow).length,bad=all.filter(v=>v.err.length).length,done=all.filter(v=>v.done).length,same=all.filter(v=>!v.acts.length&&!v.err.length).length;
 document.getElementById('xlrInfo').textContent=`읽은 줄 ${all.length} · 등록 대상 ${ok}${bad?` · 오류 ${bad}`:''}${same?` · 변경 없음 ${same}`:''}${done?` · 완료 ${done}`:''}`;
 document.getElementById('xlrGo').disabled=!ok;
}
function close(){const m=document.getElementById('xlrMask');if(m)m.classList.remove('on')}

/* ───────── ③ 등록 실행 ───────── */
async function run(){
 const todo=XL.filter(okRow);if(!todo.length)return;
 const cnt=k=>todo.filter(v=>v.acts.includes(k)).length;
 const sum=[['발주',cnt('발주')],['발주수정',cnt('발주수정')],['입고',cnt('입고')],['입고확정',cnt('입고확정')],['사내완료',cnt('사내완료')],['사내수정',cnt('사내수정')],['사내실적 삭제',cnt('사내삭제')]].filter(x=>x[1]).map(x=>`${x[0]} ${x[1]}건`).join(' · ');
 if(!confirm(`엑셀 ${todo.length}줄을 등록합니다.\n  ${sum}\n계속할까요?`))return;
 const go=document.getElementById('xlrGo');go.disabled=true;
 const say=t=>{const e=document.getElementById('xlrMsg');if(e)e.textContent=t;msg(t)};
 const jobs=[...new Set(todo.map(v=>v.job))];let ok=0,ng=0,done=0;
 for(const job of jobs){
  const j=await openJob(job);if(!j){todo.filter(v=>v.job===job).forEach(v=>{v.fail='제번을 찾지 못함';ng++});render();continue}
  /* 부품 → 공정 순서 (뒤 공정 발주가 앞 공정 입고 뒤에 오게) */
  const mine=todo.filter(v=>v.job===job).sort((a,b)=>String(a.part).localeCompare(String(b.part),'ko',{numeric:true})||(Number(a.cyc)||0)-(Number(b.cyc)||0)||Number(a.sn)-Number(b.sn)||(Number(a.lid)||0)-(Number(b.lid)||0));
  for(const v of mine){
   say(`등록 중… ${++done}/${todo.length} — ${job} ${v.part} 공정${v.sn}`);
   try{
    /* 직전 줄 처리 결과를 반영해 다시 찾는다 */
    const r=ROUTES.find(x=>!x.old&&String(x.part)===v.part&&rowCyc(x)===v.cycNow&&String(x.jo??'')===String(v.r.jo??''))||v.r;
    const i=v.i,c=v.c;const out=[];
    if(v.acts.includes('사내완료'))out.push(await doHouse(j,r,i,c,v));
    if(v.acts.includes('사내수정'))out.push(await doHouseEdit(j,r,i,c,v));
    if(v.acts.includes('사내삭제'))out.push(await doHouseDel(v));
    if(v.acts.includes('발주'))out.push(await doOrder(j,r,i,c,v));
    if(v.acts.includes('발주수정'))out.push(await doOrderEdit(v));
    if(v.acts.includes('입고')||v.acts.includes('입고확정'))out.push(await doRecv(j,r,i,c,v));
    v.done=out.filter(Boolean).join(' · ');ok++;
    await refreshJob(job);
   }catch(e){v.fail=String(e.message||e).slice(0,160);ng++}
   render();
  }
 }
 try{MESDB.notify&&MESDB.notify(['order_lines','outsourcing_moves','design_results','part_cycles'])}catch(e){}
 try{window.MESMOVE&&MESMOVE.invalidate()}catch(e){}
 say(`엑셀 실적등록 끝 — 성공 ${ok}건${ng?` · 실패 ${ng}건 (확인 열 참고)`:''}`);
 try{window.MESPOP&&MESPOP.ok(`엑셀 실적등록: 성공 ${ok}건${ng?` · 실패 ${ng}건`:''}`,'처리 완료')}catch(e){}
 if(XL_WASALL){try{await A.restore()}catch(e){}}
}
async function refreshJob(job){
 ['order_lines','outsourcing_moves','v_outsourcing_position','design_results'].forEach(t=>{try{MESDB.dropCache&&MESDB.dropCache(t)}catch(e){}});
 await loadOrdered(job);await loadHouse(job);renderRoutes();
}
async function rateFor(v,c){
 let rt=v.wrate!=null&&v.wrate>0?Math.round(v.wrate):0;
 if(!rt){try{rt=Math.round((await MESDB.laborRateInfo('가공',[v.equip||'',c])).rate)||0}catch(e){}if(!rt)rt=30000}
 return rt;
}
/* 사내가공 완료등록 — ctxHouseSave 와 같은 행 */
async function doHouse(j,r,i,c,v){
 const m=Math.round(v.wmin),rt=await rateFor(v,c),cost=Math.round(m/60*rt);
 const row={work_type:'가공',job_no:j.job,part_no:r.part,process_code:r.jo||null,machining_process_code:c,machining_process_name:procName(c),
  equipment_code:v.equip||null,worker_name:v.worker||null,work_date:v.wdate||T(),work_minutes:m,headcount:1,hourly_rate:rt,labor_cost:cost};
 if(HOUSE_CYC)row.cycle_no=rowCyc(r);
 await MESDB.table('design_results').upsert(row,'row_no');
 return `사내완료 ${m}분 (${won(cost)}원)`;
}
/* 기존 사내실적 수정 — 시간·단가가 바뀌면 가공비 다시 계산 */
async function doHouseEdit(j,r,i,c,v){
 const e=v.cur,m=Math.round(v.wmin);
 const rt=v.wrate!=null&&v.wrate>0?Math.round(v.wrate):(houseRate(e)||await rateFor(v,c));
 const cost=Math.round(m/60*rt);
 await MESDB.table('design_results').update({row_no:Number(e.row_no)},{work_date:v.wdate||d10(e.work_date)||T(),work_minutes:m,hourly_rate:rt,labor_cost:cost,
  worker_name:v.worker||null,equipment_code:v.equip||null});
 return `사내실적 #${e.row_no} 수정 ${m}분 (${won(cost)}원)`;
}
async function doHouseDel(v){
 await MESDB.table('design_results').delete({row_no:Number(v.cur.row_no)});
 return `사내실적 #${v.cur.row_no} 삭제`;
}
/* 새 발주 — ctxOrderNow 와 같은 행 (dupCheck 포함) */
async function doOrder(j,r,i,c,v){
 const n=(r.steps||[]).map(stepCode).filter(Boolean).length;
 let price=v.price!=null&&v.price>=0?v.price:null;
 if(price==null&&window.MESPRICE){try{const hit=await MESPRICE.process(c,v.vendor,{asOf:v.odate});price=hit?hit.price:0}catch(e){price=0}}
 price=price||0;
 const row={no:1,vendor:v.vendor,job:j.job,item:j.item,proc:(r.jo||j.proc||'1'),procName:joName(r.jo||j.proc||'1',j.setQty||1),
  part:r.part,partName:r.name,sn:i+1,snOf:n,mp:c,mpName:procName(c),qty:v.oqty,odate:v.odate,rdate:v.rdate,remark:v.remark||'',writer:OWNER,price,amount:price*v.oqty,cyc:rowCyc(r),newCycle:false};
 if(stepState(r,i)!=='완료'){const bad=await dupCheck('외주가공',j.job,[row]);if(bad.length)throw new Error('발주 불가: '+[...new Set(bad)].join(', '))}
 await MESDB.newLines([{category:'외주가공',status:'발주',vendor_name:row.vendor,job_no:row.job,item_name:row.item||null,process_code:row.proc,process_name:row.procName,
  part_no:row.part,part_name:row.partName,machining_process_code:row.mp,machining_process_name:row.mpName||null,step_no:Number(row.sn)||null,order_qty:row.qty,
  unit_price:row.price||null,quote_price:row.amount||null,order_date:row.odate||null,required_date:row.rdate||null,owner_name:row.writer||null,remark:withCycleRemark(row.remark,''),
  cycle_no:Number(row.cyc)||cycNo(row.part),cycle_reason:(Number(row.cyc)||cycNo(row.part))===cycNo(row.part)?cycReason(row.part):null}]);
 await refreshJob(j.job);
 return `발주 ${v.vendor} ${v.oqty}개${price?` (${won(price*v.oqty)}원)`:' (단가 0)'}`;
}
/* 기존 발주건 수정 */
async function doOrderEdit(v){
 const p={...v.patch,updated_at:new Date().toISOString()};
 await MESDB.table('order_lines').update({line_id:Number(v.cur.line_id)},p);
 const what=Object.keys(v.patch).filter(k=>k!=='quote_price').map(k=>({vendor_name:'업체',order_qty:'수량',unit_price:'단가',order_date:'발주일',required_date:'입고요구일',remark:'비고'}[k]||k));
 return `발주#${v.cur.line_id} 수정 (${what.join('·')})`;
}
/* 입고 — fn_osp_receive. 기존 발주건 줄이면 그 발주건에, 새 발주 줄이면 방금 만든 발주건에 */
async function doRecv(j,r,i,c,v){
 const o=stepInfo(r,i);const ts=new Date().toISOString(),fix=[];let got=0;
 let targets;
 if(v.lid!=null)targets=(o.lines||[]).filter(x=>Number(x.line_id)===Number(v.lid));
 else targets=(o.openLines||[]).filter(x=>String(x.vendor_name||'')===v.vendor).sort((a,b)=>(Number(b.line_id)||0)-(Number(a.line_id)||0)).slice(0,1);   /* 방금 만든(가장 최근) 발주건 */
 if(!targets.length)throw new Error('입고할 발주건을 찾지 못했습니다 (발주가 반영되지 않았을 수 있음 — 새로고침 후 다시)');
 const l=targets[0];
 let left=Math.round(v.addQty||0);
 if(left>0){
  const rem=Math.max((Number(l.order_qty)||1)-(Number(l.receipt_qty)||0),0);
  if(left>rem)throw new Error(`입고수량 +${left} 이 미입고 잔량 ${rem} 을 넘습니다`);
  const res=await ospRpc('fn_osp_receive',{p_line_id:Number(l.line_id),p_qty:left,p_date:v.idate||T(),p_short:0,p_source:'엑셀등록',p_remark:v.remark||null});
  got=left;
  const oo=Array.isArray(res)?res[0]:res;const closed=(oo&&typeof oo.closed==='boolean')?oo.closed:(rem-left<=0);
  if(v.acts.includes('입고확정')&&closed)fix.push(l);
 }else if(v.acts.includes('입고확정'))fix.push(l);
 if(fix.length)await MESDB.table('order_lines').upsert(fix.map(x=>({line_id:Number(x.line_id),status:'입고확정',confirm_date:v.idate||T(),confirm_price:Number(x.quote_price)||null,nego_rate:0,updated_at:ts})),'line_id');
 return [got?`입고 +${got}개`:'',fix.length?`입고확정 #${l.line_id}`:''].filter(Boolean).join(' · ');
}

window.MESXLR={export:exportXl,load:loadXl,run,close,render};
})();
