/* mes_lookup.js — v1  공용 마스터 조회
 * 모든 화면이 거래처/사원/자재/부품/공정/설비/금형타입/기계사양/사업부/아이템을
 * 하드코딩 대신 DB 마스터에서 실시간 조회한다.
 *
 *   MESLOOK.open(kind, cb)            팝업. cb({code,name,raw})
 *   MESLOOK.bindPair(kind, codeId, nameId)   코드/명칭 input 쌍에 연결해 팝업 오픈
 *   MESLOOK.rows(kind [,filter])      Promise<마스터 행 배열> (캐시)
 *   MESLOOK.names(kind)               Promise<명칭 배열>
 *   MESLOOK.fillSelect(sel, kind, {value,label,keep,filter})  select 옵션 채우기
 *   MESLOOK.invalidate(kind)          캐시 무효화
 *
 * v60: 팝업 안에서 마스터를 직접 등록/수정/삭제한다(KINDS[kind].crud 가 있을 때).
 *      거래처(vendors) 계열은 기준정보 '업체 관리'와 같은 테이블을 보므로,
 *      팝업에서 바꾼 내용이 기준정보 화면에도 그대로 반영된다.
 * v68: 담당자(employee) 조회를 기준정보 '사용자정보'(users) 로 통일. employees(옛 샘플) 는 더 이상 보지 않는다.
 *      양산처(mass_production) 는 업체 관리에서 구분=양산처 로 등록한 업체만 조회.
 */
