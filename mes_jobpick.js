/* mes_jobpick.js (v180)
 * 제번을 손으로 타이핑해야 하는 화면(PartList 등록, 경비등록 등)에
 * 등록된 수주 제번 목록을 datalist 로 붙여 준다.
 *   MESJOB.attach('q_job', {onPick:fn})   → 입력칸 id 지정
 * job_pool 뷰(취소 제외)를 20초 캐시로 공유한다.
 */
(function(){
if(window.MESJOB)return;
let cache=null,cacheAt=0;
const TTL=20000;

async function waitDB(){
  for(let i=0;i<60&&!window.MESDB;i++)await new Promise(r=>setTimeout(r,50));
  if(window.MESDB&&window.MESDB.ready){try{await window.MESDB.ready}catch(e){}}
  return !!(window.MESDB&&window.MESDB.online);
}

async function list(){
  if(cache&&Date.now()-cacheAt<TTL)return cache;
  if(!await waitDB())return [];
  try{
    const rs=await window.MESDB.table('job_pool')
      .select('select=job_no,item_name,customer_name,order_date&order=row_no');
    cache=rs||[];cacheAt=Date.now();return cache;
  }catch(e){return []}
}
function invalidate(){cache=null;cacheAt=0}

async function attach(inputId,opt){
  opt=opt||{};
  const el=typeof inputId==='string'?document.getElementById(inputId):inputId;
  if(!el||el.__mesjob)return;
  el.__mesjob=1;
  const rs=await list();
  const dlId='mesjob_dl_'+(el.id||Math.random().toString(36).slice(2));
  let dl=document.getElementById(dlId);
  if(!dl){dl=document.createElement('datalist');dl.id=dlId;document.body.appendChild(dl)}
  dl.innerHTML=rs.map(r=>`<option value="${String(r.job_no).replace(/"/g,'')}">`+
    `${String(r.item_name||'').replace(/</g,'')}${r.customer_name?' · '+String(r.customer_name).replace(/</g,''):''}</option>`).join('');
  el.setAttribute('list',dlId);
  el.setAttribute('placeholder',rs.length?`제번 선택/입력 (등록 ${rs.length}건)`:'등록된 수주가 없습니다');
  el.setAttribute('autocomplete','off');
  if(opt.onPick){
    const fire=()=>{const v=(el.value||'').trim();
      if(v&&rs.some(r=>String(r.job_no)===v))opt.onPick(v)};
    el.addEventListener('change',fire);
    el.addEventListener('input',()=>{const v=(el.value||'').trim();
      if(rs.some(r=>String(r.job_no)===v))fire()});
  }
  return rs.length;
}
/* ── v180: 관리제번 ▼ | 공정 ▼ 두 칸으로 고르기 ──────────────────────────
 *   MESJOB.attachSplit('q_job',{onPick:fn})
 *   기존 제번 입력칸(#q_job)은 숨기고 값의 원본으로만 쓴다(다른 코드가 q_job.value 를 그대로 읽는다).
 *   관리제번을 고르면 그 관리제번의 공정(A·B·C…) 목록이 공정 칸에 채워지고, 첫 공정이 자동 선택된다.
 *   공정 제번이 없는(단일) 관리제번은 공정 칸에 「단일」 하나만 보인다.
 *   외부에서 q_job.value 를 바꾼 뒤 change 이벤트를 주면 두 칸이 따라간다. */
function splitJob(j){const m=/^(.*\d)([A-Z])$/.exec(String(j||'').trim());return m?{base:m[1],seq:m[2]}:{base:String(j||'').trim(),seq:''}}
async function attachSplit(inputId,opt){
  opt=opt||{};
  const el=typeof inputId==='string'?document.getElementById(inputId):inputId;
  if(!el||el.__mesjobSplit)return;
  el.__mesjobSplit=1;
  const rs=await list();
  const groups=new Map();
  rs.forEach(r=>{const s=splitJob(r.job_no);let g=groups.get(s.base);if(!g){g={base:s.base,jobs:[],item:'',cust:''};groups.set(s.base,g)}
    g.jobs.push({job:String(r.job_no),seq:s.seq});if(!g.item&&r.item_name)g.item=String(r.item_name);if(!g.cust&&r.customer_name)g.cust=String(r.customer_name)});
  groups.forEach(g=>g.jobs.sort((a,b)=>a.seq.localeCompare(b.seq)));
  const bases=[...groups.values()].sort((a,b)=>b.base.localeCompare(a.base));
  const esc=v=>String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const w=el.style.width||'';
  const sb=document.createElement('select');sb.id=el.id+'_base';sb.className=el.className||'field';sb.style.width=(parseInt(w,10)>=240?w:'250px');sb.title='관리제번 (공정 문자를 뺀 제번)';
  const ss=document.createElement('select');ss.id=el.id+'_seq';ss.className=el.className||'field';ss.style.width='118px';ss.title='공정 (A·B·C…). 공정 제번이 없으면 「단일」';
  const lb=document.createElement('span');lb.className='lb';lb.textContent='공정';lb.style.marginLeft='6px';
  sb.innerHTML=`<option value="">${bases.length?`관리제번 선택 (${bases.length}건)`:'등록된 수주가 없습니다'}</option>`+
    bases.map(g=>`<option value="${esc(g.base)}">${esc(g.base)}${g.item?' · '+esc(g.item):''}${g.jobs.length>1||g.jobs[0].seq?' ('+g.jobs.map(j=>j.seq||'단일').join('·')+')':''}</option>`).join('');
  el.style.display='none';el.setAttribute('data-nocombo','1');
  /* 공용 콤보(mes_ctx)가 먼저 입력칸을 감쌌으면 감싼 통째로 숨기고 그 앞에 넣는다 */
  let anchor=el;const wrap=el.parentNode&&el.parentNode.classList&&el.parentNode.classList.contains('mescb')?el.parentNode:null;
  if(wrap){wrap.style.display='none';anchor=wrap}
  anchor.parentNode.insertBefore(sb,anchor);anchor.parentNode.insertBefore(lb,anchor);anchor.parentNode.insertBefore(ss,anchor);
  function fillSeq(base,want){
    const g=groups.get(base);
    ss.innerHTML=g?g.jobs.map(j=>`<option value="${esc(j.job)}">${j.seq?j.seq+' · '+esc(j.job):'단일 · '+esc(j.job)}</option>`).join(''):'<option value="">-</option>';
    if(g){const hit=g.jobs.find(j=>j.job===want);ss.value=hit?hit.job:g.jobs[0].job}
  }
  function pick(fire){
    const v=ss.value||'';
    if(el.value!==v){el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}))}
    if(fire&&v&&opt.onPick)opt.onPick(v);
  }
  sb.addEventListener('change',()=>{fillSeq(sb.value,'');pick(true)});
  ss.addEventListener('change',()=>pick(true));
  function sync(){const v=(el.value||'').trim();if(!v){return}const s=splitJob(v);
    if(groups.has(s.base)){sb.value=s.base;fillSeq(s.base,v)}else{sb.value='';ss.innerHTML=`<option value="${esc(v)}">${esc(v)}</option>`}}
  el.addEventListener('change',sync);
  el.__mesjobSync=sync;
  sync();
  return bases.length;
}
/* ── v268: 관리제번 ▼ | 제번 (입력 또는 선택) 두 칸 ─────────────────────
 *   MESJOB.attachFilter('q_job',{onPick:fn})
 *   attachSplit 과 같지만 두 번째 칸이 「공정 ▼」 대신 「제번」 입력칸(datalist)이다 —
 *   관리제번을 고르면 그 관리제번의 공정 제번(A·B·C…)만 목록에 뜨고 첫 제번이 자동 선택된다.
 *   관리제번을 비우면 전체 제번이 목록에 뜬다. 제번을 직접 타이핑하면 관리제번 칸이 따라간다. */
