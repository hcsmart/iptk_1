/* mes_scene.js — 조회→선택→입력 방식 화면의 '등록예제' 안내 대본
 *
 *  단계 형식
 *    {id:'필드id', value:'값', tip:'등록요점', label:'항목명'}   입력
 *    {act:'click', sel:'CSS선택자', tip:'...', label:'...'}      클릭
 *    {act:'note',  sel:'CSS선택자', tip:'...', label:'...'}      설명만
 *
 *  MESDEMO 가 이 대본을 순서대로 재생한다.
 */
(function(){
'use strict';

function D(off){
  var d=new Date(); d.setDate(d.getDate()+(off||0));
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
var BTN=function(fn){return 'button[onclick="'+fn+'()"]'};

var SCENE={};

/* ── 설계계획등록 ───────────────────────────────────── */
SCENE['design_plan_input']=function(){
  return [
   {id:'q_job', value:'', label:'제 번',
    tip:'제번 일부를 넣어 대상을 좁힙니다. <b>비워두면 전체 조회</b>입니다.'},
   {act:'click', sel:BTN('search'), label:'검색',
    tip:'수주된 제번이 위 목록에 나옵니다. 설계계획을 아직 세우지 않은 제번도 함께 보입니다.'},
   {act:'click', sel:'#hbody tr', label:'제번 선택',
    tip:'행을 클릭하면 <b>아래 두 목록이 그 제번 기준으로 바뀝니다.</b> 왼쪽은 공정, 오른쪽은 세부공정입니다.'},
   {id:'fPlanDate', value:D(12), label:'설계완료예정일',
    tip:'설계를 언제까지 끝낼지. <b>Try-Out 예정일에서 역산</b>해 잡습니다.'},
   {id:'fManager', value:'이태윤', label:'설계담당',
    tip:'이 제번의 설계 책임자. 설계실적등록에서 이 이름으로 실적이 쌓입니다.'},
   {act:'note', sel:BTN('save'), label:'① 먼저 저장',
    tip:'여기서 <b>[▤ 저장]</b>을 눌러 설계계획을 먼저 등록합니다. '
       +'계획이 등록되어야 아래에서 세부공정을 추가할 수 있습니다.'},
   {id:'fProc', value:'A', label:'공정',
    tip:'금형 공정 구분. 4공정 금형이면 A~D로 나눕니다.'},
   {id:'fProcName', value:'1/1', label:'공정명',
    tip:'공정 표기. 단발이면 1/1, 4공정 중 첫 번째면 1/4처럼 씁니다.'},
   {id:'fMach', value:'DA', label:'가공공정',
    tip:'설계 세부작업 코드. 기준정보 › 가공공정관리에 등록된 코드를 씁니다.'},
   {id:'fMachName', value:'레이아웃', label:'가공공정명',
    tip:'작업 이름. <b>레이아웃 → 조립도 → 부품도</b> 순으로 진행하는 것이 일반적입니다.'},
   {act:'note', sel:BTN('addStep'), label:'② 세부공정 추가',
    tip:'<b>[＋ 세부공정]</b>을 누르면 오른쪽 목록에 한 줄이 추가됩니다. '
       +'이 한 줄이 <b>설계실적을 올리는 단위</b>입니다. 가공공정만 바꿔가며 필요한 만큼 반복하세요.'},
   {act:'note', sel:BTN('addStep'), label:'③ 삭제·확인',
    tip:'잘못 넣은 줄은 같은 공정코드를 입력하고 <b>[－ 세부공정]</b>으로 지웁니다. '
       +'끝나면 설계실적등록·설계실적현황에 이 세부공정들이 나타납니다.'}
  ];
};

/* ── 가공계획등록 ───────────────────────────────────── */
SCENE['machining_plan_input']=function(){
  return [
   {id:'q_job', value:'', label:'제 번',
    tip:'제번으로 대상을 찾습니다. 비우면 전체 조회입니다.'},
   {act:'click', sel:BTN('search'), label:'검색',
    tip:'설계가 끝나 PartList가 등록된 제번이 나옵니다.'},
   {act:'click', sel:'tbody tr', label:'제번 선택',
    tip:'행을 클릭하면 그 제번의 <b>부품별 가공계획</b>이 아래에 펼쳐집니다.'},
   {act:'note', sel:BTN('save'), label:'저장',
    tip:'부품별 기준공정을 확인·수정한 뒤 <b>[▤ 저장]</b>합니다. 저장한 내용이 외주가공 발주와 공정이력카드의 기준이 됩니다.'}
  ];
};

/* ── 경비등록 ───────────────────────────────────────── */
SCENE['expense_registration']=function(){
  return [
   {id:'job_no', value:'PT005', label:'제 번',
    tip:'경비를 물릴 제번. <b>제번별 원가에 그대로 반영</b>됩니다.'},
   {id:'item_name', value:'키친', label:'품 명',
    tip:'제번을 넣으면 품명이 따라옵니다.'},
   {act:'click', sel:BTN('addRow'), label:'＋ 행추가',
    tip:'경비 한 줄이 추가됩니다. 사유·금액·발생일을 <b>표 안에서 직접</b> 입력합니다.'},
   {act:'note', sel:BTN('addRow'), label:'입력 요령',
    tip:'사유는 기준정보 › 경비사유에 등록된 항목만 고를 수 있습니다. 없는 사유는 먼저 등록하세요.'},
   {act:'note', sel:BTN('save'), label:'저장',
    tip:'<b>[▤ 저장]</b>하면 경비현황과 제조원가조회에 즉시 반영됩니다.'}
  ];
};


/* ══ 구매관리 · 발주 ═══════════════════════════════════ */

/* 원재료 발주 */
SCENE['material_order_input']=function(){
  return [
   {id:'jobQ', value:'', label:'제 번',
    tip:'제번으로 좁힐 수 있습니다. 비우면 <b>설계가 끝나 자재표가 있는 제번</b>이 모두 나옵니다.'},
   {act:'click', sel:BTN('search'), label:'검색',
    tip:'왼쪽 제번 목록이 채워집니다.'},
   {act:'click', sel:'#jobBody tr', label:'제번 선택',
    tip:'행을 클릭하면 그 제번의 <b>자재표(PartList 원재료)</b>가 아래에 펼쳐집니다. 발주할 품번이 모두 체크된 상태로 나옵니다.'},
   {act:'click', sel:'#venBody tr', label:'협력업체 선택',
    tip:'소재를 발주할 업체를 고릅니다. 업체관리에서 <b>원재료 취급</b>으로 등록된 업체만 나옵니다.'},
   {id:'reqDate', value:D(7), label:'요청일',
    tip:'납품 요구일. <b>KPI09 외주 납기준수율</b>은 이 날짜와 실제 입고일을 비교해 계산합니다.'},
   {act:'check', sel:'#bomBody input[type=checkbox]', n:3, label:'발주 품번',
    tip:'자재표에서 이번에 발주할 품번만 남깁니다. 기본은 전체 선택입니다.'},
   {act:'click', sel:BTN('pushDown'), label:'⬇ 요청추가',
    tip:'선택한 품번이 <b>아래 발주요청 목록으로 내려옵니다.</b> 규격(T*W*L)은 자동으로 분해되어 채워집니다.'},
   {act:'note', sel:BTN('pullUp'), label:'요청삭제',
    tip:'잘못 내린 줄은 선택하고 <b>[⬆ 요청삭제]</b>로 되돌립니다.'},
   {act:'note', sel:BTN('save'), label:'저장',
    tip:'<b>[▣ 저장]</b>하면 발주가 확정되어 원재료 입고 화면에 나타납니다. '
       +'<b>[⎙ PRINT]</b>로 발주서를 출력해 업체에 보냅니다.'}
  ];
};

/* 구매품 발주 — 원재료와 동일 구조 */
SCENE['purchase_order_input']=function(){
  return [
   {id:'jobQ', value:'', label:'제 번',
    tip:'제번으로 좁힐 수 있습니다. 비우면 전체 조회입니다.'},
   {act:'click', sel:BTN('search'), label:'검색', tip:'제번 목록이 채워집니다.'},
   {act:'click', sel:'#jobBody tr', label:'제번 선택',
    tip:'그 제번의 <b>구매품 자재표</b>가 펼쳐집니다. PartList 등록(구매품)에서 넘어온 목록입니다.'},
   {act:'click', sel:'#venBody tr', label:'협력업체 선택',
    tip:'업체관리에서 <b>구매품 취급</b>으로 등록된 업체만 나옵니다.'},
   {id:'reqDate', value:D(7), label:'요청일', tip:'납품 요구일. 납기준수율 계산 기준입니다.'},
   {act:'check', sel:'#bomBody input[type=checkbox]', n:3, label:'발주 품번',
    tip:'이번에 발주할 품번만 체크로 남깁니다.'},
   {act:'click', sel:BTN('pushDown'), label:'⬇ 요청추가',
    tip:'선택한 품번이 아래 발주요청 목록으로 내려옵니다.'},
   {act:'note', sel:BTN('save'), label:'저장',
    tip:'<b>[▣ 저장]</b>하면 구매품 입고 화면에 나타납니다.'}
  ];
};

/* 외주가공 발주 */
SCENE['outsourcing_order_input']=function(){
  return [
   {id:'jobQ', value:'', label:'제 번', tip:'제번으로 좁힐 수 있습니다.'},
   {act:'click', sel:BTN('search'), label:'검색', tip:'가공계획이 등록된 제번이 나옵니다.'},
   {act:'click', sel:'#jobBody tr', label:'제번 선택',
    tip:'그 제번의 <b>가공 라우팅</b>이 펼쳐집니다. 가공계획등록에서 정한 공정 순서입니다.'},
   {act:'click', sel:'#venBody tr', label:'협력업체 선택',
    tip:'업체관리에서 <b>외주가공 취급</b>으로 등록된 업체만 나옵니다. 공정별로 가능한 업체가 다릅니다.'},
   {id:'reqDate', value:D(10), label:'요청일',
    tip:'가공 완료 요구일. 후공정 일정에서 역산해 잡습니다.'},
   {act:'check', sel:'#routeBody input[type=checkbox]', n:3, label:'발주 공정',
    tip:'이 업체에 맡길 공정만 체크합니다. 열처리·표면처리는 보통 다른 업체로 나눕니다.'},
   {act:'click', sel:BTN('pushDown'), label:'⬇ 요청추가',
    tip:'선택한 공정이 아래 발주요청 목록으로 내려옵니다.'},
   {act:'note', sel:BTN('save'), label:'저장',
    tip:'<b>[▣ 저장]</b>하면 외주가공 입고 화면과 가공구매 진척현황에 반영됩니다.'}
  ];
};

/* ══ 구매관리 · 입고 ═══════════════════════════════════ */

function receiptScene(what, extra){
  return [
   {id:'jobQ', value:'', label:'제 번',
    tip:'제번·업체·품명으로 대상을 좁힐 수 있습니다.'},
   {act:'click', sel:BTN('search'), label:'검색',
    tip:'발주는 되었으나 <b>아직 입고되지 않은</b> '+what+'이(가) 나옵니다.'},
   {act:'check', sel:'#body input[type=checkbox]', n:2, label:'입고 대상 선택',
    tip:'실제로 들어온 행에 체크합니다. 여러 건을 한 번에 처리할 수 있습니다.'},
   {id:'inDate', value:D(0), label:'입고일',
    tip:'실제 입고된 날. <b>요구일과 비교해 납기준수율</b>이 계산되므로 정확히 넣으세요.'},
   {act:'click', sel:BTN('applyReceipt'), label:'적용',
    tip:'선택한 행의 상태가 <b>입고</b>로 바뀌고 입고일·금액이 채워집니다.'},
   {act:'note', sel:BTN('save'), label:'저장',
    tip:'<b>[▣ 저장]</b>해야 DB에 반영됩니다. 잘못 처리했으면 <b>[✖ 입고취소]</b>로 되돌리세요.'+(extra||'')}
  ];
}
SCENE['material_receipt_input']=function(){return receiptScene('원재료')};
SCENE['purchase_receipt_input']=function(){return receiptScene('구매품')};

/* 외주가공 입고 — 대기/입고 두 목록 구조 */
SCENE['outsourcing_receipt_input']=function(){
  return [
   {id:'jobQ', value:'', label:'제 번', tip:'제번·업체·공정으로 좁힐 수 있습니다.'},
   {act:'click', sel:BTN('search'), label:'검색',
    tip:'위쪽은 <b>입고대기</b>, 아래쪽은 <b>입고등록된</b> 건입니다.'},
   {act:'check', sel:'#waitBody input[type=checkbox]', n:2, label:'입고 대상 선택',
    tip:'업체에서 들어온 공정에 체크합니다.'},
   {id:'inDate', value:D(0), label:'입고일', tip:'실제 입고일. 납기준수율 계산 기준입니다.'},
   {act:'click', sel:BTN('pushDown'), label:'⬇ 입고등록',
    tip:'선택한 건이 <b>아래 입고 목록으로 내려옵니다.</b> 잘못 내렸으면 <b>[⬆ 입고제외]</b>로 되돌립니다.'},
   {act:'note', sel:BTN('save'), label:'저장',
    tip:'<b>[▣ 저장]</b>하면 입고가 확정되고, 입고확정 화면으로 넘어갑니다.'}
  ];
};

/* ══ 구매관리 · 입고확정 ═══════════════════════════════ */

function confirmScene(what){
  return [
   {id:'jobQ', value:'', label:'제 번', tip:'제번·업체로 대상을 좁힐 수 있습니다.'},
   {act:'click', sel:BTN('search'), label:'검색',
    tip:'입고는 되었으나 <b>아직 금액이 확정되지 않은</b> '+what+'이(가) 나옵니다.'},
   {act:'check', sel:'#body input[type=checkbox]', n:2, label:'확정 대상 선택',
    tip:'체크하면 상단 <b>합계 금액</b>이 자동으로 계산됩니다.'},
   {id:'nego', value:'3', label:'네고율(%)',
    tip:'업체와 합의한 인하율. 0이면 견적가 그대로 확정합니다.'},
   {act:'click', sel:BTN('applyNego'), label:'네고율 적용',
    tip:'선택한 행에 네고율이 적용되어 <b>확정금액이 다시 계산</b>됩니다.'},
   {id:'confirmDate', value:D(0), label:'확정일',
    tip:'금액 확정일. 매입현황과 제조원가에 이 날짜로 집계됩니다.'},
   {act:'click', sel:BTN('confirmSelected'), label:'적용',
    tip:'상태가 <b>확정</b>으로 바뀝니다. 확정된 금액이 제번별 원가에 들어갑니다.'},
   {act:'note', sel:BTN('save'), label:'저장',
    tip:'<b>[▣ 저장]</b>으로 DB에 반영합니다. 잘못했으면 <b>[✖ 확정취소]</b>로 되돌리세요.'}
  ];
}
SCENE['material_receipt_confirmation']=function(){return confirmScene('원재료')};
SCENE['purchase_receipt_confirmation']=function(){return confirmScene('구매품')};
SCENE['outsourcing_receipt_confirmation']=function(){return confirmScene('외주가공품')};

/* ══ 설계관리 ══════════════════════════════════════════ */

/* PartList 등록(원재료) */
SCENE['partlist_material_input']=function(){
  return [
   {id:'q_job', value:'', label:'제 번', tip:'PartList를 작성할 제번을 찾습니다.'},
   {act:'click', sel:BTN('search'), label:'검색', tip:'제번 목록이 채워집니다.'},
   {act:'click', sel:'#pbody tr', label:'제번 선택',
    tip:'행을 클릭하면 <b>등록된 원재료 PartList</b>가 아래에 나옵니다.'},
   {id:'fProc', value:'A', label:'공정', tip:'이 부품이 속한 공정.'},
   {id:'fPart', value:'B14', label:'품번', tip:'부품 코드. 기준정보 › 부품관리에 등록된 코드를 씁니다.'},
   {id:'fName', value:'PUNCH, CARBIDE', label:'품명', tip:'품번을 넣으면 품명이 따라옵니다.'},
   {id:'fMat', value:'HP4', label:'재질', tip:'소재 코드. 기준정보 › 자재등록의 원재료만 선택됩니다.'},
   {id:'fThk', value:'30', label:'두께', tip:'설계 치수. <b>두께×폭×길이로 소재 단가가 자동 계산</b>됩니다.'},
   {act:'note', sel:BTN('save'), label:'저장',
    tip:'<b>[▤ 저장]</b>하면 원재료 발주 화면의 자재표에 이 품번이 나타납니다. '
       +'엑셀에 정리해둔 PartList가 있으면 <b>[▤ 엑셀불러오기]</b>로 한 번에 올릴 수 있습니다.'}
  ];
};

/* PartList 등록(구매품) */
SCENE['partlist_purchase_input']=function(){
  return [
   {id:'q_job', value:'', label:'제 번', tip:'PartList를 작성할 제번을 찾습니다.'},
   {act:'click', sel:BTN('search'), label:'검색', tip:'제번 목록이 채워집니다.'},
   {act:'click', sel:'#pbody tr', label:'제번 선택',
    tip:'등록된 <b>구매품 PartList</b>가 아래에 나옵니다.'},
   {id:'fProc', value:'A', label:'공정', tip:'이 부품이 속한 공정.'},
   {id:'fPart', value:'B17', label:'품번', tip:'표준부품 코드.'},
   {id:'fName', value:'BUTTON, DIE', label:'품명', tip:'품번을 넣으면 품명이 따라옵니다.'},
   {id:'fQty', value:'4', label:'수량', tip:'소요 수량. 발주 수량의 기준이 됩니다.'},
   {id:'fSpec', value:'φ32 × L45', label:'규격', tip:'구매 사양. 발주서에 그대로 나갑니다.'},
   {act:'note', sel:BTN('save'), label:'저장',
    tip:'<b>[▤ 저장]</b>하면 구매품 발주 화면의 자재표에 나타납니다.'}
  ];
};

/* PartList 복사 */
SCENE['partlist_copy']=function(){
  return [
   {id:'srcJob', value:'PT005', label:'원본 제번',
    tip:'가져올 원본 제번. <b>비슷한 금형을 만들 때</b> PartList를 통째로 복사해 시간을 아낍니다.'},
   {id:'srcProc', value:'A', label:'원본 공정', tip:'특정 공정만 복사하려면 지정합니다. 비우면 전 공정입니다.'},
   {id:'dstJob', value:'ABC6099', label:'대상 제번', tip:'복사해 넣을 새 제번.'},
   {id:'dstProc', value:'A', label:'대상 공정', tip:'대상 공정. 원본과 다르게 지정할 수 있습니다.'},
   {act:'note', sel:BTN('copyPartList'), label:'복사',
    tip:'<b>[⧉ 복사]</b>를 누르면 원재료·구매품 PartList가 함께 복사되고, 결과가 아래 로그에 남습니다. '
       +'복사 후 반드시 <b>규격·수량을 실물에 맞게 수정</b>하세요.'}
  ];
};

/* 외주설계 발주등록 */
SCENE['outsourced_design_order_input']=function(){
  return [
   {id:'jobQ', value:'', label:'제 번', tip:'외주설계를 맡길 제번을 찾습니다.'},
   {act:'click', sel:BTN('search'), label:'검색', tip:'제번과 설계공정 풀이 채워집니다.'},
   {act:'click', sel:'#jobBody tr', label:'제번 선택',
    tip:'그 제번의 <b>설계 세부공정</b>이 아래에 나옵니다. 설계계획등록에서 만든 목록입니다.'},
   {act:'click', sel:'#venBody tr', label:'설계업체 선택',
    tip:'외주설계 파트너를 고릅니다.'},
   {act:'check', sel:'#poolBody input[type=checkbox]', n:2, label:'발주 공정',
    tip:'맡길 세부공정에 체크합니다. 레이아웃만 외주 주고 부품도는 사내에서 하는 식으로 나눌 수 있습니다.'},
   {act:'click', sel:BTN('addRow'), label:'⬇ 발주추가',
    tip:'선택한 공정이 아래 발주 목록으로 내려옵니다. 여기서 견적가를 입력합니다.'},
   {act:'note', sel:BTN('save'), label:'발주등록',
    tip:'<b>[▣ 발주등록]</b>하면 외주설계 입고 화면에 나타납니다. '
       +'외주설계는 진척률(%)로 기성을 관리하므로 입고 시 <b>진행률</b>을 넣습니다.'}
  ];
};

/* 외주설계 발주입고 */
SCENE['outsourced_design_receipt_input']=function(){
  return [
   {id:'jobQ', value:'', label:'제 번', tip:'입고 처리할 제번을 찾습니다.'},
   {act:'click', sel:BTN('search'), label:'검색', tip:'발주된 외주설계 건이 나옵니다.'},
   {act:'check', sel:'#ordBody input[type=checkbox]', n:2, label:'입고 대상 선택',
    tip:'도면을 받은 공정에 체크합니다.'},
   {act:'note', sel:BTN('receive'), label:'입고처리',
    tip:'<b>[▣ 입고처리]</b>를 누르면 아래 입고 목록으로 내려갑니다. '
       +'외주설계는 <b>진행률(%)</b>로 부분 기성을 처리할 수 있습니다. 50%씩 두 번에 나눠 넣는 식입니다.'}
  ];
};

/* ══ 영업관리 · SET 발주 ═══════════════════════════════ */

SCENE['set_order_registration']=function(){
  return [
   {id:'q_job', value:'', label:'제 번', tip:'SET 외주로 제작할 제번을 찾습니다.'},
   {act:'click', sel:BTN('search'), label:'검색', tip:'제번 목록이 채워집니다.'},
   {act:'click', sel:'#hbody tr', label:'제번 선택',
    tip:'행을 클릭하면 그 제번의 <b>SET 발주 내역</b>이 아래에 나옵니다.'},
   {act:'click', sel:'#vbody tr', label:'협력업체 선택',
    tip:'금형 한 세트를 통째로 맡길 업체를 고릅니다.'},
   {id:'fSeq', value:'1', label:'SET 순번',
    tip:'한 제번을 여러 SET으로 나눠 맡길 때의 순번입니다.'},
   {id:'fProc', value:'A', label:'공정', tip:'이 SET이 담당할 공정.'},
   {id:'fOdate', value:D(-1), label:'발주일', tip:'발주 일자.'},
   {id:'fRdate', value:D(30), label:'요구일', tip:'납품 요구일. 납기 관리 기준입니다.'},
   {id:'fQuote', value:'12000000', label:'견적가', tip:'업체 견적 금액.'},
   {id:'fNego', value:'5', label:'네고율(%)', tip:'인하율. 확정금액이 자동 계산됩니다.'},
   {act:'note', sel:BTN('save'), label:'저장',
    tip:'<b>[▤ 저장]</b>하면 SET발주현황과 SET발주입고 화면에 나타납니다.'}
  ];
};

SCENE['set_order_receipt']=function(){
  return [
   {id:'q_job', value:'', label:'제 번', tip:'입고 처리할 제번을 찾습니다.'},
   {act:'click', sel:BTN('search'), label:'검색', tip:'SET 발주된 제번이 나옵니다.'},
   {act:'click', sel:'#hbody tr', label:'제번 선택',
    tip:'그 제번의 SET 발주 내역이 아래에 펼쳐집니다.'},
   {act:'check', sel:'#dbody input[type=checkbox]', n:1, label:'입고 대상 선택',
    tip:'납품된 SET에 체크합니다.'},
   {act:'note', sel:BTN('receive'), label:'입고처리',
    tip:'<b>[▣ 입고처리]</b>로 입고를 확정합니다. 잘못했으면 <b>[↶ 입고취소]</b>로 되돌리세요.'}
  ];
};

/* ══ 설계·조립 실적 ════════════════════════════════════ */

SCENE['design_result_input']=function(){
  return [
   {id:'qJob', value:'', label:'제 번', tip:'실적을 올릴 제번을 찾습니다.'},
   {act:'click', sel:BTN('search'), label:'검색', tip:'설계계획이 등록된 제번이 나옵니다.'},
   {act:'click', sel:'#hbody tr', label:'제번 선택',
    tip:'그 제번의 <b>설계 세부공정</b>이 가운데 목록에 나옵니다.'},
   {act:'click', sel:'#sbody tr', label:'세부공정 선택',
    tip:'실적을 올릴 작업을 고릅니다. 오른쪽에 지금까지의 실적이 표시됩니다.'},
   {id:'fDate', value:D(0), label:'작업일', tip:'실제 작업한 날.'},
   {id:'fMin', value:'240', label:'작업시간(분)',
    tip:'투입 시간을 <b>분 단위</b>로 넣습니다. 240분 = 4시간. 설계실적현황에서 월별로 집계됩니다.'},
   {id:'fWorker', value:'이태윤', label:'작업자', tip:'실제 작업한 사람.'},
   {act:'note', sel:BTN('addResult'), label:'실적 등록',
    tip:'<b>[실적 등록]</b>으로 한 줄이 추가됩니다. 하루에 여러 번 나눠 올려도 됩니다.'},
   {act:'note', sel:BTN('doneStep'), label:'완료 처리',
    tip:'작업이 끝나면 <b>[세부공정 완료]</b>, 설계 전체가 끝나면 <b>[설계 완료]</b>를 누릅니다. '
       +'설계 완료가 되어야 다음 단계로 넘어갑니다.'}
  ];
};

SCENE['assembly_result_input']=function(){
  return [
   {id:'jobQ', value:'', label:'제 번', tip:'조립 실적을 올릴 제번을 찾습니다.'},
   {act:'click', sel:BTN('search'), label:'검색', tip:'조립 대상 제번이 나옵니다.'},
   {act:'click', sel:'#jobBody tr', label:'제번 선택',
    tip:'그 제번의 <b>조립 공정</b>이 가운데 목록에 나옵니다.'},
   {act:'click', sel:'#procBody tr', label:'공정 선택',
    tip:'실적을 올릴 조립 공정을 고릅니다.'},
   {id:'workDate', value:D(0), label:'작업일', tip:'실제 작업한 날.'},
   {id:'minutes', value:'180', label:'작업시간(분)', tip:'투입 시간을 분 단위로. 180분 = 3시간.'},
   {act:'note', at:'#worker', label:'작업자',
    tip:'사원 목록에서 실제 작업한 사람을 고릅니다. 사용자정보에 등록된 인원만 나옵니다.'},
   {act:'note', sel:BTN('addResult'), label:'실적 등록',
    tip:'<b>[실적 등록]</b>으로 실적이 쌓입니다.'},
   {act:'note', sel:BTN('completeStep'), label:'완료 · 검사',
    tip:'<b>[세부공정 완료]</b> → <b>[조립 완료]</b> 순으로 마감합니다. '
       +'<b>[검사시트 작성/수정]</b>으로 조립검사 결과를 함께 남기면 SQ 검사실적에 반영됩니다.'}
  ];
};

/* ══ 기준정보 ═════════════════════════════════════════ */

/* 사용자정보 */
SCENE['user_information']=function(){
  return [
   {act:'click', sel:BTN('registerUser'), label:'① 신규 사용자 등록',
    tip:'<b>[＋ 신규 사용자 등록]</b>을 누르면 오른쪽 입력란이 비워지고 새 계정을 만들 준비가 됩니다.'},
   {id:'d_user_id', value:'kim.ms', label:'아이디',
    tip:'로그인 아이디. <b>등록 후에는 바꾸지 않는 것</b>이 좋습니다. 권한·이력이 이 값으로 묶입니다.'},
   {id:'d_name', value:'김민수', label:'성명',
    tip:'실적등록·발주·검사 화면의 담당자 목록에 이 이름으로 나옵니다.'},
   {id:'d_auth_email', value:'kim.ms@ipmes.demo', label:'로그인메일',
    tip:'<b>실제 로그인에 쓰는 계정</b>입니다. 회사 메일이 없으면 사내 규칙대로 임의 주소를 부여해도 됩니다.'},
   {id:'d_email', value:'kim.ms@donggu.co.kr', label:'이메일',
    tip:'연락용 메일. 로그인메일과 달라도 됩니다.'},
   {id:'d_department', value:'생산관리팀', label:'부서',
    tip:'기준정보 › 부서정보에 등록된 부서명을 씁니다. 부서별 조회·집계의 기준입니다.'},
   {id:'d_position', value:'대리', label:'직급',
    tip:'기준정보 › 직급정보에 등록된 직급.'},
   {id:'d_employee_no', value:'20300', label:'사원번호',
    tip:'사원 자격등록·교육이력과 연결되는 번호입니다. 인사 사번과 맞추세요.'},
   {id:'d_mobile', value:'010-2345-6789', label:'휴대폰번호',
    tip:'현장 연락용.'},
   {id:'d_registered', value:D(0), label:'등록일',
    tip:'계정 개설일.'},
   {act:'note', at:'#d_role', label:'권한역할',
    tip:'<b>user</b>=일반, <b>admin</b>=관리자, <b>master</b>=최고관리자. '
       +'master는 발급 비밀번호 조회까지 가능하므로 <b>꼭 필요한 인원에게만</b> 부여하세요.'},
   {act:'note', at:'#d_active', label:'사용여부',
    tip:'체크를 <b>해제하면 로그인이 차단</b>되고 목록에서 숨겨집니다. 퇴사자는 삭제하지 말고 여기를 해제하세요. 이력이 보존됩니다.'},
   {act:'note', sel:BTN('saveUser'), label:'② 저장',
    tip:'<b>[▣ 저장]</b>을 누르면 계정이 만들어지고 임시 비밀번호가 발급됩니다.'},
   {act:'note', sel:'.permission-list', label:'③ 권한 체크',
    tip:'아래 권한 트리에서 메뉴별로 <b>조회 / 저장 / 수정 / 삭제</b>를 체크합니다. '
       +'조회를 끄면 그 메뉴는 좌측 트리에서 아예 보이지 않습니다.'},
   {act:'note', sel:BTN('savePermissions'), label:'④ 권한저장',
    tip:'<b>[🔒 권한저장]</b>을 눌러야 반영됩니다. 사용자 저장과 권한 저장은 <b>별개의 버튼</b>입니다.'},
   {act:'note', sel:BTN('copyPermissions'), label:'⑤ 권한복사 · 비밀번호',
    tip:'같은 역할의 다른 사용자에게는 <b>[⧉ 권한복사]</b>로 한 번에 부여합니다. '
       +'비밀번호를 잊었다면 <b>[🔑 비밀번호 재설정]</b>으로 임시 비밀번호를 다시 발급하세요.'}
  ];
};

/* 가공 기준공정관리 */
SCENE['machining_standard_process']=function(){
  return [
   {id:'filterName', value:'', label:'기준공정명',
    tip:'기존 기준공정을 찾을 때 씁니다. <b>비우면 전체 조회</b>입니다.'},
   {act:'click', sel:BTN('search'), label:'검색',
    tip:'등록된 기준공정이 위 목록에 나옵니다. 각 행의 오른쪽에 그 기준공정의 공정 순서가 보입니다.'},
   {act:'click', sel:BTN('clearForm'), label:'① 신규',
    tip:'<b>[□ 신규]</b>로 입력란을 비웁니다. 기존 것을 고치려면 위 목록에서 행을 클릭하세요.'},
   {id:'editId', value:'S1', label:'기준공정ID',
    tip:'기준공정을 구분하는 ID. 가공계획·공정이력카드가 이 ID로 공정을 전개합니다.'},
   {id:'editName', value:'표준 코어가공', label:'기준공정명',
    tip:'어떤 유형의 부품에 쓰는 순서인지 알아볼 수 있게 짓습니다. (예: 표준 코어가공, 대형 캐비티)'},
   {id:'editOwner', value:'김민수', label:'담당자',
    tip:'이 기준공정을 관리하는 사람.'},
   {act:'note', sel:'#waitingBody', label:'② 대기 공정 선택',
    tip:'왼쪽 <b>대기 공정 리스트</b>에서 넣을 공정을 체크합니다. 여기 목록은 <b>기준정보 › 가공공정관리</b>에 등록된 공정입니다.'},
   {act:'note', sel:'button[onclick="moveRight()"]', label:'③ ▶ 추가',
    tip:'<b>[▶]</b>를 누르면 오른쪽 <b>적용 공정 리스트</b>로 넘어갑니다. '
       +'<b>넘긴 순서가 곧 작업 순서</b>이므로 실제 가공 순서대로 하나씩 넘기세요.'},
   {act:'note', sel:'button[onclick="moveLeft()"]', label:'④ ◀ 제거',
    tip:'잘못 넣은 공정은 오른쪽에서 체크하고 <b>[◀]</b>로 빼냅니다.'},
   {act:'note', sel:BTN('save'), label:'⑤ 저장',
    tip:'<b>[▣ 저장]</b>하면 완성입니다. 이후 <b>작업지시 관리</b>의 [⚙ 기준공정 전개]와 <b>공정이력카드</b>가 이 순서를 그대로 펼칩니다.'}
  ];
};

/* 작업지시 관리 */
SCENE['work_order_input']=function(){
  return [
   {id:'itemSearch', value:'', label:'품목 정보',
    tip:'품번·품명 일부로 대상을 좁힙니다. 비우면 전체 조회입니다.'},
   {act:'click', sel:BTN('doSearch'), label:'검색',
    tip:'왼쪽 <b>[제번 정보]</b>에 대상 제번이 나옵니다. 지시건수·진행/완료로 진행 상황이 함께 보입니다.'},
   {act:'click', sel:'#masterBody tr', label:'제번 선택',
    tip:'행을 클릭하면 오른쪽 <b>[작업지시 정보]</b>가 그 제번 기준으로 바뀝니다.'},
   {act:'note', sel:'button[onclick="openLook(\'std\',-1)"]', label:'① 기준공정 전개',
    tip:'<b>[⚙ 기준공정 전개]</b>를 누르고 기준공정을 고르면 공정이 <b>순서대로 한 번에 펼쳐집니다.</b> '
       +'기준정보 › 가공 기준공정관리에 등록해 둔 순서가 그대로 옵니다.'},
   {act:'note', sel:BTN('addOrder'), label:'② 지시등록',
    tip:'한 줄씩 넣을 때는 <b>[＋ 지시등록]</b>으로 빈 행을 만듭니다. '
       +'작업지시일자·부품명·작업장·공정·작업자·지시량을 표 안에서 직접 입력합니다.'},
   {act:'note', sel:'#detailBody', label:'③ 조회 버튼',
    tip:'작업장코드·공정코드 칸의 <b>작은 […] 버튼</b>을 누르면 조회 팝업이 뜹니다. '
       +'직접 타이핑하지 말고 <b>목록에서 고르세요.</b> 코드가 틀리면 실적·원가가 붙지 않습니다.'},
   {act:'note', sel:BTN('saveOrders'), label:'④ 저장',
    tip:'<b>[▣ 저장]</b>하면 작업지시가 확정됩니다. 수정한 행은 <b>노란 밑줄</b>로 표시되니 저장 전에 확인하세요.'},
   {act:'note', sel:BTN('deleteOrder'), label:'⑤ 삭제 · 다음 단계',
    tip:'잘못 낸 지시는 행을 선택하고 <b>[✖ 지시삭제]</b>. '
       +'저장된 작업지시는 <b>공정이력카드</b>에서 카드로 발행해 제품과 함께 현장에 내보냅니다.'}
  ];
};

/* 공정이력카드 */
SCENE['process_history_card']=function(){
  return [
   {id:'qJob', value:'', label:'제번',
    tip:'카드를 발행할 제번. <b>작업지시가 저장된 제번</b>이라야 공정이 전개됩니다.'},
   {id:'qProc', value:'', label:'공정',
    tip:'특정 공정만 볼 때 입력합니다. 비우면 전체 공정이 나옵니다.'},
   {id:'qPart', value:'', label:'품번',
    tip:'부품 단위로 카드를 낼 때 품번을 지정합니다.'},
   {act:'click', sel:BTN('loadCard'), label:'① 카드조회',
    tip:'<b>[⌕ 카드조회]</b>를 누르면 기준공정이 전개된 카드가 <b>미리보기</b>로 그려집니다. 아직 발행 전이라 카드번호는 비어 있습니다.'},
   {act:'note', sel:'#planRows', label:'② 내용 확인',
    tip:'제번·품번·수량·공정 순서가 맞는지 확인합니다. 틀렸으면 <b>작업지시 관리</b>에서 먼저 고치고 다시 조회하세요.'},
   {act:'note', sel:BTN('issueCard'), label:'③ 카드발행',
    tip:'<b>[▣ 카드발행]</b>을 누르면 <b>카드번호가 확정되고 QR코드가 새겨집니다.</b> '
       +'발행 시점의 공정 순서가 그대로 스냅샷으로 저장됩니다.'},
   {act:'note', sel:'button[onclick="goPage(2)"]', label:'④ 2페이지 검사기록',
    tip:'<b>[▶|]</b>로 2페이지를 보면 <b>검사기록란(최대 4회차)</b>이 있습니다. 검사실적등록에 입력한 값이 여기에 채워집니다.'},
   {act:'note', sel:'button[onclick="window.print()"]', label:'⑤ 인쇄 · 운용',
    tip:'<b>[🖨]</b>로 출력해 제품과 함께 이동시킵니다. 현장에서는 공정 완료 시마다 완료일과 검사값을 기재하고 다음 공정으로 인계합니다.'}
  ];
};

/* 검사실적등록 */
SCENE['inspection_result_input']=function(){
  return [
   {id:'jobQ', value:'', label:'제 번',
    tip:'제번·품번·업체 일부로 검사 대상을 좁힙니다. 비우면 전체입니다.'},
   {act:'note', at:'#onlyWait', label:'미검사만',
    tip:'체크해 두면 <b>아직 검사하지 않은 건만</b> 나옵니다. 평소에는 켜 두는 것이 편합니다.'},
   {act:'click', sel:BTN('search'), label:'조회',
    tip:'입고된 자재·구매품·외주품 중 <b>검사 대기 건</b>이 위 목록에 나옵니다.'},
   {act:'click', sel:'#tgtBody tr', label:'검사 대상 선택',
    tip:'행을 클릭하면 아래 <b>[검사 정보]</b>에 제번·품번·업체·검사구분이 자동으로 채워집니다. 이 네 칸은 <b>수정할 수 없습니다.</b>'},
   {id:'fDate', value:D(0), label:'검사일',
    tip:'실제 검사한 날. KPI 집계는 이 날짜가 속한 달로 잡힙니다.'},
   {act:'note', at:'#fInsp', label:'검사자',
    tip:'검사자를 고릅니다. <b>검사원 자격이 만료된 사람</b>이 올린 실적은 심사에서 지적됩니다. 옆에 경고가 뜨면 자격부터 갱신하세요.'},
   {id:'fLot', value:'50', label:'로트수량',
    tip:'이번에 입고된 전체 수량.'},
   {id:'fSample', value:'5', label:'샘플수량',
    tip:'실제로 측정한 개수. 검사구분에 정해둔 샘플링 기준을 따릅니다.'},
   {id:'fDefect', value:'0', label:'불량수량',
    tip:'샘플 중 불량 개수. <b>0보다 크면 판정을 다시 검토</b>하세요.'},
   {act:'note', sel:'#sheetBody', label:'① 체크시트 입력',
    tip:'오른쪽 <b>검사 체크시트</b>에 검사항목이 행으로 펼쳐집니다. 항목별 <b>측정값</b>을 넣고 결과를 OK/NG로 판정합니다. '
       +'항목은 기준정보 › 검사항목에 등록된 것만 나옵니다.'},
   {act:'note', sel:'button[onclick="markAll(\'OK\')"]', label:'② 일괄 판정',
    tip:'전수 OK인 경우 <b>[전체 OK]</b>로 한 번에 처리할 수 있습니다. 항목 판정이 정해지면 <b>종합판정이 자동 계산</b>됩니다.'},
   {act:'note', sel:BTN('saveInspection'), label:'③ 검사저장',
    tip:'<b>[▣ 검사저장]</b>으로 기록을 남깁니다. 이 기록이 <b>공정이력카드 2페이지</b>의 검사란에도 나타납니다.'},
   {act:'note', sel:BTN('passLine'), label:'④ 합격 / 불합격',
    tip:'합격이면 <b>[✔ 합격/입고확정]</b> — 입고확정까지 한 번에 처리되어 제조원가에 잡힙니다. '
       +'불량이면 <b>[✖ 불합격/반품]</b> — <b>부적합이 자동 생성</b>되므로 SQ에서 따로 등록하지 마세요.'}
  ];
};

window.MESSCENE=SCENE;
})();
