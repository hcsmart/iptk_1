/* mes_drawboard.js (v208) — 부품 그림보드 열기
 *  사내외가공 발주 화면에서 부품 그림을 누르면 drawboard.html 을 새 창으로 연다.
 *  자료는 sessionStorage 로 넘긴다 (스크립트로 문서를 써 넣지 않는다).
 *  MESDRAW.open({job,item,part,name,qty,image,steps:[{code,name,inhouse,vendor,state}],by})
 */
(function(){
if(window.MESDRAW)return;
function open(o){
 o=o||{};
 try{sessionStorage.setItem('mes_drawboard',JSON.stringify(o))}catch(e){}
 const w=window.open('drawboard.html?v=260','_blank');
 if(!w)return alert('팝업이 차단되었습니다. 이 사이트의 팝업을 허용해 주세요.');
 return w;
}
window.MESDRAW={open};
})();
