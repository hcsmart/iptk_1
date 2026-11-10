/* HC Smart Mold 로그인 (v46) - Supabase 이메일 인증
 * index.html(부모)에서만 로드. 화면 iframe들은 mes_db.js가 부모의 토큰을 읽어 사용한다. */
(function(){
const URL_='https://ipggvrzxfcryzryileuv.supabase.co';
const KEY='sb_publishable_CHO-dAOU00HNwno52255mg_H3C1_vew';
const LS='ipmes.session';
const store={get(){try{return localStorage.getItem(LS)}catch(e){return null}},set(v){try{localStorage.setItem(LS,v)}catch(e){}},del(){try{localStorage.removeItem(LS)}catch(e){}}};

const AUTH={session:null,perms:null,role:null,name:null,
  get token(){return AUTH.session?.access_token||null},
  can(menu,right){ /* right: view|save|edit|delete */
    if(AUTH.role==='master'||AUTH.role==='admin')return true;
    if(!AUTH.perms)return right==='view';        /* 권한자료 없으면 조회만 */
    /* v46: 메뉴 개명 별칭 - 기존 권한자료(구 명칭)와 호환 */
    const ALIAS={'제작계획':'영업계획','제작계획등록':'영업계획등록','제작계획현황':'영업계획현황',
      '사내설계':'설계','SET외주제작등록':'SET발주등록',
      /* v73: 영업관리 › 설계외주/조립외주 로 재편 (DB 권한행은 새 경로로 옮겼고, 남은 옛 행 호환용) */
      '조립외주':'SET발주','설계외주':'외주설계발주','사내조립':'조립'};
    const alias=m=>m.split('/').map(x=>ALIAS[x]||x).join('/');
    /* v119: 메뉴 이동 별칭 — 경비등록·경비현황이 영업관리 → 원가관리로 옮겨졌다. 옛 경로 권한행 호환 */
    const PATH_ALIAS={'원가관리/경비':'영업관리/경비','원가관리/경비/경비등록':'영업관리/경비/경비등록','원가관리/경비/경비현황':'영업관리/경비/경비현황'};
    const hit=(m)=>AUTH.perms.find(p=>p.menu_name===m)||AUTH.perms.find(p=>p.menu_name===alias(m))||(PATH_ALIAS[m]?AUTH.perms.find(p=>p.menu_name===PATH_ALIAS[m]):null);
    /* 화면 권한 → 없으면 상위(중분류/모듈) 권한 상속 */
    const parts=(menu||'').split('/');
    for(let i=parts.length;i>=1;i--){
      const p=hit(parts.slice(0,i).join('/'));
      if(p)return !!p['can_'+(right==='delete'?'delete':right)];
    }
    return false;
  }};
window.MES_AUTH=AUTH;

async function api(path,opt={},useToken){
  const h={'apikey':KEY,'Content-Type':'application/json',
    'Authorization':'Bearer '+(useToken&&AUTH.token?AUTH.token:KEY)};
  const r=await fetch(URL_+path,{...opt,headers:{...h,...(opt.headers||{})}});
  const t=await r.text(); const b=t?JSON.parse(t):null;
  if(!r.ok)throw new Error(b?.msg||b?.error_description||b?.message||r.status);
  return b;
}

async function refresh(){
  if(!AUTH.session?.refresh_token)return false;
  try{
    const s=await api('/auth/v1/token?grant_type=refresh_token',{method:'POST',
      body:JSON.stringify({refresh_token:AUTH.session.refresh_token})});
    AUTH.session=s; store.set(JSON.stringify(s)); return true;
  }catch(e){return false}
}
AUTH.refresh=refresh;   /* v236: 화면(첨부 업로드 등)이 만료 직전 토큰을 갱신할 수 있게 */
/* 토큰 만료 5분 전 자동 갱신 */
setInterval(()=>{const s=AUTH.session;if(s&&s.expires_at*1000-Date.now()<5*60*1000)refresh()},60*1000);

async function loadPerms(){
  try{
    const rows=await api('/rest/v1/rpc/my_permissions',{method:'POST',body:'{}'},true);
    if(rows&&rows.length){AUTH.role=rows[0].role;AUTH.name=rows[0].name;
      AUTH.perms=rows.filter(r=>r.menu_name)}
    else{AUTH.role='user';AUTH.name=AUTH.session?.user?.email;AUTH.perms=[]}
  }catch(e){AUTH.role='user';AUTH.perms=[]}
}

function ui(){
  const div=document.createElement('div');div.id='loginGate';
  div.className='mesbg';
  div.innerHTML=`<style>
  /* v332: 어두운 남색 바탕 + 유리 카드 (바탕 그림 .mesbg 는 index.html) */
  #loginGate{position:fixed;inset:0;background-color:#0b1628;z-index:99999;--ring-d:min(560px,90vw);--ring-x:calc(50% - 60px);--ring-y:calc(50% - 470px);
    display:flex;align-items:center;justify-content:center;padding:16px;font-family:Pretendard,"Malgun Gothic",sans-serif}
  #loginGate .card{background:rgba(255,255,255,.11);border:1px solid rgba(255,255,255,.3);border-radius:10px;
    -webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:0 20px 60px rgba(0,6,18,.5);
    padding:46px 44px 34px;width:430px;max-width:100%;color:#fff}
  #loginGate h1{margin:0 0 6px;font-size:36px;font-weight:800;color:#fff;letter-spacing:-.5px;white-space:nowrap}#loginGate h1 b{color:#2bb8f0}#loginGate h1 i{font-style:normal;font-size:22px;font-weight:500;color:#5fa8e8;margin-left:6px}
  #loginGate .sub{font-size:15px;color:#aebbd0;margin-bottom:30px}
  #loginGate label{display:block;font-size:15px;color:#fff;margin:18px 0 8px}
  #loginGate input{width:100%;height:46px;border:1px solid rgba(255,255,255,.2);border-radius:3px;background:rgba(4,10,22,.78);color:#fff;padding:0 14px;font-size:15px;box-sizing:border-box;outline:0}
  #loginGate input::placeholder{color:#6f7f97}
  #loginGate input:focus{border-color:#2bb8f0;box-shadow:0 0 0 3px rgba(43,184,240,.2)}
  #loginGate button{width:100%;height:52px;margin-top:30px;border:0;border-radius:26px;
    background:linear-gradient(90deg,#2b8cf0,#1d55b0 55%,#0f2b5e);color:#fff;font-size:17px;font-weight:500;cursor:pointer;box-shadow:0 6px 18px rgba(0,10,30,.45)}
  #loginGate button:hover{filter:brightness(1.12)}#loginGate button:disabled{opacity:.7;cursor:wait}
  #loginGate .err{color:#ff9c92;font-size:13px;min-height:18px;margin-top:12px}
  #loginGate .hintbox{margin-top:26px;font-size:13.5px;line-height:1.6;color:#b5c2d6;border-top:1px solid rgba(255,255,255,.16);padding-top:16px}
  @media (max-width:480px){#loginGate .card{padding:32px 24px 26px}#loginGate h1{font-size:28px}#loginGate h1 i{font-size:17px}}
  </style>
  <div class="card">
    <h1><b>HC</b> Smart <i>Mold</i></h1><div class="sub">MES 로그인</div>
    <label>이름 (또는 아이디)</label><input id="lgEmail" type="text" autocomplete="username" placeholder="예: 김민수">
    <label>비밀번호</label><input id="lgPw" type="password" autocomplete="current-password" placeholder="6자리 이상">
    <button id="lgBtn">로그인</button><div class="err" id="lgErr"></div>
    <div class="hintbox">이름 또는 아이디와 비밀번호로 로그인합니다. 계정이 없으면 관리자에게 문의하세요.</div>
  </div>`;
  document.body.appendChild(div);
  const go=async()=>{
    const btn=document.getElementById('lgBtn'),err=document.getElementById('lgErr');
    if(err)err.textContent=''; if(btn){btn.disabled=true;btn.textContent='확인 중…'}
    try{
      let email=lgEmail.value.trim();
      if(!email.includes('@')){
        email=await api('/rest/v1/rpc/login_email',{method:'POST',body:JSON.stringify({p_name:email})});
        if(!email)throw new Error('등록되지 않은 사용자입니다. 이름을 확인하거나 관리자에게 문의하세요.');
      }
      const s=await api('/auth/v1/token?grant_type=password',{method:'POST',
        body:JSON.stringify({email,password:lgPw.value})});
      AUTH.session=s;store.set(JSON.stringify(s));
      await loadPerms(); done(true);
    }catch(e){if(err)err.textContent='로그인 실패: '+(String(e.message).includes('Invalid')?'이름 또는 비밀번호가 올바르지 않습니다.':e.message)}
    if(document.getElementById('lgBtn')){lgBtn.disabled=false;lgBtn.textContent='로그인'}
  };
  lgBtn.onclick=go;
  lgPw.addEventListener('keydown',e=>{if(e.key==='Enter')go()});
  lgEmail.focus();
}

function applyMenuPermissions(){
  /* 좌측 트리·상단 모듈에서 조회권한 없는 항목 숨김 */
  try{
    if(AUTH.role==='master'||AUTH.role==='admin')return;
    document.querySelectorAll('[data-menu-path]').forEach(el=>{
      if(!AUTH.can(el.dataset.menuPath,'view'))el.style.display='none';
    });
  }catch(e){}
}
async function changePassword(){
  const p1=prompt('새 비밀번호를 입력하세요. (6자 이상)');
  if(p1===null)return;
  if(!p1||p1.length<6)return alert('비밀번호는 6자 이상이어야 합니다.');
  const p2=prompt('새 비밀번호를 한 번 더 입력하세요.');
  if(p2===null)return;
  if(p1!==p2)return alert('두 입력이 일치하지 않습니다.');
  try{
    await api('/auth/v1/user',{method:'PUT',body:JSON.stringify({password:p1})},true);
    try{await api('/rest/v1/rpc/invalidate_temp_password',{method:'POST',body:'{}'},true)}catch(e){}
    alert('비밀번호가 변경되었습니다. 다음 로그인부터 새 비밀번호를 사용하세요.');
  }catch(e){alert('변경 실패: '+e.message)}
}
function userBadge(){
  const u=document.querySelector('.user');
  if(u&&AUTH.name)u.innerHTML=`${AUTH.name} (${AUTH.role==='master'?'마스터':AUTH.role==='admin'?'관리자':'사용자'}) &nbsp;`+
    `<a href="#" id="pwchg" style="font-size:11px">비밀번호 변경</a> · `+
    `<a href="#" id="lgout" style="font-size:11px">로그아웃</a>`;
  document.getElementById('pwchg')?.addEventListener('click',e=>{e.preventDefault();changePassword()});
  document.getElementById('lgout')?.addEventListener('click',e=>{e.preventDefault();
    store.del();location.reload()});
}
/* v45: interactive=true(사용자가 방금 로그인)일 때만 iframe을 새로고침한다.
   저장된 세션으로 진입할 때는 토큰이 이미 localStorage에 있어 각 화면이
   자체 init에서 읽어가므로, 새로고침하면 같은 화면을 두 번 불러오게 된다. */
function done(interactive){
  document.getElementById('loginGate')?.remove();
  userBadge(); applyMenuPermissions();
  window.dispatchEvent(new Event('mes-auth-ready'));
  if(!interactive)return;
  /* 로그인 전에 이미 열려 있던 화면만 토큰 반영을 위해 새로고침 */
  document.querySelectorAll('iframe').forEach(f=>{try{f.contentWindow.location.reload()}catch(e){}});
}

(async function init(){
  try{const saved=JSON.parse(store.get()||'null');
    if(saved){AUTH.session=saved;
      if(saved.expires_at*1000-Date.now()<60*1000){if(!await refresh()){store.del();AUTH.session=null}}
    }}catch(e){}
  if(AUTH.session){await loadPerms();done(false)}
  else if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ui);
  else ui();
})();
})();