(function(){
if(window.MESLOOK)return;
const VER='68';   /* 팝업 제목 옆에 표시된다. 화면에 v68 이 안 보이면 옛 파일이 캐시된 것 */

/* ── v60 마스터 인라인 CRUD 정의 ───────────────────────────────────
 * crud 가 있는 kind 는 조회 팝업 하단에 [등록][수정][삭제][기준정보] 가 붙는다.
 * file/menu 는 권한 판정(MES_MENU_OF)과 기준정보 화면 열기에 쓴다. */
const VENDOR_FIELDS=[
 {col:'vendor_code',  label:'업체코드', req:1, pkf:1},
 {col:'vendor_name',  label:'업체명',   req:1},
 {col:'vendor_type',  label:'구분',     type:'select', opts:['고객사','협력업체','양산처']},
 {col:'location_type',label:'소재지',   type:'select', opts:['국내','해외']},
 {col:'ceo_name',     label:'대표자명'},
 {col:'phone',        label:'전화번호'},
 {col:'postal_code',  label:'우편번호'},
 {col:'fax',          label:'팩스'},
 {col:'partner_type', label:'협력업체구분'},
 {col:'remark',       label:'비고', wide:1},
 {col:'raw_material_flag', label:'원자재',   type:'check'},
 {col:'milling_flag',      label:'면삭',     type:'check'},
 {col:'purchase_item_flag',label:'구매품',   type:'check'},
 {col:'outsourcing_flag',  label:'외주가공', type:'check'},
];
/* 신규 등록 시 kind 별 기본값 — 어느 팝업에서 등록해도 그 목록에 바로 보이도록 */
const VENDOR_DEFAULTS={
 vendor:            {vendor_type:'협력업체'},
 customer:          {vendor_type:'고객사'},
 mass_production:   {vendor_type:'양산처'},
 vendor_purchase:   {vendor_type:'협력업체', purchase_item_flag:true},
 vendor_material:   {vendor_type:'협력업체', raw_material_flag:true},
 vendor_outsourcing:{vendor_type:'협력업체', outsourcing_flag:true},
};
const VENDOR_CRUD={
 table:'vendors', pk:'vendor_code', label:'업체',
 file:'vendor_management.html', menu:'업체관리', menuLabel:'업체 관리',
 fields:VENDOR_FIELDS,
 defaults:kind=>({location_type:'국내', ...(VENDOR_DEFAULTS[kind]||{})}),
 /* V001, V002 … 비어 있는 다음 번호 */
 nextCode:rs=>{let m=0;for(const r of rs){const g=/^V(\d+)$/.exec(String(r.vendor_code||''));
   if(g)m=Math.max(m,Number(g[1]))}return 'V'+String(m+1).padStart(3,'0')},
};

const KINDS={
 vendor:   {title:'거래처 조회',    table:'vendors', order:'vendor_code',
            cols:['코드','거래처명','구분'], map:r=>[r.vendor_code,r.vendor_name,r.vendor_type||''], crud:VENDOR_CRUD},
 /* v42: 구분(vendor_type)대로만 목록에 나온다. 고객사엔 고객사만, 양산처엔 협력업체만. */
 customer: {title:'고객사 조회',    table:'vendors', order:'vendor_code',
            cols:['코드','고객사명'], map:r=>[r.vendor_code,r.vendor_name],
            filter:r=>r.vendor_type==='고객사',
            /* v60: 구분이 비어 있는 업체만 있으면 0건이 되어 고객사를 못 고른다 → 전체 표시로 대체 */
            fallback:r=>true, crud:VENDOR_CRUD},
 /* v68: 기준정보 '업체 관리' 에서 구분=양산처 로 등록한 업체만 나온다.
    아직 양산처가 한 곳도 없으면 고객사 목록으로 대체 (0건 방지). */
 mass_production:{title:'양산처 조회', table:'vendors', order:'vendor_code',
            cols:['코드','양산처명','구분'], map:r=>[r.vendor_code,r.vendor_name,r.vendor_type||''],
            filter:r=>r.vendor_type==='양산처',
            fallback:r=>r.vendor_type==='고객사', crud:VENDOR_CRUD},
 vendor_purchase:{title:'협력업체(구매품)', table:'vendors', order:'vendor_name',
            cols:['코드','업체명'], map:r=>[r.vendor_code,r.vendor_name], filter:r=>r.vendor_type==='협력업체'&&r.purchase_item_flag===true,
            fallback:r=>r.vendor_type==='협력업체', crud:VENDOR_CRUD},
 vendor_material:{title:'협력업체(원재료)', table:'vendors', order:'vendor_name',
            cols:['코드','업체명'], map:r=>[r.vendor_code,r.vendor_name], filter:r=>r.vendor_type==='협력업체'&&r.raw_material_flag===true,
            fallback:r=>r.vendor_type==='협력업체', crud:VENDOR_CRUD},
 vendor_outsourcing:{title:'협력업체(외주가공)', table:'vendors', order:'vendor_name',
            cols:['코드','업체명'], map:r=>[r.vendor_code,r.vendor_name], filter:r=>r.vendor_type==='협력업체'&&r.outsourcing_flag===true,
            fallback:r=>r.vendor_type==='협력업체', crud:VENDOR_CRUD},
 design_partner:{title:'협력업체(외주설계)', table:'outsourced_design_partners', order:'seq',
            cols:['No','업체명'], map:r=>[r.seq,r.partner_name], code:r=>r.partner_name, name:r=>r.partner_name},
 /* v68: 기준정보 '사용자정보'(users) 에서 조회한다.
    코드 = 아이디(user_id). 시스템 계정(hcsmart) 제외.
    사용여부 해제(is_active=false) 는 '사용중만' 체크로 숨긴다. */
 employee: {title:'담당자 조회',    table:'users', order:'name',
            cols:['아이디','성명','부서'],
            map:r=>[r.user_id||r.user_key||'', r.name||'', r.department_name||''],
            code:r=>r.user_id||r.user_key||'', name:r=>r.name||'',
            /* 사용자정보에서 사용여부 ✔ 인 실제 계정만. 아이디 없는 행·사용여부 미설정 행(데모 잔재) 은 제외 */
            filter:r=>!!(r.name&&String(r.name).trim())&&!!r.user_id&&r.is_active===true&&String(r.user_id)!=='hcsmart',
            activeKey:r=>r.is_active===true},
 material: {title:'자재 조회',      table:'materials', order:'material_code',
            cols:['자재코드','자재명','그룹'], map:r=>[r.material_code,r.material_name||'',r.material_group||'']},
 part:     {title:'부품 조회',      table:'parts', order:'part_code',
            cols:['부품코드','부품명','그룹'], map:r=>[r.part_code,r.part_name||'',r.part_group||'']},
 process:  {title:'공정 조회',      table:'processes', order:'process_group,sort_order,process_code',
            cols:['공정코드','공정명','그룹','순서'], map:r=>[r.process_code,r.process_name,r.process_group||'',r.sort_order??'']},
 equip:    {title:'설비(작업장) 조회', table:'equipment', order:'equipment_code',
            cols:['설비코드','설비명','그룹','사용'], map:r=>[r.equipment_code,r.equipment_name,r.equipment_group||'',r.is_active===false?'N':'Y'],
            activeKey:r=>r.is_active!==false},
 mold:     {title:'금형타입 조회',  table:'mold_types', order:'mold_type_code',
            cols:['코드','금형타입명'], map:r=>[r.mold_type_code,r.mold_type_name]},
 mspec:    {title:'기계사양 조회',  table:'machine_specs', order:'machine_spec_code',
            cols:['코드','기계사양명'], map:r=>[r.machine_spec_code,r.machine_spec_name]},
 biz:      {title:'사업부 조회',    table:'business_divisions', order:'business_division_code',
            cols:['코드','사업부명'], map:r=>[r.business_division_code,r.business_division_name]},
 item:     {title:'아이템 조회',    table:'item_categories', order:'item_code',
            cols:['코드','아이템명'], map:r=>[r.item_code,r.item_name]},
 inspection_category:{title:'검사구분 조회', table:'inspection_categories', order:'sort_order,inspection_category_code',
            cols:['코드','검사구분명','대상'], map:r=>[r.inspection_category_code,r.inspection_category_name,r.inspection_target||''],
            activeKey:r=>r.is_active!==false},
 inspection_item:{title:'검사항목 조회', table:'inspection_items', order:'inspection_item_code',
            cols:['코드','검사항목명','그룹'], map:r=>[r.inspection_item_code,r.inspection_item_name,r.inspection_group||''],
            activeKey:r=>r.is_active!==false},
 job:      {title:'제번(수주) 조회', table:'set_order_job_pool', order:'row_no',
            cols:['제번','품명','고객사','수주유형','Try-Out 예정일'],
            map:r=>[r.job_no,r.item_name||'',r.customer_name||'',r.order_type||'',r.s1_date||''],
            code:r=>r.job_no, name:r=>r.item_name||''},
};

const CACHE={};
const online=()=>{try{return !!(window.MESDB&&window.MESDB.online)}catch(e){return false}};

async function rows(kind,extraFilter){
 const K=KINDS[kind]; if(!K)throw new Error('unknown lookup: '+kind);
 if(!online()&&window.MESDB&&MESDB.ready){try{await MESDB.ready}catch(e){}}
 if(!online())throw new Error('DB 미연결');
 if(!CACHE[kind])CACHE[kind]=await MESDB.table(K.table).select('select=*&order='+K.order);
 let out=CACHE[kind];
 if(K.filter){
  const f=out.filter(K.filter);
  /* v26: 마스터 구분 플래그가 비어 있어 결과가 0건이면 대체 기준으로 표시한다.
     (플래그 미입력 때문에 협력업체 목록이 통째로 비는 사고 방지) */
  out=f.length?f:(K.fallback?out.filter(K.fallback):f);
 }
 if(extraFilter)out=out.filter(extraFilter);
 return out;
}
const names=async kind=>{const K=KINDS[kind];return (await rows(kind)).map(r=>(K.name?K.name(r):K.map(r)[1])||K.map(r)[0])};
const invalidate=kind=>{if(kind)delete CACHE[kind];else for(const k in CACHE)delete CACHE[k]};

async function fillSelect(sel,kind,opt={}){
 if(typeof sel==='string')sel=document.getElementById(sel);
 if(!sel)return;
 const K=KINDS[kind];
 let rs; try{rs=await rows(kind,opt.filter)}catch(e){return}
 const keep=opt.keep??['ALL','전체'];
 const head=[...sel.options].filter(o=>keep.includes(o.textContent.trim())).map(o=>o.outerHTML).join('');
 sel.innerHTML=head+rs.map(r=>{
  const v=opt.value?opt.value(r):(K.code?K.code(r):K.map(r)[0]);
  const l=opt.label?opt.label(r):(K.name?K.name(r):K.map(r)[1])||v;
  return `<option value="${esc(v)}">${esc(l)}</option>`}).join('');
}

/* ── 팝업 UI ─────────────────────────────────────────── */
const css=`
#meslk-mask{position:fixed;inset:0;background:rgba(20,28,35,.38);z-index:9500;display:none;align-items:center;justify-content:center;font:12px 'Malgun Gothic',맑은 고딕,sans-serif}
#meslk-mask.on{display:flex}
#meslk{width:540px;min-width:340px;max-width:94vw;max-height:78vh;background:#fff;border:1px solid #7f8f9c;box-shadow:0 6px 24px rgba(0,0,0,.3);display:flex;flex-direction:column;color:#22303a}
#meslk .hd{height:30px;display:flex;align-items:center;padding:0 6px 0 12px;color:#fff;background:linear-gradient(#5f7f9f,#3f5f7d);font-weight:700}
#meslk .hd .ver{margin-left:8px;font-weight:400;font-size:11px;opacity:.72}
#meslk .x{margin-left:auto;width:24px;height:22px;border:0;background:transparent;color:#fff;cursor:pointer;font:inherit}
#meslk .bar{display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid #dde3e8;background:#f5f7f9}
#meslk .bar input[type=text]{flex:1;height:24px;border:1px solid #b9c3cb;padding:0 6px;font:inherit}
#meslk .bar label{white-space:nowrap;color:#4d5c69}
#meslk .cnt{color:#6d7b88;white-space:nowrap}
#meslk .bd{flex:1;overflow:auto;min-height:150px}
/* v40: 열폭을 글자 기준으로 산출해 <col> 로 지정한다 (기존 width:100% 균등분배 → 코드열이 과하게 넓어짐) */
#meslk table{width:100%;border-collapse:collapse;table-layout:fixed}
#meslk th{position:sticky;top:0;background:linear-gradient(#e9eef3,#f5f7f9);border-bottom:1px solid #c3ccd4;height:24px;padding:0 7px;text-align:left;font-weight:700}
#meslk td{height:23px;border-bottom:1px solid #e7ecf0;padding:0 7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#meslk th{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#meslk tbody tr:hover td{background:#edf6fd;cursor:pointer}
#meslk tbody tr.sel td{background:#2d75b7;color:#fff}
/* v60.1 푸터 2줄: 윗줄=마스터 관리(등록/수정/삭제/기준정보), 아랫줄=조회 동작(지우기/선택/닫기)
   한 줄에 7개를 넣으면 창이 좁을 때 '업체 관리 ↗' 글자가 줄바꿈돼 버튼이 찌그러진다. */
#meslk .ft{background:#f7f9fa;border-top:1px solid #e3e9ed}
#meslk .ftrow{display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding:7px 10px}
#meslk .ftrow.crudrow{justify-content:flex-start;background:#eef3f7;border-bottom:1px solid #dde5ea}
#meslk .ftrow.crudrow.off{display:none}
#meslk .ftrow.pickrow{justify-content:flex-end}
#meslk .ft .btn{white-space:nowrap}
#meslk .btn{height:26px;min-width:64px;border:1px solid #9ba8b4;background:linear-gradient(#fff,#dfe6eb);cursor:pointer;font:inherit}
#meslk .btn:hover{background:#fff}
#meslk .btn:disabled{opacity:.45;cursor:default}
/* v60 인라인 CRUD */
#meslk .btn.ghost{color:#2c6ca8;border-color:#9cb5cb;background:linear-gradient(#fff,#eaf2f8)}
/* 창 높이(78vh)를 넘지 않도록: 편집 패널은 필요하면 스스로 줄어들고 안에서 스크롤된다 */
#meslk .ed{display:none;border-top:1px solid #cfd9e0;background:#f8fafc;flex:0 1 auto;max-height:44vh;overflow:auto}
#meslk .ed.on{display:block}
#meslk.editing .bd{flex:1 1 0;min-height:64px}
#meslk .hd,#meslk .bar,#meslk .ft{flex:0 0 auto}
#meslk .edhd{padding:6px 10px;font-weight:700;color:#37506a;background:#eaf1f7;border-bottom:1px solid #dbe3ea}
#meslk .edgrid{display:grid;grid-template-columns:78px minmax(0,1fr) 78px minmax(0,1fr);gap:5px 7px;padding:8px 10px;align-items:center}
#meslk .edgrid>label{font-weight:700;text-align:right;color:#4d5c69;white-space:nowrap}
#meslk .edgrid input[type=text],#meslk .edgrid select{width:100%;min-width:0;height:24px;border:1px solid #b9c3cb;padding:0 5px;font:inherit;box-sizing:border-box}
#meslk .edgrid input[readonly]{background:#eef2f5;color:#5a6b78}
#meslk .edgrid .wide{grid-column:2 / -1}
#meslk .flags{grid-column:2 / -1;display:flex;flex-wrap:wrap;gap:4px 14px}
#meslk .flags label{font-weight:400;white-space:nowrap}
#meslk .edft{display:flex;align-items:center;gap:6px;padding:7px 10px;border-top:1px solid #e0e7ec;background:#f2f6f8}
#meslk .edft .err{flex:1;color:#c62828;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media(max-width:620px){#meslk .edgrid{grid-template-columns:78px minmax(0,1fr)}#meslk .edgrid .wide,#meslk .flags{grid-column:1 / -1}}`;

const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let ui=null,curKind=null,curCb=null,sel=-1,edMode=null;

function ensure(){
 if(ui)return ui;
 const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
 ui=document.createElement('div');ui.id='meslk-mask';
 ui.innerHTML=`<div id="meslk">
  <div class="hd"><span id="meslk-title"></span><span class="ver">v${VER}</span><button class="x">✕</button></div>
  <div class="bar"><input type="text" id="meslk-q" placeholder="코드 / 명칭 검색">
   <label id="meslk-aw"><input type="checkbox" id="meslk-a" checked>사용중만</label>
   <span class="cnt" id="meslk-c"></span></div>
  <div class="bd"><table id="meslk-t"></table></div>
  <div class="ed" id="meslk-ed">
   <div class="edhd" id="meslk-edt"></div>
   <div class="edgrid" id="meslk-edg"></div>
   <div class="edft"><span class="err" id="meslk-ede"></span>
    <button class="btn" id="meslk-edsave">▣ 저장</button>
    <button class="btn" id="meslk-edcancel">취소</button></div>
  </div>
  <div class="ft">
   <div class="ftrow crudrow off" id="meslk-crudrow">
    <button class="btn" id="meslk-new">＋ 등록</button>
    <button class="btn" id="meslk-mod">✎ 수정</button>
    <button class="btn" id="meslk-rm">✕ 삭제</button>
    <button class="btn ghost" id="meslk-mst" title="기준정보 화면에서 전체 목록을 관리합니다.">기준정보 ↗</button>
   </div>
   <div class="ftrow pickrow">
    <button class="btn" id="meslk-clear">지우기</button>
    <button class="btn" id="meslk-ok">선택</button>
    <button class="btn" id="meslk-close">닫기</button>
   </div></div></div>`;
 document.body.appendChild(ui);
 ui.querySelector('.x').onclick=close;
 ui.querySelector('#meslk-close').onclick=close;
 ui.querySelector('#meslk-ok').onclick=confirmPick;
 ui.querySelector('#meslk-clear').onclick=()=>{done({code:'',name:'',raw:null})};
 ui.querySelector('#meslk-q').oninput=renderList;
 ui.querySelector('#meslk-a').onchange=renderList;
 ui.querySelector('#meslk-new').onclick=()=>edOpen('new');
 ui.querySelector('#meslk-mod').onclick=()=>edOpen('edit');
 ui.querySelector('#meslk-rm').onclick=crudRemove;
 ui.querySelector('#meslk-mst').onclick=openMaster;
 ui.querySelector('#meslk-edsave').onclick=edSave;
 ui.querySelector('#meslk-edcancel').onclick=edClose;
 ui.addEventListener('click',e=>{if(e.target===ui)close()});
 document.addEventListener('keydown',e=>{
  if(!curKind)return;
  /* v60: 편집 패널이 열려 있으면 Esc=편집취소, Enter=편집저장 */
  if(edMode){
   if(e.key==='Escape'){e.preventDefault();e.stopPropagation();edClose()}
   else if(e.key==='Enter'&&e.target&&e.target.tagName!=='TEXTAREA'){e.preventDefault();edSave()}
   return;
  }
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close()}
  else if(e.key==='Enter'){e.preventDefault();confirmPick()}
 },true);
 return ui;
}
function close(){if(ui){edClose();ui.classList.remove('on')}curKind=null;curCb=null}
function done(v){const cb=curCb;close();cb&&cb(v)}
function filtered(){
 const K=KINDS[curKind],q=ui.querySelector('#meslk-q').value.trim().toLowerCase();
 const onlyA=K.activeKey&&ui.querySelector('#meslk-a').checked;
 /* v68: 팝업도 rows() 와 같은 규칙 — 구분 필터 결과가 0건이면 fallback 기준으로 표시 */
 const all=CACHE[curKind]||[];
 let base=K.filter?all.filter(K.filter):all;
 if(K.filter&&!base.length&&K.fallback)base=all.filter(K.fallback);
 return base.filter(r=>(!onlyA||K.activeKey(r))
  &&(!q||K.map(r).some(v=>String(v).toLowerCase().includes(q))));
}
/* ── v40: 글자 기준 열폭 자동 산출 ──────────────────────
 * 헤더와 데이터의 실제 렌더 폭을 재서 열마다 필요한 만큼만 준다.
 * canvas measureText 를 쓰고, 사용할 수 없으면 문자 기반(한글 2배)으로 추정한다. */
const CELL_PAD=16, COL_MIN=54, COL_MAX=340, SAMPLE=400;
let _mctx=null;
function textPx(t,bold){
 t=String(t??'');
 if(_mctx===null){
  try{const c=document.createElement('canvas');_mctx=c.getContext('2d')||false}catch(e){_mctx=false}
 }
 if(_mctx){
  _mctx.font=(bold?'700 ':'')+"12px 'Malgun Gothic','맑은 고딕',sans-serif";
  const m=_mctx.measureText(t);
  if(m&&m.width)return m.width;
 }
 /* fallback: 한글·전각 2배 */
 let u=0;
 for(const ch of t)u+=/[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF\u4E00-\u9FFF\uFF00-\uFFEF]/.test(ch)?2:1;
 return u*6.4;
}
function colWidths(K,rs){
 const n=K.cols.length, w=K.cols.map(c=>textPx(c,true)+CELL_PAD);
 const lim=Math.min(rs.length,SAMPLE);
 for(let i=0;i<lim;i++){
  const v=K.map(rs[i]);
  for(let c=0;c<n;c++){const p=textPx(v[c])+CELL_PAD;if(p>w[c])w[c]=p}
 }
 return w.map(x=>Math.round(Math.max(COL_MIN,Math.min(COL_MAX,x))));
}
function applySize(K,rs){
 const w=colWidths(K,rs);
 const box=ui.querySelector('#meslk');
 const bd=ui.querySelector('#meslk .bd');
 /* 세로 스크롤바 여유 + 테두리 */
 const need=w.reduce((a,b)=>a+b,0)+18;
 const vw=(window.innerWidth||1024);
 const floor=Math.min(K.crud?400:340,Math.round(vw*0.94));   /* 관리 버튼 4개가 한 줄에 들어갈 최소폭 */
 const target=edMode?(parseInt(box.style.width,10)||Math.max(floor,Math.min(need,Math.round(vw*0.94))))
                    :Math.max(floor,Math.min(need,Math.round(vw*0.94)));
 box.style.width=target+'px';
 const avail=target-18;
 let sum=w.reduce((a,b)=>a+b,0);
 if(sum>avail){
  /* 창이 좁으면 넓은 열부터 비례로 줄여 가로 스크롤을 없앤다.
     (마지막 열만 줄이면 열이 많을 때 초과분을 다 흡수하지 못한다) */
  for(let pass=0;pass<4&&sum>avail;pass++){
   const over=sum-avail;
   const room=w.map(x=>Math.max(0,x-COL_MIN));
   const roomSum=room.reduce((a,b)=>a+b,0);
   if(roomSum<=0)break;
   const cut=Math.min(over,roomSum);
   for(let i=0;i<w.length;i++)w[i]=Math.round(w[i]-cut*(room[i]/roomSum));
   sum=w.reduce((a,b)=>a+b,0);
  }
  /* 반올림 오차 보정 */
  let diff=sum-avail;
  for(let i=w.length-1;i>=0&&diff>0;i--){
   const c=Math.min(diff,w[i]-COL_MIN);
   if(c>0){w[i]-=c;diff-=c}
  }
 }else if(sum<avail){
  w[w.length-1]+=avail-sum;   /* 남는 폭은 마지막 열이 흡수 */
 }
 const total=w.reduce((a,b)=>a+b,0);
 /* table-layout:fixed + width:100% 는 잔여폭을 열에 균등 재분배한다.
    산출한 폭이 그대로 적용되도록 테이블 폭을 px 로 못박는다. */
 const tb=ui.querySelector('#meslk-t');
 tb.style.width=total+'px';
 tb.style.minWidth=total+'px';
 bd.style.overflowX=(total>avail)?'auto':'hidden';
 return w;
}
function bindRows(){
 sel=-1;
 ui.querySelectorAll('#meslk-t tbody tr[data-i]').forEach(tr=>{
  tr.onclick=()=>{sel=+tr.dataset.i;ui.querySelectorAll('#meslk-t tbody tr').forEach(x=>x.classList.remove('sel'));tr.classList.add('sel')};
  tr.ondblclick=()=>{sel=+tr.dataset.i;confirmPick()};
 });
}
/* v41: 폭 계산 등에서 예외가 나도 목록은 반드시 보이도록 안전망을 둔다 */
function renderList(){
 try{renderList_()}catch(e){
  console.warn('MESLOOK render',e&&e.message);
  try{
   const K=KINDS[curKind],rs=filtered();
   const box=ui.querySelector('#meslk');if(box)box.style.width='';
   const tb=ui.querySelector('#meslk-t');tb.style.width='';tb.style.minWidth='';
   tb.innerHTML='<thead><tr>'+K.cols.map(c=>`<th>${esc(c)}</th>`).join('')+'</tr></thead><tbody>'+
    rs.map((r,i)=>`<tr data-i="${i}">`+K.map(r).map(v=>`<td>${esc(v)}</td>`).join('')+'</tr>').join('')+'</tbody>';
   ui.querySelector('#meslk-c').textContent=rs.length+'건';
   bindRows();
  }catch(e2){}
 }
}
function renderList_(){
 if(!curKind)return;
 const K=KINDS[curKind],rs=filtered();
 const w=applySize(K,rs);
 ui.querySelector('#meslk-t').innerHTML=
  '<colgroup>'+w.map(x=>`<col style="width:${x}px">`).join('')+'</colgroup>'+
  '<thead><tr>'+K.cols.map((c,i)=>`<th title="${esc(c)}">${esc(c)}</th>`).join('')+'</tr></thead><tbody>'+
  (rs.length?rs.map((r,i)=>`<tr data-i="${i}">`+K.map(r).map(v=>`<td title="${esc(v)}">${esc(v)}</td>`).join('')+'</tr>').join('')
   :`<tr><td colspan="${K.cols.length}" style="height:56px;text-align:center;color:#8a97a2">검색결과가 없습니다.</td></tr>`)
  +'</tbody>';
 ui.querySelector('#meslk-c').textContent=rs.length+'건';
 bindRows();
}
function confirmPick(){
 if(sel<0)return;
 const K=KINDS[curKind],r=filtered()[sel];if(!r)return;
 const v=K.map(r);
 done({code:K.code?K.code(r):v[0], name:K.name?K.name(r):(v[1]||v[0]), raw:r});
}

/* ── v60 마스터 인라인 등록/수정/삭제 ─────────────────────────────
 * 기준정보(업체 관리)와 같은 테이블(vendors)을 직접 쓰기 때문에
 * 팝업에서 등록한 업체는 기준정보 화면에도 그대로 나타난다. */
function authObj(){try{return window.MES_AUTH||window.parent.MES_AUTH||null}catch(e){return null}}
function menuPath(C){try{return window.parent.MES_MENU_OF?.(C.file)||null}catch(e){return null}}
function allow(C,right){
 const a=authObj();
 if(!a||!a.can||!a.session)return true;                 /* 로그인 정보가 없으면 막지 않는다 */
 if(a.role==='master'||a.role==='admin')return true;
 const p=menuPath(C); return p?a.can(p,right):true;      /* 권한은 기준정보 '업체 관리' 기준 */
}
function crudSetup(){
 const K=KINDS[curKind],C=K&&K.crud,box=ui.querySelector('#meslk-crudrow');
 box.classList.toggle('off',!C);
 if(!C)return;
 const canS=allow(C,'save'), canD=allow(C,'delete');
 const btn=(id,ok,tip)=>{const b=ui.querySelector(id);b.disabled=!ok;b.title=ok?tip:'권한이 없습니다'};
 btn('#meslk-new',canS,`${C.label} 정보를 새로 등록합니다.`);
 btn('#meslk-mod',canS,`목록에서 선택한 ${C.label}를 수정합니다.`);
 btn('#meslk-rm', canD,`목록에서 선택한 ${C.label}를 삭제합니다.`);
 ui.querySelector('#meslk-mst').textContent=(C.menuLabel||'기준정보')+' ↗';
}
function openMaster(){
 const C=KINDS[curKind]?.crud; if(!C)return;
 try{
  const w=window.parent;
  if(w&&w!==window&&typeof w.openByName==='function'){w.openByName(C.menu);close();return}
 }catch(e){}
 window.open(C.file,'_blank');
}
function edErr(t){ui.querySelector('#meslk-ede').textContent=t||''}
function edClose(){
 edMode=null;
 if(!ui)return;
 ui.querySelector('#meslk-ed').classList.remove('on');
 const box=ui.querySelector('#meslk');
 box.classList.remove('editing');
 if(box.dataset.w!==undefined){box.style.width=box.dataset.w;delete box.dataset.w}
 edErr('');
}
function edOpen(mode){
 const K=KINDS[curKind],C=K&&K.crud; if(!C)return;
 let row;
 if(mode==='edit'){
  row=filtered()[sel];
  if(!row)return edFlash(`수정할 ${C.label}를 목록에서 선택하세요.`);
  row={...row};
 }else{
  row={...(C.defaults?C.defaults(curKind):{})};
  if(C.nextCode&&!row[C.pk])row[C.pk]=C.nextCode(CACHE[curKind]||[]);
 }
 edMode=mode;
 /* 조회 열이 적으면 창이 좁게 잡혀 있어 입력폼이 눌린다 → 편집 중에는 넓혀 준다 */
 const box=ui.querySelector('#meslk');
 if(box.dataset.w===undefined)box.dataset.w=box.style.width||'';
 const want=Math.min(660,Math.round((window.innerWidth||1024)*0.94));
 if((parseInt(box.style.width,10)||0)<want)box.style.width=want+'px';
 ui.querySelector('#meslk-edt').textContent=(mode==='new'?`${C.label} 등록`:`${C.label} 수정 — ${row[C.pk]}`);
 const plain=C.fields.filter(f=>f.type!=='check'), checks=C.fields.filter(f=>f.type==='check');
 let h='';
 for(const f of plain){
  const id='meslk-f-'+f.col, v=row[f.col]??'';
  const ro=(mode==='edit'&&f.pkf)?' readonly':'';
  const cell=f.wide?' class="wide"':'';
  h+=`<label for="${id}">${esc(f.label)}${f.req?' *':''}</label>`;
  h+=f.type==='select'
   ? `<div${cell}><select id="${id}">${['',...f.opts].map(o=>`<option${String(v)===o?' selected':''}>${esc(o)}</option>`).join('')}</select></div>`
   : `<div${cell}><input type="text" id="${id}" value="${esc(v)}"${ro}></div>`;
 }
 if(checks.length){
  h+=`<label>거래유형</label><div class="flags">`+
   checks.map(f=>`<label><input type="checkbox" id="meslk-f-${f.col}"${row[f.col]===true?' checked':''}> ${esc(f.label)}</label>`).join('')+`</div>`;
 }
 ui.querySelector('#meslk-edg').innerHTML=h;
 ui.querySelector('#meslk-ed').classList.add('on');
 ui.querySelector('#meslk').classList.add('editing');
 edErr('');
 const first=ui.querySelector(mode==='edit'?'#meslk-f-'+C.fields.find(f=>!f.pkf&&f.type!=='check').col:'#meslk-f-'+C.pk);
 first&&first.focus();
}
/* 안내문을 건수 자리에 잠깐 띄운다. 복원값은 항상 실제 건수 (연속 호출 시 문구가 굳지 않도록) */
let flashT=null;
function edFlash(t){
 const c=ui.querySelector('#meslk-c');
 clearTimeout(flashT);
 c.textContent=t;c.style.color='#c62828';
 flashT=setTimeout(()=>{try{c.textContent=(curKind?filtered().length:0)+'건'}catch(e){c.textContent=''}c.style.color=''},2800);
}
async function edSave(){
 const K=KINDS[curKind],C=K&&K.crud; if(!C||!edMode)return;
 if(!online())return edErr('DB 미연결 — 저장할 수 없습니다.');
 const row={};
 for(const f of C.fields){
  const el=document.getElementById('meslk-f-'+f.col); if(!el)continue;
  row[f.col]=(f.type==='check')?!!el.checked:(String(el.value||'').trim()||null);
 }
 for(const f of C.fields)if(f.req&&!row[f.col])return edErr(`${f.label}은(는) 필수입니다.`);
 const key=row[C.pk];
 if(edMode==='new'&&(CACHE[curKind]||[]).some(r=>String(r[C.pk])===String(key)))
  return edErr(`${key} 은(는) 이미 등록된 ${C.label}코드입니다.`);
 const btn=ui.querySelector('#meslk-edsave');btn.disabled=true;edErr('저장 중…');
 try{
  await MESDB.table(C.table).upsert(row,C.pk);
 }catch(e){btn.disabled=false;return edErr('저장 실패: '+String(e.message||e).slice(0,90))}
 btn.disabled=false;edClose();
 await crudRefresh(C,key);
 edFlash(`${key} ${C.label}를 ${edMode==='new'?'등록':'수정'}했습니다.`);
}
async function crudRemove(){
 const K=KINDS[curKind],C=K&&K.crud; if(!C)return;
 if(!online())return edFlash('DB 미연결 — 삭제할 수 없습니다.');
 const r=filtered()[sel];
 if(!r)return edFlash(`삭제할 ${C.label}를 목록에서 선택하세요.`);
 const key=r[C.pk], nm=K.map(r)[1]||'';
 if(!confirm(`${key} ${nm}\n${C.label} 정보를 삭제할까요?\n(기준정보 '${C.menuLabel}' 목록에서도 사라집니다)`))return;
 try{
  await MESDB.table(C.table).delete({[C.pk]:key});
 }catch(e){
  const m=String(e.message||e);
  return edFlash(/foreign key|violates/i.test(m)
   ? `${key} 은(는) 수주·발주 등에서 사용 중이라 삭제할 수 없습니다.`
   : '삭제 실패: '+m.slice(0,90));
 }
 await crudRefresh(C,null);
 edFlash(`${key} ${C.label}를 삭제했습니다.`);
}
/* 같은 테이블을 보는 모든 kind 캐시를 버리고 다시 읽는다 + 다른 화면에 통지 */
async function crudRefresh(C,keepKey){
 for(const k in KINDS)if(KINDS[k].table===C.table)delete CACHE[k];
 try{await rows(curKind)}catch(e){}
 renderList();
 if(keepKey){
  const i=filtered().findIndex(r=>String(r[C.pk])===String(keepKey));
  if(i>=0){const tr=ui.querySelector(`#meslk-t tbody tr[data-i="${i}"]`);
   if(tr){sel=i;ui.querySelectorAll('#meslk-t tbody tr').forEach(x=>x.classList.remove('sel'));
    tr.classList.add('sel');try{tr.scrollIntoView({block:'nearest'})}catch(e){}}}
 }
 try{window.MESDB&&MESDB.notify&&MESDB.notify([C.table])}catch(e){}
}
/* 다른 화면(기준정보 등)에서 마스터가 바뀌면 캐시를 버린다 */
try{
 const host=(window.parent&&window.parent!==window)?window.parent:window;
 host.addEventListener('mes-data-changed',e=>{
  const t=(e.detail&&e.detail.tables)||[];
  let hit=false;
  for(const k in KINDS)if(t.includes(KINDS[k].table)){delete CACHE[k];hit=true}
  if(hit&&curKind&&t.includes(KINDS[curKind].table)&&!edMode)
   rows(curKind).then(()=>{if(curKind)renderList()}).catch(()=>{});
 });
}catch(e){}

async function open(kind,cb){
 const K=KINDS[kind];if(!K){console.warn('MESLOOK: unknown',kind);return}
 /* v41: 예전에는 여기서 online() 을 즉시 판정하고 그냥 return 했다.
    mes_lookup.js 는 mes_db.js 보다 먼저 로드되고 연결 확인(ping)은 비동기라,
    연결이 끝나기 전에 버튼을 누르면 팝업이 조용히 열리지 않았다.
    → 창을 먼저 띄우고 그 안에서 연결을 기다린다. */
 ensure();curKind=kind;curCb=cb;sel=-1;
 ui.querySelector('#meslk-title').textContent=K.title;
 ui.querySelector('#meslk-q').value='';
 ui.querySelector('#meslk-a').checked=true;
 ui.querySelector('#meslk-aw').style.display=K.activeKey?'':'none';
 edClose();crudSetup();
 ui.classList.add('on');
 if(!online()){
  ui.querySelector('#meslk-t').innerHTML='<tbody><tr><td style="height:56px;text-align:center;color:#8a97a2">연결 확인 중…</td></tr></tbody>';
  for(let i=0;i<60&&!window.MESDB;i++)await new Promise(r=>setTimeout(r,50));
  if(window.MESDB&&window.MESDB.ready){try{await window.MESDB.ready}catch(e){}}
  if(!online()&&window.MESDB&&window.MESDB.ping){try{await window.MESDB.ping()}catch(e){}}
  if(curKind!==kind)return;            /* 대기 중 사용자가 닫았으면 중단 */
  if(!online()){
   ui.querySelector('#meslk-t').innerHTML='<tbody><tr><td style="height:56px;text-align:center;color:#c62828">DB에 연결할 수 없어 마스터를 조회하지 못했습니다.<br>새로고침 후 다시 시도하세요.</td></tr></tbody>';
   const m=document.getElementById('message');if(m)m.textContent='DB 미연결 — 마스터를 조회할 수 없습니다.';
   return;
  }
 }
 if(!CACHE[kind]){
  ui.querySelector('#meslk-t').innerHTML='<tbody><tr><td style="height:56px;text-align:center;color:#8a97a2">불러오는 중…</td></tr></tbody>';
  try{await rows(kind)}catch(e){
   ui.querySelector('#meslk-t').innerHTML=`<tbody><tr><td style="height:56px;text-align:center;color:#c62828">조회 실패: ${esc(String(e.message||e).slice(0,80))}</td></tr></tbody>`;
   return;
  }
 }
 renderList();
 ui.querySelector('#meslk-q').focus();
}
function bindPair(kind,codeId,nameId){
 open(kind,v=>{
  const c=document.getElementById(codeId),n=document.getElementById(nameId);
  if(c){c.value=v.code;c.dispatchEvent(new Event('input',{bubbles:true}));c.dispatchEvent(new Event('change',{bubbles:true}))}
  if(n){n.value=v.name;n.dispatchEvent(new Event('input',{bubbles:true}))}
 });
}
window.MESLOOK={open,bindPair,rows,names,fillSelect,invalidate,KINDS,VER};
})();
