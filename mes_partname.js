/* 금형번호 → 품명 자동입력 (v1)
 *
 * 금형번호는 앞 3자리(영문 1 + 숫자 2)가 부품 종류 코드다.  예) B17B3 → B17 = 다이편, C41C → C41 = 스트리퍼
 * PartList 등록(원재료·구매품)에서 금형번호를 넣으면 그 코드의 품명을 자동으로 채운다.
 *
 * 품명은 ① 기준정보 › 부품관리(parts 표)에 그 코드가 있으면 그 이름, ② 없으면 아래 내장 코드표 순서로 찾는다.
 * 코드표를 바꾸려면 부품관리에서 고치면 된다 (내장표는 DB 에 없을 때의 예비). DB 에 넣는 SQL: sql_v332_parts_codes.sql
 */
(function(){
'use strict';
const BUILTIN={
 A01:'치구',A04:'지그',B07:'공구',
 B11:'펀치(일반)',B12:'피어싱펀치',B13:'버링펀치',B14:'초경펀치',B15:'펀치편',B16:'다이',B17:'다이편',B18:'펀치겸다이',B19:'특수펀치',
 B20:'킥커펀치',B21:'노칭펀치',B22:'벤딩펀치',B23:'포밍펀치',B24:'엠보싱펀치',B25:'슬리팅펀치',B26:'컷팅펀치',B27:'맨드럴펀치',B28:'드로잉핀치',B29:'재가압펀치',
 B31:'노칭다이',B32:'피어싱다이',B33:'포밍다이',B34:'엠보싱다이',B35:'랜싱다이',B38:'드로잉다이',B42:'벤딩다이',
 C21:'샹크판',C22:'상홀더',C23:'펀치고정판',C24:'다이고정판',C25:'하홀더',C26:'블록',C27:'펀치고정판편',
 C31:'소재안내판',C32:'웨어플레이트',C33:'캠가이드판',C34:'오일레스판',
 C41:'스프리퍼',C42:'스트리퍼편',C43:'슈트',C44:'슈트판',C45:'리프트판',C46:'녹아웃판',
 C51:'백킹플레이트',C52:'컴몬플레이트',C53:'서브플레이트',C54:'보조판',C55:'쿠션판',C56:'게이지판',C57:'압축판',C61:'라이너판',C81:'핑거고정판',C83:'아이들',
 D21:'고정봉',D31:'가이드핀',D32:'가이드포스트',D33:'가이드바',D34:'가이드핀부싱',D35:'포스트부싱',D36:'오일레스부싱',D37:'볼리테이너',D38:'포스트부쉬셋트',D39:'가이드핀부쉬셋트',
 D41:'녹아웃바',D42:'털핀',D43:'리프트핀',D51:'파일롯판',D52:'로케이팅핀',D53:'밀핀',D54:'정지핀',D55:'쿠션핀',D56:'고정핀',D57:'적치봉',D58:'스트록조정봉',D59:'적치봉셋트',
 D81:'핀',D82:'봉',D91:'부시',
 E11:'적층링',E12:'비이드',E13:'스크랩커터',E14:'적층봉',E21:'포스트홀더',E22:'지지볼트',E23:'펀치링',E24:'다이링',E25:'워엄박스',E26:'기어박스',E27:'베이링하우징',E28:'로테이션링',E29:'링',
 E31:'스풀리테이너',E32:'리테이너',E33:'브라켓',E41:'가스켓',E42:'롤러',
 E51:'패드',E52:'블랭크홀더',E53:'백업',E54:'스페이스',E55:'숄더샤프트',E56:'커버',E57:'스톱퍼',E58:'키이',E59:'스프링커버',
 E61:'캠세트',E62:'캠드라이버',E63:'캠슬라이드',E64:'기어',E65:'샤프트',E66:'엘리베이터',E67:'피니언',E68:'피스톤',E69:'크랭크',
 E71:'핑거',E72:'핸들',E73:'훅',E81:'샹크',E82:'명판',E91:'전극',E92:'홀더',E93:'칼라',E94:'클램프',E95:'하우징',E96:'목재박스',E97:'박스',
 S01:'유공압실린더셋',S02:'유압실린더',S03:'공압실린더',S04:'실린더연결봉',S05:'실린더판',S06:'실린더설치봉',S07:'리밋스위치홀더',S08:'도그',S09:'도그고정봉',
 S10:'리밋트스위치',S11:'마이크로스위치',S12:'카플러셋',S13:'카플러플러그',S14:'카플러소켓',S15:'소켓플러그',S16:'이경니플',S17:'엘보우',S18:"45'엘보우",S19:'유니온',
 S20:'호스니플',S21:'원터치니플',S22:'호스니플',S23:'튜브',S24:'유압호스',S25:'소음기',S26:'에어세트',S96:'콘넥터',S97:'기타공압부품',S98:'기타유압부품',S99:'기타전장부품',
 T01:'육각홈붙이볼트',T02:'특수볼트',T03:'평두볼트',T04:'육각볼트',T05:'아이볼트',T06:'접시머리작은나사',T07:'세트스크류',T08:'육각너트',T09:'특수너트',
 T10:'스프링와샤',T11:'둥근편와샤',T12:'압축스프링',T13:'인장스프링',T14:'사각스프링',T15:'와이어스프링',T16:'스냅링',T17:'베어링',T18:'맞춤핀',T19:'볼플린져',
 T20:'스프링플린져',T21:'쟈스퍼',T22:'오링',T23:'유패킹',T24:'더스트시일',T25:'백업링',T26:'자석',T27:'리벳',T28:'가스스프링',T29:'니트로다인',
 T40:'목형',T41:'우레탄판',T42:'우레탄봉',T61:'볼',T99:'기타기계부품',Z00:'시험재료'
};
const DB=new Map();let loaded=null;
/* 부품관리(parts) 표에서 3자리 코드만 읽어 둔다 */
function load(){
 if(loaded)return loaded;
 loaded=(async()=>{
  try{
   if(!window.MESDB)return;
   if(MESDB.ready){try{await MESDB.ready}catch(e){}}
   if(!MESDB.online)return;
   const rs=await MESDB.table('parts').select('select=part_code,part_name');
   (rs||[]).forEach(r=>{const c=String(r.part_code||'').trim().toUpperCase(),n=String(r.part_name||'').trim();
    if(/^[A-Z]\d{2}$/.test(c)&&n&&n!==c)DB.set(c,n)});
  }catch(e){}
 })();
 return loaded;
}
/* 금형번호 → 코드 3자리 */
const codeOf=pn=>{const m=/^\s*([A-Za-z])(\d{2})/.exec(String(pn||''));return m?(m[1]+m[2]).toUpperCase():''};
/* 금형번호 → 품명 ('' 이면 모름) */
function nameOf(pn){const c=codeOf(pn);if(!c)return '';return DB.get(c)||BUILTIN[c]||''}
/* 입력칸 연결: 금형번호 칸(pnEl)을 치면 품명 칸(nameEl)을 채운다.
   사용자가 품명을 직접 고친 뒤에는 덮어쓰지 않는다 (금형번호 칸을 비우고 다시 치면 다시 자동). */
function bind(pnEl,nameEl){
 if(!pnEl||!nameEl||pnEl.dataset.pnBound)return;pnEl.dataset.pnBound='1';
 load();
 const fill=()=>{const n=nameOf(pnEl.value);const cur=(nameEl.value||'').trim();
  if(!n){if(nameEl.dataset.auto==='1'){nameEl.value='';nameEl.dataset.auto='';nameEl.title=''}return}   /* 모르는 코드·빈 칸: 자동으로 넣었던 품명만 지운다 */
  if(cur===''||nameEl.dataset.auto==='1'){nameEl.value=n;nameEl.dataset.auto='1';nameEl.title='금형번호 '+codeOf(pnEl.value)+' 코드로 자동 입력 — 직접 고칠 수 있습니다'}};
 pnEl.addEventListener('input',fill);pnEl.addEventListener('change',fill);
 nameEl.addEventListener('input',()=>{nameEl.dataset.auto=''});
}
/* 붙여넣기·수동등록 행: 품명이 비어 있으면 채운다 */
function fillRows(rows){let n=0;(rows||[]).forEach(r=>{if(r&&!String(r.part_name||'').trim()){const nm=nameOf(r.part_no);if(nm){r.part_name=nm;n++}}});return n}
window.MESPARTNAME={load,nameOf,codeOf,bind,fillRows,BUILTIN};
})();
