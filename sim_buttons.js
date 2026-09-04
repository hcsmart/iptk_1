/* 기준정보 화면 버튼 전수 테스트 하네스 (jsdom + 가짜 PostgREST) */
const fs=require('fs'),path=require('path'),{JSDOM,VirtualConsole}=require('jsdom');
const DIR=path.join(__dirname,'iptk-main');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const SKIP=/닫\s*기|로그아웃|인쇄|print/i;
async function run(name,file){
  let html=fs.readFileSync(path.join(DIR,file),'utf8');
  html=html.replace(/<script src="([^"?]+)(\?v=\d+)?"><\/script>/g,(m,src)=>{
    const p=path.join(DIR,src);return fs.existsSync(p)?`<script>${fs.readFileSync(p,'utf8')}</script>`:''});
  const reqs=[],errs=[],db={};
  const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push('jsdom:'+String(e.message||e).slice(0,120)));
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/'+file,virtualConsole:vc,
    beforeParse(w){
      w.fetch=async(url,opt={})=>{const m=(opt.method||'GET').toUpperCase();const u=new URL(url);const tb=u.pathname.split('/').pop();
        reqs.push(m+' '+tb+(u.search||''));
        const ok=b=>({ok:true,status:200,text:async()=>b==null?'':JSON.stringify(b)});
        if(!db[tb])db[tb]=[];
        if(m==='GET')return ok(db[tb]);
        if(m==='POST'){let b=[];try{b=JSON.parse(opt.body)}catch(e){}b=Array.isArray(b)?b:[b];db[tb].push(...b);
          return ok(/representation/.test(opt.headers?.Prefer||'')?b:null)}
        if(m==='DELETE'){const f=[...u.searchParams.entries()].find(([k,v])=>v.startsWith('eq.'));
          if(f)db[tb]=db[tb].filter(r=>String(r[f[0]])!==decodeURIComponent(f[1].slice(3)));return ok(null)}
        return ok(null)};
      w.MES_AUTH={role:'master',token:'t',name:'테스트',can:()=>true,session:{user_key:'00000_hcsmart'}};
      w.confirm=()=>true;w.alert=()=>{};w.prompt=()=>'';
      w.URL.createObjectURL=()=>{w.__dl=(w.__dl||0)+1;return 'blob:x'};w.URL.revokeObjectURL=()=>{};
      w.HTMLAnchorElement.prototype.click=function(){};
      w.addEventListener('error',e=>errs.push(String(e.message||e.error).slice(0,140)));
      w.addEventListener('unhandledrejection',e=>errs.push('promise:'+String(e.reason&&e.reason.message||e.reason).slice(0,140)));
    }});
  const w=dom.window,d=w.document;
  w.print=()=>{};
  await sleep(500);
  const msg=()=>(d.getElementById('message')?.textContent||'').trim();
  const buttons=()=>[...d.querySelectorAll('button')].filter(b=>b.offsetParent!==null||true).filter(b=>!b.closest('#mesdlg-bg,#meslk')&&b.textContent.trim().length>0&&b.textContent.trim().length<=14);
  async function click(b){const before=reqs.length,e0=errs.length,m0=msg();b.click();await sleep(120);
    const dlg=d.querySelector('#mesdlg button[data-a="1"]');if(dlg){dlg.click();await sleep(120)}
    await sleep(500);return{req:reqs.slice(before).filter(r=>!/OPTIONS|page_state/.test(r)),err:errs.slice(e0),msg:msg()!==m0?msg():''}}
  function fill(){for(const el of d.querySelectorAll('section input,section select,section textarea,.form input,.form select,.formgrid input,.formgrid select,.formrow input,.formrow select')){
    if(el.type==='checkbox'){el.checked=true;continue}
    if(el.tagName==='SELECT'){if(el.options.length)el.selectedIndex=el.options.length-1;continue}
    if(el.type==='date'){el.value='2026-09-05';continue}
    if(el.type==='number'){el.value='1';continue}
    if(!el.value)el.value=/code|no|key|id/i.test(el.id)?'ZZ999':'시뮬값'}}
  const rows=[];const log=(lab,r)=>rows.push(`   ${lab.padEnd(12)} ${(r.err.length?'ERR ':'ok  ')} req=[${r.req.map(x=>x.split('?')[0]).join(', ')}] ${r.msg?'msg="'+r.msg.slice(0,60)+'"':''} ${r.err.length?'⚠ '+r.err.join(' | '):''}`);
  const loadErr=errs.slice();
  const seen=new Set();
  const find=re=>buttons().find(b=>re.test(b.textContent)&&!seen.has(b));
  const order=[/신\s*규|행\s*추가/,/저\s*장|등록$/,/찾기|검색|조회/,/지우기|초기화/,/EXCEL|엑셀 다운|CSV/i,/붙여넣기/,/등록예제/];
  for(const re of order){const b=find(re);if(!b)continue;seen.add(b);
    if(/저\s*장|등록$/.test(b.textContent))fill();
    if(/찾기|검색/.test(b.textContent)){const q=d.getElementById('query');if(q)q.value=''}
    const r=await click(b);log(b.textContent.trim(),r)}
  /* 삭제: 행 선택 후 */
  const del=find(/삭제|제거/);
  if(del){seen.add(del);const tr=d.querySelector('tbody tr');if(tr)tr.click();await sleep(80);const r=await click(del);log(del.textContent.trim(),r)}
  /* 나머지 버튼 */
  for(const b of buttons()){if(seen.has(b)||SKIP.test(b.textContent)||b.textContent.trim().length<2)continue;seen.add(b);
    if(/삭제|제거|취소/.test(b.textContent)){const tr=d.querySelector('tbody tr');if(tr)tr.click();await sleep(60)}
    const r=await click(b);log(b.textContent.trim(),r)}
  const total=rows.filter(x=>/ERR /.test(x)).length+loadErr.length;
  console.log(`${total?'FAIL':'OK  '} ${name} (${file})${loadErr.length?'  로드오류: '+loadErr.join(' | '):''}`);
  rows.forEach(x=>console.log(x));
  w.close();
}
(async()=>{const list=JSON.parse(fs.readFileSync('base_screens.json'));const done=new Set();
  for(const [n,f] of Object.entries(list)){if(!f||done.has(f))continue;done.add(f);try{await run(n,f)}catch(e){console.log('CRASH',n,f,e.message)}}})();
