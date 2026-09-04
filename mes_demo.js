/* mes_demo.js — 등록예제 안내 재생기 (프레젠테이션용)
 *
 *  MESSAMPLE 의 화면별 예시값을 한 칸씩 순서대로 채우면서,
 *  각 칸 옆에 '등록요점' 말풍선을 잠시 띄워 설명한다.
 *
 *  MESDEMO.run(page, {keyId, auto})   시작 / 재생중이면 중지
 *  MESDEMO.stop()                     중지
 *  MESDEMO.busy()                     재생중 여부
 */
(function(){
'use strict';

var ST={on:false, paused:false, i:0, steps:[], timer:null, page:null, opt:null, msg:null};
var SPEED={느리게:2200, 보통:1400, 빠르게:800};
var speed=1400;

/* ── 스타일 (1회 주입) ────────────────────────────── */
function css(){
  if(document.getElementById('mesdemo-css'))return;
  var st=document.createElement('style'); st.id='mesdemo-css';
  st.textContent=
  '.mesdemo-hl{outline:2px solid #1d7fd8!important;outline-offset:1px;'
  +'box-shadow:0 0 0 4px rgba(29,127,216,.18);background:#f2f9ff!important;transition:background .2s}'
  +'.mesdemo-tip{position:fixed;z-index:99999;max-width:330px;background:#12405f;color:#fff;'
  +'font-size:12.5px;line-height:1.55;padding:9px 12px;border-radius:6px;'
  +'box-shadow:0 6px 20px rgba(0,0,0,.28);opacity:0;transform:translateY(4px);'
  +'transition:opacity .18s,transform .18s;pointer-events:none;white-space:normal}'
  +'.mesdemo-tip.show{opacity:1;transform:translateY(0)}'
  +'.mesdemo-tip b{color:#ffe08a}'
  +'.mesdemo-tip:after{content:"";position:absolute;border:7px solid transparent}'
  +'.mesdemo-tip.up:after{top:-14px;left:18px;border-bottom-color:#12405f}'
  +'.mesdemo-tip.down:after{bottom:-14px;left:18px;border-top-color:#12405f}'
  +'.mesdemo-bar{position:fixed;left:50%;transform:translateX(-50%);bottom:14px;z-index:99999;'
  +'display:flex;align-items:center;gap:6px;background:#12405f;color:#fff;padding:7px 10px;'
  +'border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.3);font-size:12px}'
  +'.mesdemo-bar button{height:26px;min-width:34px;padding:0 9px;border:0;border-radius:4px;'
  +'background:#2b6f9e;color:#fff;font-size:12px;cursor:pointer}'
  +'.mesdemo-bar button:hover{background:#3d87ba}'
  +'.mesdemo-bar .cnt{min-width:56px;text-align:center;opacity:.85}'
  +'.mesdemo-bar select{height:26px;border:0;border-radius:4px;background:#2b6f9e;color:#fff;font-size:12px}'
  +'@media(max-width:880px){.mesdemo-tip{max-width:78vw;font-size:12px}.mesdemo-bar{bottom:8px;flex-wrap:wrap;max-width:94vw}}';
  document.head.appendChild(st);
}

/* ── 말풍선 ───────────────────────────────────────── */
var tipEl=null;
function tip(el,text){
  if(!tipEl){tipEl=document.createElement('div');tipEl.className='mesdemo-tip';document.body.appendChild(tipEl)}
  tipEl.innerHTML=text;
  tipEl.classList.remove('show','up','down');
  var r=el.getBoundingClientRect();
  tipEl.style.left='0px'; tipEl.style.top='0px';
  var tw=tipEl.offsetWidth, th=tipEl.offsetHeight;
  var below=r.bottom+10+th<window.innerHeight;
  var left=Math.min(Math.max(8,r.left-6), window.innerWidth-tw-8);
  tipEl.style.left=left+'px';
  tipEl.style.top=(below? r.bottom+10 : Math.max(8,r.top-th-10))+'px';
  tipEl.classList.add('show', below?'up':'down');
}
function tipHide(){ if(tipEl)tipEl.classList.remove('show') }

/* ── 하이라이트 ───────────────────────────────────── */
var hlEl=null;
function hl(el){
  if(hlEl)hlEl.classList.remove('mesdemo-hl');
  hlEl=el; if(!el)return;
  el.classList.add('mesdemo-hl');
  try{el.scrollIntoView({block:'nearest',behavior:'smooth'})}catch(e){}
}
function hlOff(){ if(hlEl){hlEl.classList.remove('mesdemo-hl');hlEl=null} }

/* ── 조작바 ───────────────────────────────────────── */
var bar=null;
function showBar(){
  if(bar)return;
  bar=document.createElement('div'); bar.className='mesdemo-bar';
  bar.innerHTML='<b>등록예제 안내</b>'
   +'<span class="cnt" id="mesdemo-cnt"></span>'
   +'<button id="mesdemo-prev" title="이전 칸">◀</button>'
   +'<button id="mesdemo-pause" title="일시정지 / 재생">⏸</button>'
   +'<button id="mesdemo-next" title="다음 칸">▶</button>'
   +'<select id="mesdemo-speed" title="속도"><option>느리게</option><option selected>보통</option><option>빠르게</option></select>'
   +'<button id="mesdemo-all" title="남은 칸을 한 번에 채우기">⚡ 한번에</button>'
   +'<button id="mesdemo-stop" title="중지">⏹</button>';
  document.body.appendChild(bar);
  bar.querySelector('#mesdemo-prev').onclick=function(){clearTimeout(ST.timer);ST.i=Math.max(0,ST.i-2);step()};
  bar.querySelector('#mesdemo-next').onclick=function(){clearTimeout(ST.timer);step()};
  bar.querySelector('#mesdemo-pause').onclick=function(){
    ST.paused=!ST.paused; this.textContent=ST.paused?'▶':'⏸';
    if(!ST.paused)step(); else clearTimeout(ST.timer);
  };
  bar.querySelector('#mesdemo-speed').onchange=function(){speed=SPEED[this.value]||1400};
  bar.querySelector('#mesdemo-all').onclick=function(){
    clearTimeout(ST.timer);
    /* 클릭 단계가 섞인 시나리오는 순서를 지켜야 하므로 빠른 속도로 계속 재생한다 */
    if(ST.steps.some(function(x){return x.act==='click'||x.act==='check'})){
      speed=250; ST.paused=false;
      var pb=document.getElementById('mesdemo-pause'); if(pb)pb.textContent='⏸';
      return step();
    }
    for(var i=0;i<ST.steps.length;i++)apply(ST.steps[i]);
    ST.i=ST.steps.length;
    finish();
  };
  bar.querySelector('#mesdemo-stop').onclick=function(){stop(true)};
}
function hideBar(){ if(bar){bar.remove();bar=null} }
function cnt(){
  var e=document.getElementById('mesdemo-cnt');
  if(e)e.textContent=Math.min(ST.i,ST.steps.length)+' / '+ST.steps.length;
}

/* ── 값 적용 ──────────────────────────────────────── */
function target(s){
  if(s.at)return document.querySelector(s.at);
  if(s.sel)return document.querySelector(s.sel);
  if(s.id)return document.getElementById(s.id);
  return null;
}
function checkRows(s){
  var list=document.querySelectorAll(s.sel||'#body input[type=checkbox]');
  var n=s.n||1, done=0;
  for(var i=0;i<list.length&&done<n;i++){
    if(list[i].disabled)continue;
    if(!list[i].checked){list[i].checked=true;list[i].dispatchEvent(new Event('change',{bubbles:true}))}
    done++;
  }
  return done;
}
function apply(s){
  if(s.act==='click'){ var c=target(s); if(c)c.dispatchEvent(new MouseEvent('click',{bubbles:true})); return true }
  if(s.act==='check'){ checkRows(s); return true }
  if(s.act==='note') return true;
  var el=document.getElementById(s.id); if(!el)return false;
  if(el.tagName==='SELECT'){
    el.value=s.value;
    if(el.value!==s.value){
      for(var k=0;k<el.options.length;k++)
        if(el.options[k].text===s.value){el.selectedIndex=k;break}
    }
  }else el.value=s.value;
  el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
  return true;
}
/* 텍스트는 타자 치듯 채워 시선을 끈다 */
function typeIn(el,v,done){
  if(el.tagName==='SELECT'||String(v).length>28||speed<900){ el.value=v; fire(el); return done() }
  var i=0, ms=Math.max(12, Math.min(45, 420/Math.max(1,String(v).length)));
  el.value='';
  (function tick(){
    if(!ST.on)return done();
    el.value=String(v).slice(0,++i);
    if(i>=String(v).length){ fire(el); return done() }
    ST.timer=setTimeout(tick,ms);
  })();
}
function fire(el){
  el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
}

/* ── 진행 ─────────────────────────────────────────── */
function step(){
  if(!ST.on)return;
  if(ST.i>0)apply(ST.steps[ST.i-1]);        /* 타이핑 중 이동해도 직전 칸 값 확정 */
  if(ST.i>=ST.steps.length)return finish();
  var s=ST.steps[ST.i++]; cnt();
  var el=target(s);
  if(!el){ return step() }
  hl(el);
  tip(el, (s.label?'<b>'+s.label+'</b><br>':'') + (s.tip||'예시값을 입력합니다.'));
  var wait=function(extra){
    if(!ST.on)return;
    if(ST.paused){cnt();return}
    ST.timer=setTimeout(step, speed+(extra||0));
  };
  if(s.act==='note'){ return wait(300) }
  if(s.act==='check'){
    ST.timer=setTimeout(function(){
      if(!ST.on)return;
      var n=checkRows(s);
      if(!n)say('선택할 행이 없습니다. 앞 단계에서 조회가 되었는지 확인하세요.');
      wait(200);
    }, Math.min(700, speed*0.5));
    return;
  }
  if(s.act==='click'){
    ST.timer=setTimeout(function(){
      if(!ST.on)return;
      el.dispatchEvent(new MouseEvent('click',{bubbles:true}));
      wait(200);
    }, Math.min(700, speed*0.5));
    return;
  }
  typeIn(el, s.value, function(){ wait(0) });
}
function finish(){
  if(!ST.steps.some(function(x){return x.act==='click'||x.act==='check'}))
    for(var i=0;i<ST.steps.length;i++)apply(ST.steps[i]);
  cnt(); hlOff(); tipHide();
  ST.on=false; hideBar();
  say('등록예제 안내를 마쳤습니다. 내용을 확인하고 [저장]을 누르세요.');
}
function stop(byUser){
  clearTimeout(ST.timer); ST.on=false; ST.paused=false;
  hlOff(); tipHide(); hideBar();
  if(byUser)say('등록예제 안내를 중지했습니다.');
}
function say(t){
  try{ if(window.MES&&window.MES.setMessage)return window.MES.setMessage(t) }catch(e){}
  var m=document.getElementById('message'); if(m)m.textContent=t;
}

/* ── 시작 ─────────────────────────────────────────── */
function run(page,opt){
  if(ST.on){ stop(true); return }
  if(!window.MESSAMPLE){ say('예제 모듈을 불러오지 못했습니다.'); return }
  css();
  opt=opt||{};

  /* 시나리오형 화면(조회→선택→입력→추가)은 별도 대본을 따른다 */
  if(window.MESSCENE && MESSCENE[page]){
    var sc=MESSCENE[page];
    ST.steps=(typeof sc==='function'?sc():sc).filter(function(x){return x});
    if(!ST.steps.length){ say('안내 대본이 비어 있습니다.'); return }
    ST.on=true; ST.paused=false; ST.i=0; ST.page=page; ST.opt=opt;
    showBar(); cnt();
    say('등록예제 안내를 시작합니다. (화면 순서대로 시연합니다)');
    ST.timer=setTimeout(step,350);
    return;
  }

  /* 1) 기존 즉시채움으로 값을 만든 뒤, 그 값을 읽어 순서대로 다시 재생한다.
        (자동채번·자동계산·중복회피 로직을 그대로 재사용하기 위함) */
  var r=window.MESSAMPLE.fill(page,opt);
  if(!r||!r.ok){ say(r&&r.msg||'이 화면은 등록예제가 없습니다.'); return }

  var spec=window.MESSAMPLE.spec(page)||{};
  var tips=spec._tips||{};
  var labels=spec._labels||{};
  var order=Object.keys(spec).filter(function(k){return k.charAt(0)!=='_'});

  ST.steps=[];
  order.forEach(function(id){
    var el=document.getElementById(id);
    if(!el||el.readOnly||el.disabled)return;              // 자동계산 칸은 건너뛴다
    if(el.type==='checkbox'||el.type==='file')return;      // 체크박스·파일은 fill 단계에서 처리
    var v=String(el.value==null?'':el.value);
    if(!v.trim())return;                                   // 비워두는 칸도 건너뛴다
    ST.steps.push({id:id, value:v, tip:tips[id]||'', label:labels[id]||labelOf(el)});
  });
  if(!ST.steps.length){ say('채울 항목이 없습니다.'); return }

  /* 2) 화면을 다시 비우고 처음부터 재생 */
  try{ if(typeof window.add==='function') window.add() }catch(e){}
  ST.steps.forEach(function(s){ var e=document.getElementById(s.id); if(e&&!e.readOnly)e.value='' });

  ST.on=true; ST.paused=false; ST.i=0; ST.page=page; ST.opt=opt;
  showBar(); cnt();
  say('등록예제 안내를 시작합니다. (칸을 순서대로 채우며 설명합니다)');
  ST.timer=setTimeout(step,350);
}

/* 입력칸의 라벨 텍스트 찾기 */
function labelOf(el){
  /* 1) 입력칸에서 위로 올라가며 바로 앞 형제의 라벨을 찾는다 */
  var node=el;
  for(var up=0; up<4 && node; up++){
    var p=node.previousElementSibling;
    for(var n=0;n<3&&p;n++){
      var t=(p.textContent||'').trim();
      if(t&&t.length<=16&&!p.querySelector('input,select,textarea'))return t;
      p=p.previousElementSibling;
    }
    node=node.parentElement;
    if(node&&(node.classList.contains('formgrid')||node.tagName==='SECTION'))break;
  }
  /* 2) 표 형태: 같은 행의 앞쪽 th/td */
  var tr=el.closest('tr');
  if(tr){
    var cells=tr.children;
    for(var i=0;i<cells.length;i++){
      if(cells[i].contains(el))break;
      var t2=(cells[i].textContent||'').trim();
      if(t2&&t2.length<=16)var last=t2;
    }
    if(last)return last;
  }
  /* 3) label[for] */
  var lb=document.querySelector('label[for="'+el.id+'"]');
  if(lb){var t3=(lb.textContent||'').trim(); if(t3&&t3.length<=16)return t3}
  return '';
}

document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&ST.on)stop(true) });

window.MESDEMO={run:run, stop:stop, busy:function(){return ST.on}};
})();
