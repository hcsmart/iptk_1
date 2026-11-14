/* v355: 도면 PDF 공용 — 여러 장 메뉴(열기·삭제) · 삭제 확인 창 · 삭제
 *  쓰는 곳: PartList 등록(원재료) · 사내외가공 발주
 *  삭제 = 도면대장(drawings) 기록을 지운다 → 화면의 PDF 표시가 사라지고 열 수 없게 된다.
 *        파일은 비공개 저장소(mes-drawing)에 남는다 (저장소는 삭제 권한을 막아 둔 상태 — sql_v160_drawing_bucket.sql)
 *  MESDWG.menu(el, list, onChanged)   — PDF 표시를 우클릭(또는 여러 장 클릭) 했을 때: 장마다 [열기] [✕ 삭제]
 *  MESDWG.delDialog(list, title)      — 여러 금형번호 도면을 체크해서 한꺼번에 삭제 → Promise<지운 개수>
 */
(function(){
if(window.MESDWG)return;
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const say=t=>{const m=document.getElementById('message');if(m)m.textContent=t};
const nm=x=>x.drawing_name||x.drawing_no;

const css=document.createElement('style');css.textContent=`
#dwgMenu{position:absolute;z-index:9600;display:none;background:#fff;border:1px solid #8fa3b5;box-shadow:0 3px 10px rgba(0,0,0,.2);padding:3px 0;min-width:260px;font-size:12px}
#dwgMenu .mi{display:flex;align-items:center;gap:6px;padding:3px 6px 3px 10px}#dwgMenu .mi:hover{background:#edf6fd}
#dwgMenu .mi span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#dwgMenu .mi button{height:22px;padding:0 8px;border:1px solid #9ba8b4;background:linear-gradient(#fff,#e9eef2);cursor:pointer;font:inherit;font-size:11.5px;border-radius:2px}
#dwgMenu .mi button.del{border-color:#d29b97;color:#b3261e}#dwgMenu .mi button.del:hover{background:#fdecea}
#dwgMenu .mh{padding:3px 10px 4px;color:#7c8993;font-size:11px;border-bottom:1px solid #e1e7ec;margin-bottom:2px}
#dwgDel{position:fixed;inset:0;z-index:9700;background:rgba(30,40,50,.45);display:none;align-items:center;justify-content:center}#dwgDel.on{display:flex}
#dwgDel .bx{width:min(620px,94vw);max-height:84vh;display:flex;flex-direction:column;background:#fff;border:1px solid #5f7080;box-shadow:0 10px 30px rgba(0,0,0,.3);font-size:12px}
#dwgDel .hd{height:32px;display:flex;align-items:center;padding:0 12px;font-weight:700;color:#fff;background:linear-gradient(#b5524c,#8f3a35)}
#dwgDel .bd{padding:10px;overflow:auto;flex:1;min-height:0}
#dwgDel .nt{color:#7c8993;margin-bottom:6px;line-height:1.5}
#dwgDel label{display:flex;gap:6px;align-items:center;padding:3px 4px;border-bottom:1px dotted #e1e7ec;cursor:pointer}
#dwgDel label b{min-width:52px;color:#1d5da3}
#dwgDel .ft{display:flex;gap:6px;align-items:center;padding:8px 10px;border-top:1px solid #d5dde3;background:#f6f8fa}
#dwgDel .ft span{flex:1;color:#b3261e;font-weight:700}
#dwgDel .ft button{height:28px;padding:0 12px;border:1px solid #8b9ba9;background:linear-gradient(#fff,#e9eef2);cursor:pointer;border-radius:2px;font:inherit}
#dwgDel .ft button.go{border-color:#c0392b;background:linear-gradient(#fdecea,#f5c6c2);color:#8f1d16;font-weight:700}`;
document.head.appendChild(css);

/* 도면대장 기록 지우기 — 지운 drawing_no 목록을 돌려준다 */
async function remove(list){
 const done=[],fail=[];
 for(const x of list){try{await MESDB.table('drawings').delete({drawing_no:x.drawing_no});done.push(x.drawing_no)}catch(e){fail.push(nm(x)+' : '+String(e.message||e).slice(0,80))}}
 try{MESDB.notify&&MESDB.notify(['drawings'])}catch(e){}
 return {done,fail};
}

let menuEl=null;
function menu(el,list,onChanged){
 if(!menuEl){menuEl=document.createElement('div');menuEl.id='dwgMenu';document.body.appendChild(menuEl);
  document.addEventListener('mousedown',e=>{if(!menuEl.contains(e.target))menuEl.style.display='none'})}
 menuEl.innerHTML=`<div class="mh">도면 PDF ${list.length}장 — [열기] 새 창 · [✕ 삭제] 이 도면 연결 지우기</div>`+
  list.map((x,i)=>`<div class="mi"><span title="${esc(nm(x))}">📄 ${esc(nm(x))}</span><button type="button" data-a="open" data-i="${i}">열기</button><button type="button" class="del" data-a="del" data-i="${i}">✕ 삭제</button></div>`).join('');
 menuEl.onclick=async e=>{const b=e.target.closest('button');if(!b)return;const x=list[Number(b.dataset.i)];menuEl.style.display='none';
  if(b.dataset.a==='open')return MESDB.openRef(x.file_url,say);
  if(!confirm(`도면 PDF 를 지울까요?\n\n${nm(x)}\n\n화면의 PDF 표시가 없어지고 이 도면은 열 수 없게 됩니다.\n(같은 PDF 를 다시 일괄등록하면 다시 연결됩니다)`))return;
  const r=await remove([x]);
  say(r.done.length?`도면 PDF 「${nm(x)}」 를 지웠습니다.`:'도면 PDF 삭제 실패: '+r.fail.join(' / '));
  if(r.done.length&&onChanged)onChanged(r.done)};
 const rc=el.getBoundingClientRect();menuEl.style.left=(rc.left+window.scrollX)+'px';menuEl.style.top=(rc.bottom+window.scrollY+2)+'px';menuEl.style.display='block';
 const mw=menuEl.offsetWidth;if(rc.left+mw>window.innerWidth-8)menuEl.style.left=Math.max(4,window.innerWidth-mw-8+window.scrollX)+'px';
}

function delDialog(list,title){
 return new Promise(resolve=>{
  let w=document.getElementById('dwgDel');
  if(!w){w=document.createElement('div');w.id='dwgDel';document.body.appendChild(w)}
  w.innerHTML=`<div class="bx"><div class="hd">🗑 ${esc(title||'도면 PDF 삭제')}</div><div class="bd">
   <div class="nt">지울 도면을 확인하세요 (체크한 것만 지웁니다). 지우면 화면의 PDF 표시가 없어지고 열 수 없게 됩니다.<br>같은 PDF 를 다시 <b>📄 도면PDF 일괄등록</b> 하면 다시 연결됩니다.</div>
   <label style="font-weight:700"><input type="checkbox" id="dwgDelAll" checked> 전체 ${list.length}장</label>
   ${list.map((x,i)=>`<label><input type="checkbox" data-i="${i}" checked><b>${esc(x.part_no||'-')}</b><span>${esc(nm(x))}</span></label>`).join('')}
  </div><div class="ft"><span id="dwgDelMsg"></span><button type="button" class="go">✕ 선택한 도면 삭제</button><button type="button" class="no">취소</button></div></div>`;
  w.classList.add('on');
  const boxes=()=>[...w.querySelectorAll('input[data-i]')];
  const cnt=()=>{const n=boxes().filter(b=>b.checked).length;w.querySelector('.go').textContent=`✕ 선택한 도면 ${n}장 삭제`;w.querySelector('.go').disabled=!n};
  w.querySelector('#dwgDelAll').onchange=e=>{boxes().forEach(b=>b.checked=e.target.checked);cnt()};
  boxes().forEach(b=>b.onchange=cnt);cnt();
  const close=n=>{w.classList.remove('on');resolve(n)};
  w.querySelector('.no').onclick=()=>close(null);
  w.querySelector('.go').onclick=async()=>{
   const sel=boxes().filter(b=>b.checked).map(b=>list[Number(b.dataset.i)]);if(!sel.length)return;
   const go=w.querySelector('.go');go.disabled=true;w.querySelector('#dwgDelMsg').textContent='지우는 중…';
   const r=await remove(sel);
   if(r.fail.length){w.querySelector('#dwgDelMsg').textContent=`${r.done.length}장 삭제 · ${r.fail.length}장 실패`;go.style.display='none';
    w.querySelector('.no').textContent='닫기';w.querySelector('.no').onclick=()=>close(r.done);return}
   close(r.done)};
 });
}
/* 앱 공통 확인창(mes_ctx: '삭제'·'취소' 글자 버튼마다 「…하시겠습니까?」)과 겹치지 않게 —
   이 모듈의 삭제는 자체 확인(파일 이름을 보여 주는 창)을 거치므로 공통 확인창은 건너뛴다 */
try{const opt=window.MES_CTX_OPT||{};const mine=/dwgDelChecked|dwgDelPicked/;const prev=opt.noGuard;
 opt.noGuard=prev?{test:s=>prev.test(s)||mine.test(String(s))}:mine;window.MES_CTX_OPT=opt}catch(e){}
window.addEventListener('click',e=>{const b=e.target&&e.target.closest&&e.target.closest('#dwgDel button,#dwgMenu button.del');if(b)b.__mesOk=true},true);
window.MESDWG={menu,delDialog,remove};
})();