async function attachFilter(inputId,opt){
  opt=opt||{};
  const el=typeof inputId==='string'?document.getElementById(inputId):inputId;
  if(!el||el.__mesjobSplit)return;
  el.__mesjobSplit=1;
  const rs=await list();
  const groups=new Map();
  rs.forEach(r=>{const s=splitJob(r.job_no);let g=groups.get(s.base);if(!g){g={base:s.base,jobs:[],item:'',cust:''};groups.set(s.base,g)}
    g.jobs.push({job:String(r.job_no),seq:s.seq,item:String(r.item_name||'')});if(!g.item&&r.item_name)g.item=String(r.item_name);if(!g.cust&&r.customer_name)g.cust=String(r.customer_name)});
  groups.forEach(g=>g.jobs.sort((a,b)=>a.seq.localeCompare(b.seq)));
  const bases=[...groups.values()].sort((a,b)=>b.base.localeCompare(a.base));
  const esc=v=>String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const w=el.style.width||'';
  const sb=document.createElement('select');sb.id=el.id+'_base';sb.className=el.className||'field';sb.style.width=(parseInt(w,10)>=240?w:'250px');sb.title='관리제번 (공정 문자를 뺀 제번)';
  const ji=document.createElement('input');ji.id=el.id+'_job';ji.className=el.className||'field';ji.style.width='170px';ji.autocomplete='off';ji.placeholder='입력 또는 선택';ji.title='제번 — 관리제번을 고르면 그 공정 제번만, 비우면 전체';
  const dl=document.createElement('datalist');dl.id=el.id+'_jobdl';ji.setAttribute('list',dl.id);
  ji.__mesJob=1;   /* 공용 제번목록(mes_ctx)이 전체 목록으로 덮어쓰지 않게 — 이 칸은 관리제번으로 걸러진 목록을 쓴다 */
  const lb=document.createElement('span');lb.className='lb';lb.textContent='제번';lb.style.marginLeft='6px';
  sb.innerHTML=`<option value="">${bases.length?`관리제번 선택 (${bases.length}건)`:'등록된 수주가 없습니다'}</option>`+
    bases.map(g=>`<option value="${esc(g.base)}">${esc(g.base)}${g.item?' · '+esc(g.item):''}${g.jobs.length>1||g.jobs[0].seq?' ('+g.jobs.map(j=>j.seq||'단일').join('·')+')':''}</option>`).join('');
  el.style.display='none';el.setAttribute('data-nocombo','1');
  let anchor=el;const wrap=el.parentNode&&el.parentNode.classList&&el.parentNode.classList.contains('mescb')?el.parentNode:null;
  if(wrap){wrap.style.display='none';anchor=wrap}
  anchor.parentNode.insertBefore(sb,anchor);anchor.parentNode.insertBefore(lb,anchor);anchor.parentNode.insertBefore(ji,anchor);anchor.parentNode.insertBefore(dl,anchor);
  function fillDL(base){
    const js=base&&groups.has(base)?groups.get(base).jobs:[].concat(...bases.map(g=>g.jobs));
    dl.innerHTML=js.map(j=>`<option value="${esc(j.job)}">${j.seq?j.seq+' 공정':'단일'}${j.item?' · '+esc(j.item):''}</option>`).join('');
  }
  function setJob(v,fire){
    v=(v||'').trim();
    if(el.value!==v){el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}))}
    if(ji.value!==v)ji.value=v;
    if(fire&&v&&opt.onPick)opt.onPick(v);
  }
  sb.addEventListener('change',()=>{const g=groups.get(sb.value);fillDL(sb.value);setJob(g?g.jobs[0].job:'',true)});
  const jobFire=()=>{const v=(ji.value||'').trim();if(!v)return;
    const s=splitJob(v);if(groups.has(s.base)&&sb.value!==s.base){sb.value=s.base;fillDL(s.base)}
    setJob(v,rs.some(r=>String(r.job_no)===v))};
  ji.addEventListener('change',jobFire);
  ji.addEventListener('input',()=>{const v=(ji.value||'').trim();if(rs.some(r=>String(r.job_no)===v))jobFire()});
  ji.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();jobFire();if(opt.onEnter)opt.onEnter((ji.value||'').trim())}});
  function sync(){const v=(el.value||'').trim();if(!v){return}const s=splitJob(v);
    if(groups.has(s.base)){sb.value=s.base}else{sb.value=''}fillDL(sb.value);ji.value=v}
  el.addEventListener('change',sync);
  el.__mesjobSync=sync;
  fillDL('');sync();
  return bases.length;
}
function syncSplit(inputId){const el=typeof inputId==='string'?document.getElementById(inputId):inputId;if(el&&el.__mesjobSync)el.__mesjobSync()}
window.MESJOB={attach,attachSplit,attachFilter,syncSplit,splitJob,list,invalidate};
})();
