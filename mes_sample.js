/* mes_sample.js — SQ 등록화면 '등록예제보기' 공용 모듈
   상단 입력란에 즉시 사용 가능한 예시값을 채웁니다. 저장은 하지 않습니다. */
(function(){
'use strict';

/* ── 헬퍼 ───────────────────────────────────────────── */
function D(off){                       // 오늘 기준 오프셋 일자 → 'YYYY-MM-DD'
  const d=new Date(); d.setDate(d.getDate()+(off||0));
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
const REF={__ref:1};                   // 조회목록(fillRef) 선택형: 첫 번째 실제 항목 선택
function ref(){return REF}
function day(n){return {__day:n}}
function seq(p){return {__seq:p}}      // 중복 방지용 번호: p + YYMMDD + -S + 2자리

function gridKeys(){                    // 목록에 이미 있는 값들(중복 방지용)
  const set=new Set();
  document.querySelectorAll('#body tr td, tbody tr td').forEach(td=>{
    const t=(td.textContent||'').trim(); if(t) set.add(t);
  });
  return set;
}
function bumpTail(v){                  // 끝자리 +1 ('...-001'→'-002', 'KPI11'→'KPI12', 'B'→'C')
  const t=String(v);
  const m=/^(.*?)(\d+)$/.exec(t);
  if(m) return m[1]+String(Number(m[2])+1).padStart(m[2].length,'0');
  const a=/^(.*?)([A-Y])$/.exec(t);   // 개정기호: 알파벳 다음 글자 (Z 제외)
  if(a) return a[1]+String.fromCharCode(a[2].charCodeAt(0)+1);
  return t+'2';
}
function nextSeq(prefix){
  const d=new Date();
  const b=prefix+String(d.getFullYear()).slice(2)
    +String(d.getMonth()+1).padStart(2,'0')
    +String(d.getDate()).padStart(2,'0')+'-S';
  const used=gridKeys();
  for(let n=1;n<=99;n++){ const v=b+String(n).padStart(2,'0'); if(!used.has(v)) return v }
  return b+'99';
}
function fire(el){
  el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
}

function setVal(id,v){
  const el=document.getElementById(id); if(!el) return false;
  if(v&&v.__day!==undefined) v=D(v.__day);
  else if(v&&v.__seq!==undefined) v=nextSeq(v.__seq);
  if(el.tagName==='SELECT'){
    if(v===REF||(v&&v.__ref)){                 // 조회목록: 값이 있는 첫 옵션
      let i=-1;
      for(let k=0;k<el.options.length;k++){ if(String(el.options[k].value||'').trim()){i=k;break} }
      if(i<0) return false;
      el.selectedIndex=i;
    }else{
      const t=String(v);
      let ok=false;
      for(let k=0;k<el.options.length;k++){
        if(el.options[k].value===t||el.options[k].text===t){el.selectedIndex=k;ok=true;break}
      }
      if(!ok) return false;
    }
  }else if(el.type==='checkbox'){
    el.checked=(v===true||v==='Y'||v==='true'||v===1);
  }else{
    if(v===REF||(v&&v.__ref)) return false;
    el.value=String(v);
  }
  fire(el);
  return true;
}

/* ── 화면별 예시값 ──────────────────────────────────── */
/* 읽기전용(자동계산) 칸은 넣지 않습니다: 목표키·지적번호·관리번호·개정키·총점·등급 등 */
const S={

/* 품질목표 */
'quality_kpi_target_input':{
  _tips:{
    year:'목표는 <b>연도별</b>로 관리합니다. 해가 바뀌면 새로 등록해야 실적이 집계됩니다.',
    code:'회사에서 정한 지표 코드. 소문자로 넣어도 대문자로 바뀝니다.',
    name:'현황·추이 화면에 그대로 표시되는 이름입니다.',
    unit:'단위에 따라 달성 판정 표시가 달라집니다.',
    target:'달성 여부를 가르는 기준값입니다.',
    dir:'<b>up</b>=클수록 좋음(준수율), <b>down</b>=작을수록 좋음(부적합 건수).',
    owner:'이 지표를 책임지는 부서. 회의에서 설명할 주체입니다.',
    sort:'현황·추이 화면의 표시 순서. 10단위로 띄워 사이에 끼울 여지를 둡니다.',
    remark:'산출식을 적어두면 다음 담당자가 헤매지 않습니다.'
  },
  _bump:'code',
  year:new Date().getFullYear(), code:'KPI11', name:'설비 가동률', unit:'%',
  target:85, dir:'up', owner:'생산팀', sort:110,
  remark:'가동시간 ÷ 계획시간 × 100 (MCT 기준)'
},

/* 심사 */
'quality_audit_input':{
  _tips:{
    ano:'심사 한 건의 고유번호. 지적사항이 이 번호로 붙습니다.',
    dir:'<b>수감</b>=우리가 받는 심사, <b>실시</b>=우리가 협력업체를 심사.',
    atype:'심사 성격. 현황 화면의 분류 기준이 됩니다.',
    adate:'심사 시작일.',
    edate:'하루짜리면 시작일과 같게 둡니다.',
    std:'어떤 기준서로 평가했는지 남깁니다.',
    org:'심사를 나온 기관 또는 고객사.',
    auditor:'상대측 심사원 이름.',
    vendor:'<b>실시</b> 심사일 때만 피심사 업체를 넣습니다.',
    lead:'우리측 대응 책임자.',
    score:'획득 점수.',
    maxscore:'만점 기준.',
    grade:'점수에 따른 등급.',
    result:'조건부합격이면 지적사항 조치가 필수입니다.',
    next:'차기 심사 예정일. 임박하면 현황에 알림이 뜹니다.',
    scope:'어느 공정·부서까지 봤는지 적습니다.',
    report:'심사 보고서 문서번호.',
    status:'조치가 다 끝나면 완료로 바꿉니다.',
    remark:'후속 관리 메모.'
  },
  ano:seq('QA'), dir:'수감', atype:'1차사 정기심사',
  adate:day(-7), edate:day(-6), std:'SQ 심사표',
  org:'현대모비스', auditor:'김심사', vendor:'', lead:'한서준',
  score:86, maxscore:100, grade:'B', result:'조건부합격', next:day(358),
  scope:'설계·가공·조립 전공정 (SQ 심사표 12개 분야)',
  report:'RPT-'+new Date().getFullYear()+'-01', status:'완료',
  url:'', remark:'지적 2건(Major 1, Minor 1) — 지적사항등록에서 후속 관리'
},
'audit_finding_input':{
  _tips:{
    ano:'어느 심사에서 나온 지적인지 고릅니다. 목록은 심사등록에서 채워집니다.',
    item:'기준서의 항목번호를 그대로 적습니다.',
    area:'지적 분야. 반복 지적 분야를 찾는 데 쓰입니다.',
    grade:'<b>Major</b>는 시스템 결함, <b>Minor</b>는 부분 미흡.',
    owner:'조치를 책임질 사람.',
    due:'이 날짜가 지나면 현황에 <b>기한초과</b>로 뜹니다.',
    status:'조치 진행에 맞춰 갱신합니다.',
    req:'무엇을 요구하는 조항인지 씁니다.',
    desc:'현상을 사실 그대로. 원인 추측은 넣지 않습니다.',
    evid:'객관적 증거. 몇 건, 어느 기록인지 구체적으로.',
    plan:'무엇을 언제까지 어떻게 할지.',
    remark:'저장하면 <b>시정조치서(CAR)가 자동 발행</b>됩니다.'
  },
  ano:ref(), item:'4.2', area:'가공공정관리', grade:'Major',
  owner:'한서준', due:day(21), done:'', status:'조치중',
  req:'관리계획서에 정한 검사주기를 준수할 것',
  desc:'관리계획서상 초물+주기 검사 대상 공정에서 주기검사 기록이 누락됨',
  evid:'6월 검사일지 3건 미기록 (LM1 공정)',
  plan:'검사주기 알림 적용 및 검사원 재교육 실시',
  verify:'', remark:'시정조치서는 저장 시 자동 발행됩니다'
},

/* 고객요구사항 */
'customer_requirement_input':{
  _tips:{
    rno:'요구사항 접수번호.',
    rdate:'고객 문서를 받은 날. 경과일 계산 기준입니다.',
    cust:'요구를 보낸 고객사.',
    rtype:'요구 성격에 따라 전개 방식이 달라집니다.',
    title:'한 줄 요약. 목록에 이 제목이 보입니다.',
    src:'고객 공문번호. 추후 소명 근거가 됩니다.',
    job:'해당하는 제번이 있으면 연결합니다.',
    mold:'대상 금형 종류.',
    receiver:'우리측 접수 담당자.',
    reviewer:'기술 검토를 한 사람.',
    rvdate:'검토 완료일.',
    result:'수용 여부. 불가면 회신 근거를 비고에 남깁니다.',
    doc:'어느 사내 문서에 반영했는지 연결합니다. 이게 전개의 증거입니다.',
    deploy:'협력업체까지 알려야 하면 Y.',
    ddate:'업체 전개일.',
    apply:'현장 적용 시작일.',
    status:'드롭다운 값만 쓰세요. 임의 문구는 알림이 오작동합니다.',
    vendors:'전개한 업체를 쉼표로 나열합니다.',
    content:'요구 원문을 요약해 적습니다.',
    remark:'처리 경과 메모.'
  },
  rno:seq('CR'), rdate:day(-20), cust:'현대모비스', rtype:'검사기준',
  title:'공정검사 주기 강화 요청',
  src:'SQ-'+new Date().getFullYear()+'-011',
  job:'PT005', mold:'프레스', receiver:'한서준',
  reviewer:'권소율', rvdate:day(-15), result:'수용',
  doc:ref(), deploy:'Y', ddate:day(-10), apply:day(-5), status:'완료',
  vendors:'대현정밀가공, 동방열처리',
  content:'수입검사 전수 → 공정 중 3회 샘플링으로 검사방식 변경 요청. 관리계획서 및 검사기준서 반영 필요.',
  remark:'사내 절차서 개정 후 협력업체 전개 완료'
},

/* 부적합 · 시정조치 */
'nonconformance_input':{
  _tips:{
    ncno:'부적합 한 건의 번호.',
    ncdate:'발견한 날. 월별 KPI 집계 기준입니다.',
    ncsrc:'<b>고객클레임</b>으로 넣은 건만 클레임 KPI에 잡힙니다.',
    job:'해당 제번.',
    part:'품번.',
    pname:'품명.',
    proc:'어느 공정에서 났는지.',
    vendor:'외부 원인이면 업체를 넣습니다. 협력업체 평가 근거가 됩니다.',
    dtype:'불량 유형. 반복 유형 분석에 쓰입니다.',
    lotqty:'검사 대상 전체 수량.',
    defqty:'그중 불량 수량.',
    disp:'현품을 어떻게 처리했는지.',
    reporter:'발견·보고한 사람.',
    status:'조치 진행에 맞춰 갱신합니다.',
    desc:'현상과 측정값을 구체적으로.',
    remark:'검사 불합격 저장 시 이 화면에 <b>자동 등록</b>되기도 합니다.'
  },
  ncno:seq('NC'), ncdate:day(-10), ncsrc:'수입검사',
  job:'PT005', part:'C26D', pname:'코어 핀', proc:'LM1', vendor:'대현정밀가공',
  dtype:'치수불량', lotqty:20, defqty:3, disp:'반품',
  reporter:'한서준', status:'조치중', closedate:'',
  desc:'외경 φ32 h7 공차 초과(+0.05). 20개 중 3개 불량.',
  remark:'치공구 마모 추정 — 시정조치 진행중'
},
'corrective_action_input':{
  _tips:{
    carno:'시정조치서 번호.',
    ncno:'어느 부적합에 대한 조치인지 고릅니다.',
    issuedate:'시정조치 착수일.',
    owner:'조치 책임자.',
    due:'기한. <b>완료일 ≤ 기한</b> 이라야 KPI에 준수로 잡힙니다.',
    status:'완료로 바꾸기 전에 완료일과 검증결과를 채우세요.',
    cause:'현상이 왜 생겼는지.',
    root:'왜 막지 못했는지 — 관리 체계의 문제를 씁니다.',
    plan:'재발을 막을 구체적 조치.',
    deploy:'같은 문제가 날 수 있는 곳까지 확대 적용.',
    remark:'효과 검증 방법을 적어두면 좋습니다.'
  },
  carno:seq('CAR'), ncno:ref(), fno:'', issuedate:day(-8),
  owner:'권소율', due:day(14), done:'', effective:'', status:'진행',
  cause:'가공 치공구 마모로 외경이 점진적으로 커짐',
  root:'치공구 정기점검 주기(3개월)를 초과하여 운용',
  plan:'치공구 교체주기를 3개월 → 1개월로 단축, 점검표에 반영',
  verify:'', deploy:'동일 부품군(핀류) 전 공정 확대 적용',
  remark:'효과 검증은 다음 로트 전수검사로 확인 예정'
},

/* 4M 변경 */
'change_request_input':{
  _tips:{
    chno:'4M 변경 신청번호.',
    rdate:'신청일. 고객승인 소요일 계산의 시작점입니다.',
    ctype:'사람·설비·재료·방법 중 무엇이 바뀌는지.',
    cclass:'<b>영구</b>는 계속, <b>일시</b>는 한시 적용.',
    job:'대상 제번.',
    part:'품번.',
    pname:'품명.',
    vendor:'외주에서 바뀌면 업체를 넣습니다.',
    customer:'통보할 고객사.',
    before:'바꾸기 전 상태를 구체적으로.',
    after:'바꾼 뒤 상태.',
    reason:'왜 바꾸는지.',
    effect:'품질에 미칠 영향과 검증 방법. 심사에서 반드시 봅니다.',
    requester:'신청자.',
    approver:'사내 승인자.',
    adate:'사내 승인일.',
    notified:'고객에게 알렸으면 Y.',
    ndate:'통보일.',
    capno:'고객 승인번호.',
    cadate:'고객 승인일. 신청일과의 차이가 KPI가 됩니다.',
    apply:'현장 적용일. <b>고객 승인 전에는 넣지 마세요.</b>',
    status:'진행 단계에 맞춰 올립니다.',
    remark:'도면·문서 개정 연계 메모.'
  },
  chno:seq('CH'), rdate:day(-14), ctype:'Machine(설비)', cclass:'영구',
  job:'PT005', part:'C26D', pname:'코어 핀', vendor:'대현정밀가공', customer:'현대모비스',
  before:'MCT-3호기 (2015년식)', after:'MCT-7호기 (2024년식)',
  reason:'3호기 위치결정 정도 저하로 공차 확보 곤란',
  effect:'초·중·종물 전수검사 실시, 공정능력(Cpk) 재평가 후 양산 적용',
  requester:'권소율', approver:'한서준', adate:day(-12),
  notified:'Y', ndate:day(-11),
  capno:'MOB-CH-0042', cadate:day(-6), apply:day(-5), status:'고객승인',
  remark:'도면개정 및 관리계획서 개정 동시 진행'
},

/* 계측기 */
'gauge_management':{
  _tips:{
    code:'계측기 코드. 라벨에 붙일 번호입니다.',
    name:'현장에서 부르는 이름.',
    gtype:'종류별로 교정 방식이 다릅니다.',
    range:'측정 가능 범위.',
    reso:'최소 눈금. 관리규격의 1/10 이하여야 합니다.',
    maker:'제조사.',
    serial:'제조번호. 같은 모델 구분용.',
    loc:'어디에 두는지. 심사 때 바로 찾아야 합니다.',
    owner:'관리 책임자.',
    cycle:'교정 주기(개월).',
    gstatus:'수리중·폐기 계측기는 현장에서 빼세요.',
    use:'미사용은 N으로 두면 목록에서 걸러집니다.',
    remark:'교정일은 교정이력등록에서 자동으로 채워집니다.'
  },
  _bump:'code',
  code:'GA-S01', name:'디지털 캘리퍼스 150mm', gtype:'캘리퍼스',
  range:'0~150mm', reso:'0.01mm', maker:'Mitutoyo', serial:'MT-2026-0157',
  loc:'품질실 계측기보관함 A-2', owner:'권소율', cycle:12,
  gstatus:'사용', use:'Y',
  remark:'최근교정일·차기교정일은 교정이력등록 시 자동 갱신'
},
'gauge_calibration_input':{
  _tips:{
    calno:'교정 한 건의 번호.',
    gcode:'계측기대장에서 고릅니다. 이름은 자동으로 따라옵니다.',
    caldate:'교정 실시일.',
    nextdate:'차기 교정일. <b>비워두면 기한 관리가 안 됩니다.</b>',
    caltype:'외부 공인기관 교정인지 자체 교정인지.',
    agency:'교정 기관명.',
    certno:'교정성적서 번호. 원본은 별도 보관.',
    result:'불합격이면 즉시 사용을 중지합니다.',
    cost:'교정 비용. 연간 예산 산정에 씁니다.',
    inspector:'확인자.',
    remark:'저장하면 계측기대장의 차기교정일이 자동 갱신됩니다.'
  },
  calno:seq('CAL'), gcode:ref(), caldate:day(-2), nextdate:day(363),
  caltype:'외부교정', agency:'한국계측기술(주)',
  certno:'KC-'+new Date().getFullYear()+'-1121', result:'합격',
  cost:80000, inspector:'권소율',
  remark:'교정성적서 원본 품질실 보관'
},

/* 도면 */
'drawing_management':{
  _tips:{
    dno:'도면번호. 개정은 이 번호 아래로 쌓입니다.',
    dname:'도면 제목.',
    job:'해당 제번.',
    part:'품번.',
    pname:'품명.',
    mold:'금형 종류.',
    owner:'도면 관리 담당자.',
    status:'폐기 도면은 현장에서 회수합니다.',
    remark:'REV와 개정일은 도면개정등록에서 자동 갱신됩니다.'
  },
  _bump:'dno',
  dno:'DW-S001', dname:'C26D 코어 조립도', job:'PT005', part:'C26D', pname:'코어 핀',
  mold:'프레스', owner:'이태윤', status:'유효', url:'',
  remark:'REV/개정일은 도면개정등록 시 자동 갱신'
},
'drawing_revision_input':{
  _tips:{
    dno:'개정할 도면을 고릅니다.',
    rev:'새 개정기호. A 다음은 B입니다.',
    rdate:'개정일.',
    chno:'4M 변경 때문이라면 그 번호를 연결합니다.',
    approver:'개정 승인자.',
    obsolete:'구도면을 회수했으면 Y. <b>N이면 미회수 알림이 남습니다.</b>',
    dist:'새 도면을 어디에 배포했는지.',
    reason:'무엇을 왜 바꿨는지.',
    remark:'저장하면 도면등록의 현재 REV가 바뀝니다.'
  },
  _bump:'rev',
  dno:ref(), rev:'B', rdate:day(-3), chno:ref(),
  approver:'한서준', obsolete:'N', dist:'설계팀 / 가공팀 / 외주(대현정밀가공)',
  reason:'4M 설비변경(MCT-7호기)에 따른 위치공차 재설정',
  url:'', remark:'구도면 회수 후 회수확인 체크 필요'
},

/* 문서 */
'document_management':{
  _tips:{
    dno:'문서번호.',
    dname:'문서 제목.',
    dtype:'문서 계층. 매뉴얼 → 절차서 → 지침서 순입니다.',
    dclass:'보안 등급. 대외 제출 가능 여부를 가릅니다.',
    dept:'주관 부서.',
    owner:'문서 관리자.',
    enact:'최초 제정일.',
    cycle:'정기 검토 주기(개월). 넣어두면 검토 알림이 자동으로 뜹니다.',
    status:'폐지 문서는 현장에서 회수합니다.',
    loc:'원본 보관 위치.',
    remark:'REV·차기검토일은 제·개정등록에서 자동 갱신됩니다.'
  },
  _bump:'dno',
  dno:'QP-S05', dname:'공정검사 절차서', dtype:'절차서', dclass:'2급(사내)',
  dept:'품질팀', owner:'권소율', enact:day(-720), cycle:24,
  status:'유효', loc:'품질실 문서함 B-1', url:'',
  remark:'REV·개정일·차기검토일은 제·개정등록 시 자동 갱신'
},
'document_revision_input':{
  _tips:{
    dno:'개정할 문서를 고릅니다.',
    rev:'새 개정 차수.',
    rdate:'개정일.',
    rtype:'제정·개정·폐지 중 하나.',
    obsolete:'구본을 회수했으면 Y.',
    drafter:'기안자.',
    reviewer:'검토자.',
    approver:'승인자.',
    adate:'승인일.',
    chno:'4M 변경이 원인이면 연결.',
    fno:'심사 지적이 원인이면 연결합니다. <b>조치 근거가 됩니다.</b>',
    reason:'무엇을 왜 바꿨는지.',
    dist:'배포처와 부수.',
    remark:'저장하면 문서관리대장의 REV가 바뀝니다.'
  },
  _bump:'rev',
  dno:ref(), rev:'3', rdate:day(-6), rtype:'개정', obsolete:'N',
  drafter:'권소율', reviewer:'한서준', approver:'한서준', adate:day(-5),
  chno:ref(), fno:ref(),
  reason:'심사 지적사항 반영 — 검사주기 및 기록양식 명확화',
  dist:'전부서 (원본 품질실, 사본 현장 3부)', url:'',
  remark:'구본 회수 후 회수확인 체크 필요'
},

/* 추적성 */
'material_lot_input':{
  _tips:{
    lot:'소재 LOT 번호. 추적성의 출발점입니다.',
    rdate:'입고일.',
    mcode:'재질 코드.',
    mname:'재질명.',
    spec:'입고 규격(두께×폭×길이).',
    vendor:'공급 업체.',
    mill:'밀시트 번호. <b>빠뜨리면 추적이 끊깁니다.</b>',
    heat:'HEAT 번호. 같은 용탕 단위를 뜻합니다.',
    maker:'제강사.',
    qty:'입고 수량.',
    unit:'수량 단위.',
    job:'이 소재를 쓰는 제번.',
    part:'품번.',
    pname:'품명.',
    remark:'성적서등록에서 이 LOT을 골라 연결합니다.'
  },
  lot:seq('LOT'), rdate:day(-22), mcode:'HP4', mname:'HP4',
  spec:'T30 × W200 × L300', vendor:'대현정밀가공',
  mill:'MS-'+new Date().getFullYear()+'-0021', heat:'HT-88121', maker:'두산중공업',
  qty:5, unit:'EA', job:'PT005', part:'C26D', pname:'코어 핀', url:'',
  remark:'밀시트 원본 보관 — 성적서등록에서 이 LOT과 연결'
},
'certificate_input':{
  _tips:{
    certno:'성적서 번호.',
    ctype:'성적서 종류.',
    issuer:'발행처.',
    idate:'발행일.',
    lot:'어느 소재 LOT의 성적서인지 고릅니다. <b>이게 추적성의 고리입니다.</b>',
    job:'제번.',
    part:'품번.',
    pname:'품명.',
    proc:'해당 공정이 있으면 넣습니다.',
    spec:'요구 규격.',
    result:'실측 결과.',
    judge:'불합격이면 그 소재를 쓴 부품 처리를 같이 결정하세요.',
    remark:'추적성조회에서 제번↔LOT↔성적서가 한 줄로 보입니다.'
  },
  certno:seq('CT'), ctype:'재질(밀시트)', issuer:'두산중공업', idate:day(-22),
  lot:ref(), job:'PT005', part:'C26D', pname:'코어 핀', proc:'LM2',
  spec:'HRC 50~54', result:'HRC 52', judge:'합격', url:'',
  remark:'추적성조회에서 제번↔LOT↔밀시트 연결 확인 가능'
},

/* 관리계획서 */
'control_plan_input':{
  _tips:{
    proc:'관리할 공정 코드.',
    pname:'공정명.',
    seq:'같은 공정 안에서의 항목 순번.',
    item:'무엇을 관리하는지 구체적으로.',
    cls:'<b>SC/CC</b>는 고객 지정 특성. 관리가 더 엄격해집니다.',
    spec:'도면 규격 표기.',
    lo:'하한값.',
    hi:'상한값.',
    unit:'측정 단위.',
    cycle:'언제 얼마나 자주 검사할지.',
    sample:'몇 개를 볼지 구체적으로.',
    gauge:'측정기를 반드시 지정하세요. <b>비우면 심사 지적 대상입니다.</b>',
    method:'어떻게 재는지. 측정 위치까지 적으면 좋습니다.',
    form:'결과를 어디에 기록하는지.',
    resp:'검사 책임자.',
    use:'현재 적용중이면 Y.',
    react:'규격을 벗어났을 때 무엇을 할지. 심사에서 꼭 확인합니다.',
    remark:'공정능력 목표 등 부가 조건.'
  },
  _bump:'seq',
  proc:'LM1', pname:'와이어컷', seq:10,
  item:'코어 핀 외경 φ32', cls:'CC(중요)',
  spec:'φ32 h7', lo:31.975, hi:32, unit:'mm',
  cycle:'초물+주기', sample:'초물 3EA + 2시간마다 1EA',
  gauge:ref(), method:'마이크로미터 3점 측정 (0°/60°/120°)',
  form:'자주검사시트', resp:'가공반장', use:'Y',
  react:'규격 이탈 시 설비 정지 → 반장 통보 → 직전 로트 전수선별 → 부적합등록',
  remark:'고객 지정 중요특성(CC) — 공정능력 Cpk 1.33 이상 유지'
},

/* 교육 · 자격 */
'qualification_type_input':{
  _tips:{
    code:'자격 코드.',
    name:'자격 이름.',
    grp:'자격군. 역량현황의 분류 기준입니다.',
    issuer:'사내 부여인지 외부 기관 발급인지.',
    valid:'유효기간(개월). 사원 자격등록 시 만료일이 자동 계산됩니다.',
    legal:'법정 필수 자격이면 Y. 만료 시 최우선 관리 대상입니다.',
    req:'어떤 직무에 필요한지.',
    use:'폐지한 자격은 N.',
    remark:'부여 조건을 적어두면 기준이 명확해집니다.'
  },
  _bump:'code',
  code:'QC-S1', name:'공정검사원', grp:'검사', issuer:'사내',
  valid:24, legal:'N', req:'가공·조립 공정검사 담당자', use:'Y',
  remark:'사내 교육 8시간 + 실기평가 합격 시 부여, 2년마다 갱신'
},
'employee_qualification_input':{
  _tips:{
    eno:'자격 부여 건의 번호.',
    ecode:'사번. 이름은 자동으로 따라옵니다.',
    ename:'사원 이름.',
    qcode:'자격종류에서 고릅니다.',
    adate:'취득일. 유효기간만큼 만료일이 계산됩니다.',
    edate:'만료일. 임박하면 유효현황에 알림이 뜹니다.',
    cert:'증서 번호.',
    issuer:'발급 기관.',
    grade:'자격 등급.',
    status:'만료된 자격은 갱신 전까지 해당 업무를 맡기지 마세요.',
    remark:'갱신 이력 메모.'
  },
  eno:seq('EQ'), ecode:'user13', ename:'한서준', qcode:ref(),
  adate:day(-360), edate:day(365),
  cert:'IQ-'+new Date().getFullYear()+'-021', issuer:'사내', grade:'중급',
  status:'유효', url:'',
  remark:'만료 60일 전 자격 유효현황에 임박 알림 표시'
},
'training_input':{
  _tips:{
    tno:'교육 한 건의 번호.',
    tdate:'실시일.',
    tname:'교육 제목.',
    ttype:'교육 형태.',
    area:'교육 분야. 역량현황 집계 기준입니다.',
    hours:'교육 시간. 연간 이수 시간에 합산됩니다.',
    instructor:'강사.',
    institute:'교육 장소·기관.',
    cnt:'참석 인원 수.',
    qcode:'자격 취득·갱신과 연계되면 연결합니다.',
    attendees:'참석자 명단. 심사 시 증빙이 됩니다.',
    content:'무엇을 가르쳤는지 구체적으로.',
    effect:'효과 평가. 형식적으로 쓰지 말고 근거를 남기세요.',
    remark:'지적사항 후속 교육이면 지적번호를 적어둡니다.'
  },
  tno:seq('TR'), tdate:day(-7), tname:'관리계획서 준수 재교육',
  ttype:'사내교육', area:'품질', hours:4,
  instructor:'한서준', institute:'사내 교육장', cnt:12, qcode:ref(),
  attendees:'한서준, 권소율, 이태윤 외 9명',
  content:'관리계획서 검사주기·샘플수 해석, 자주검사시트 기록방법, 이상시 조치 절차',
  effect:'효과있음 — 사후 평가 평균 92점, 현장 기록 누락 0건', url:'',
  remark:'심사 지적사항 후속 교육'
},

/* ══ 영업관리 ══════════════════════════════════ */
/* 수주등록 */
'sale_order_input':{
  _tips:{
    job_no:'제번. 이 번호로 설계·구매·조립·원가가 전부 묶입니다. <b>가장 먼저 정해야 할 값</b>입니다.',
    order_date:'고객 발주서를 받은 날.',
    status:'진행/보류/완료/취소. 취소하면 하위 발주가 있는지 경고가 뜹니다.',
    otype:'신작·개조·수리. 원가 집계 기준이 달라집니다.',
    quo:'견적서 번호. 수주가 근거로 남깁니다.',
    dom:'해외면 납기와 물류비 산정 기준이 달라집니다.',
    item_code:'아이템 코드. [⌕]로 고르면 이름이 자동으로 따라옵니다.',
    item_name:'아이템 이름은 코드를 고르면 자동 입력됩니다.',
    cust_code:'고객사 코드. 업체관리에 등록된 고객사만 나옵니다.',
    cust_name:'고객사명 자동 입력.',
    mgr_code:'영업 담당자 사번.',
    mgr_name:'담당자명 자동 입력.',
    mold_code:'금형타입 코드. 공정 구성과 표준 리드타임의 기준입니다.',
    mold_name:'금형타입명 자동 입력.',
    ms_code:'고객 프레스 사양. 금형 크기 제약 조건이 됩니다.',
    ms_name:'기계사양명 자동 입력.',
    devtype:'사내 개발인지 외주 설계인지.',
    drawing_no:'고객 도번.',
    product_name:'제품명.',
    model:'차종·모델. 현황 화면의 주요 검색 키입니다.',
    proc_cnt:'공정(조)수. 한 제번에 몇 조(SET)를 만드는지. 원가 배부 단위가 됩니다.',
    material_used:'제품 소재. 금형 사양 검토 근거입니다.',
    s1p:'Try-Out(초도품) 예정일. <b>KPI01 납기준수율의 기준</b>이 됩니다.',
    dlvp:'최종 납기 예정일. KPI02의 기준입니다.',
    quo_price:'견적 금액.',
    order_price:'실제 수주 금액. 제작계획의 목표원가 기준이 됩니다.',
    eco:'설계변경 관리번호가 있으면 적습니다.',
    completion_date:'정산완료일. 납품 후 잔여 수정·검수·정산까지 끝나 제번을 종결한 날입니다.',
    remark:'특기사항. 현황 화면에서 함께 보입니다.'
  },
  job_no:seq('Q26'),
  order_date:day(-3),
  status:'진행',
  otype:'신작',
  quo:'QT-26-118',
  dom:'국내',
  item_code:'C',
  item_name:'자동차',
  cust_code:'V023',
  cust_name:'대한모터스',
  mgr_code:'user13',
  mgr_name:'한서준',
  mold_code:'MD001',
  mold_name:'PROGRESSIVE',
  ms_code:'MS004',
  ms_name:'300 TON',
  devtype:'사내',
  drawing_no:'DW-26-0118',
  product_name:'도어 인너 패널',
  model:'MDL-26A',
  proc_cnt:4,
  material_used:'SPRC440 t1.2',
  s1p:day(25),
  dlvp:day(45),
  quo_price:52000000,
  order_price:48000000,
  eco:'ECO-26-041',
  remark:'프로그레시브 4공정 · 고객 T/O 입회 요청'
},
/* 제작계획등록 */
'sales_plan_input':{
  _labels:{a1:'설계 사내',a2:'설계 사외',a3:'원재료',a4:'구매',a5:'가공 사내',a6:'가공 사외',a7:'조립 사내',a8:'조립 사외'},
  _tips:{
    job_no:'수주된 제번을 넣고 다른 칸을 클릭하면 <b>수주정보가 자동으로 채워집니다.</b>',
    customer_name:'수주등록에서 자동으로 따라옵니다.',
    item_name:'아이템 자동 입력.',
    mold_type_name:'금형타입 자동 입력.',
    product_name:'제품명.',
    model:'모델명.',
    process_set_qty:'공정(조)수. 한 제번에 몇 조(SET)를 만드는지. 원가 배부 단위가 됩니다.',
    order_date:'수주일.',
    s1_planned_date:'Try-Out 예정일. 아래 일정은 이 날짜를 역산해 잡습니다.',
    delivery_planned_date:'납기 예정일.',
    design_start_date:'설계 착수일.',
    design_end_date:'설계 완료예정일.',
    design_days:'설계 소요일수. 시작·종료일과 맞춰 적습니다.',
    design_outsourced:'외주설계면 체크. 원가 구성비의 설계 사외와 연결됩니다.',
    design_manager:'설계 담당자.',
    machining_start_date:'가공 착수일. 설계와 겹쳐 잡는 것이 일반적입니다.',
    machining_end_date:'가공 완료예정일.',
    machining_days:'가공 소요일수.',
    machining_outsourced:'외주가공 비중이 크면 체크합니다.',
    machining_manager:'가공 담당자.',
    assembly_start_date:'조립 착수일.',
    assembly_end_date:'조립 완료예정일. Try-Out 예정일보다 앞서야 합니다.',
    assembly_days:'조립 소요일수.',
    assembly_outsourced:'SET 외주면 체크합니다.',
    assembly_manager:'조립 담당자.',
    order_price:'수주가. 수주등록 값과 맞춥니다.',
    target_price:'목표원가. 아래 구성비 합계와 맞추면 이익률이 정확히 나옵니다.',
    a1:'설계 사내 인건비.',
    a2:'설계 사외 — 외주설계 발주분.',
    a3:'원재료비 — PartList 원재료 발주 예상액.',
    a4:'구매품비 — 표준부품·유닛 구입비.',
    a5:'가공 사내 — 자체 설비 가공비.',
    a6:'가공 사외 — 외주가공 발주 예상액.',
    a7:'조립 사내 인건비.',
    a8:'조립 사외 — SET 외주분. <b>다 넣으면 목표가와 이익률이 자동 계산</b>됩니다.'
  },
  job_no:'PT005',
  customer_name:'삼수금속',
  item_name:'키친',
  mold_type_name:'PROGRESSIVE',
  product_name:'싱크볼 상부',
  model:'MDL-2608',
  process_set_qty:4,
  order_date:day(-3),
  s1_planned_date:day(25),
  delivery_planned_date:day(45),
  design_start_date:day(1),
  design_end_date:day(10),
  design_days:9,
  design_outsourced:'N',
  design_manager:'이태윤',
  machining_start_date:day(8),
  machining_end_date:day(28),
  machining_days:20,
  machining_outsourced:'Y',
  machining_manager:'강지우',
  assembly_start_date:day(26),
  assembly_end_date:day(38),
  assembly_days:12,
  assembly_outsourced:'N',
  assembly_manager:'안다인',
  order_price:48000000,
  target_price:41000000,
  a1:6000000,
  a2:3000000,
  a3:9000000,
  a4:4500000,
  a5:7000000,
  a6:6500000,
  a7:3500000,
  a8:1500000
},
/* ══ 기준정보 ══════════════════════════════════ */
/* 부품관리 */
'part_management':{
  _bump:'code',
  _tips:{
    code:'부품 코드. PartList와 발주 화면에서 이 코드로 부릅니다.',
    name:'현장에서 통용되는 이름으로 적습니다.',
    group:'부품군. 발주·재고 화면의 분류 기준이 됩니다.'
  },
  code:'B-S01',
  name:'PUNCH, CARBIDE',
  group:'PUNCH'
},
/* 자재등록 */
'material_management':{
  _bump:'code',
  _tips:{
    code:'자재 코드. 소재 발주와 LOT 등록에서 이 코드를 씁니다.',
    name:'재질 통칭을 적습니다.',
    group:'원재료와 구매품은 발주 화면이 서로 다릅니다.',
    density:'비중. 무게 기반 단가 계산에 쓰입니다.',
    thickness:'표준 두께(mm).',
    width:'표준 폭(mm).',
    height:'높이가 필요한 자재만 입력합니다.',
    length:'표준 길이(mm).',
    remark:'상시 재고 여부 등을 적어두면 발주 판단이 쉬워집니다.'
  },
  code:'HP4-S',
  name:'HP4 (프리하든강)',
  group:'원재료',
  density:7.85,
  thickness:30,
  width:200,
  height:0,
  length:300,
  remark:'T30×W200×L300 상시 재고 품목'
},
/* 설비등록 */
'equipment_registration':{
  _bump:'code',
  _tips:{
    code:'설비 코드. 작업지시와 4M 변경에서 이 코드를 씁니다.',
    name:'현장 호칭 그대로.',
    group:'설비군. 공정별 능력 파악에 씁니다.',
    use:'폐기 설비는 N으로 두면 선택 목록에서 빠집니다.',
    remark:'도입연도와 규격을 적어두면 4M 변경 검토가 쉬워집니다.'
  },
  code:'MCT-S07',
  name:'머시닝센터 7호기',
  group:'가공',
  use:'Y',
  remark:'2024년식 · X800×Y500 · 4M 변경 시 대상 설비'
},
/* 업체관리 */
'vendor_management':{
  _bump:'code',
  _tips:{
    code:'업체 코드. 모든 발주·평가 화면이 이 코드로 연결됩니다.',
    name:'사업자등록증상 상호를 씁니다.',
    type:'고객사와 협력업체는 나타나는 화면이 다릅니다.',
    location:'해외 업체는 납기 산정 기준이 달라집니다.',
    ceo:'대표자명.',
    phone:'대표 전화.',
    fax:'팩스. 발주서 송부에 씁니다.',
    zip:'우편번호.',
    partner:'실무 담당자. 발주·독촉 시 연락처입니다.'
  },
  code:'V-S01',
  name:'신성정밀(주)',
  type:'협력업체',
  location:'국내',
  ceo:'김대표',
  phone:'031-000-0000',
  fax:'031-000-0001',
  zip:'15588',
  partner:'박과장 / 010-0000-0000'
},
/* 사업부정보 */
'business_division_info':{
  _bump:'code',
  _tips:{
    code:'사업부 코드.',
    name:'수주·원가를 이 단위로 집계합니다.',
    remark:'담당 제품군을 적어둡니다.'
  },
  code:'BD-S1',
  name:'프레스금형사업부',
  remark:'자동차 차체 프레스금형 전담'
},
/* 부서정보 */
'department_registration':{
  _bump:'code',
  _tips:{
    code:'부서 코드. 사용자정보와 문서관리대장에서 씁니다.',
    name:'부서 정식 명칭.',
    division:'소속 사업부를 적습니다.',
    remark:'주요 역할을 적어두면 문서 주관부서 지정이 쉬워집니다.'
  },
  code:'D-S1',
  name:'품질보증팀',
  division:'프레스금형사업부',
  remark:'SQ 심사 대응 및 문서관리 주관'
},
/* 아이템 관리 */
'item_management':{
  _bump:'code',
  _tips:{
    code:'아이템 코드.',
    name:'수주등록의 아이템 선택 목록에 나타납니다.',
    remark:'제품군과 공정수를 적어둡니다.'
  },
  code:'IT-S1',
  name:'도어 인너 패널',
  remark:'차체 패널류 · 프레스 4공정'
},
/* 경비사유 */
'expense_reason_registration':{
  _bump:'code',
  _tips:{
    code:'경비사유 코드.',
    name:'경비등록의 사유 선택 목록에 나타납니다.',
    remark:'원가 반영 방식을 적어둡니다.'
  },
  code:'E-S1',
  name:'금형 수정비',
  remark:'T/O 후 수정 발생분 · 제번별 원가에 반영'
},
/* 금형타입관리 */
'mold_type_management':{
  _bump:'code',
  _tips:{
    code:'금형타입 코드.',
    name:'수주등록·도면등록의 금형타입 목록에 나타납니다.',
    remark:'타입 특성을 적어둡니다.'
  },
  code:'MT-S1',
  name:'프로그레시브',
  remark:'연속 이송형 · 다공정 일체'
},
/* 기계사양관리 */
'machine_spec_management':{
  _bump:'code',
  _tips:{
    code:'기계사양 코드.',
    name:'수주등록에서 고객 설비 사양을 지정할 때 씁니다.',
    remark:'금형 설계 제약 조건이 되는 값을 적습니다.'
  },
  code:'MS-S1',
  name:'600TON 프레스',
  remark:'볼스터 2500×1200 · 스트로크 250'
},
/* 검사구분 */
'inspection_category':{
  _bump:'code',
  _tips:{
    code:'검사구분 코드. 검사실적등록에서 이 코드로 분류합니다.',
    name:'검사 종류 이름.',
    target:'무엇을 검사하는지.',
    timing:'언제 검사하는지.',
    sampling:'전수인지 샘플링인지. 관리계획서와 일치시켜야 합니다.',
    order:'검사 목록에서의 표시 순서.',
    use:'쓰지 않는 구분은 N으로 둡니다.',
    remark:'검사 기준을 요약해 둡니다.'
  },
  code:'IC-S1',
  name:'초물검사',
  target:'반제품',
  timing:'공정중',
  sampling:'전수',
  order:45,
  use:'Y',
  remark:'가공 착수 첫 3개 전수 측정'
},
/* 검사항목 */
'inspection_item_management':{
  _bump:'code',
  _tips:{
    code:'검사항목 코드.',
    name:'검사실적 상세에 이 이름으로 나옵니다.',
    group:'어느 검사구분에 속하는 항목인지 고릅니다.',
    remark:'판정 기준과 측정기를 적어둡니다.'
  },
  code:'IT-S90',
  name:'평행도',
  group:'공정검사',
  remark:'기준면 대비 0.02mm 이내 · 하이트게이지 측정'
},
/* 직급정보 */
'position_info':{
  _bump:'code',
  _tips:{
    code:'직급 코드.',
    name:'직급 명칭.',
    level:'숫자가 작을수록 상위 직급입니다.',
    group:'직군 분류.',
    approver:'결재 권한이 있으면 Y. 승인자 목록에 나타납니다.',
    use:'폐지 직급은 N.',
    remark:'결재 범위를 적어둡니다.'
  },
  code:'P-S1',
  name:'책임',
  level:4,
  group:'관리직',
  approver:'Y',
  use:'Y',
  remark:'과장급 · 부서 결재 1차'
},
/* 공지사항 등록 */
'notice_registration':{
  _bump:'code',
  _tips:{
    code:'공지 번호.',
    name:'제목. 메인 화면에 이 제목이 노출됩니다.',
    writer:'작성자.',
    remark:'본문 내용을 적습니다.'
  },
  code:'N-S1',
  name:'9월 정기 내부심사 실시 안내',
  writer:'한서준',
  remark:'9/15~9/16 전 부서 대상 · 문서·기록 사전 정비 요망'
},
/* 협력업체 */
'vendor_evaluation_input':{
  _tips:{
    eno:'평가 한 건의 번호.',
    vcode:'업체 코드.',
    vname:'업체명.',
    edate:'평가 실시일.',
    period:'평가 대상 기간.',
    etype:'정기·수시·신규 중 하나.',
    area:'이 업체가 공급하는 분야.',
    evaluator:'평가자.',
    qs:'품질 점수(가중 40%). 부적합현황을 근거로 매기세요.',
    ds:'납기 점수(가중 30%). 발주현황의 준수율을 보세요.',
    rs:'대응 점수(가중 15%).',
    ps:'가격 점수(가중 15%).',
    action:'등급에 따른 후속 조치.',
    due:'개선 요구 기한.',
    remark:'총점·등급은 점수를 넣으면 자동 계산됩니다.'
  },
  eno:seq('VE'), vcode:'V229', vname:'대현정밀가공', edate:day(-15),
  period:new Date().getFullYear()+'-상반기', etype:'정기평가', area:'외주가공',
  evaluator:'권소율', qs:72, ds:80, rs:75, ps:85,
  action:'개선요구', due:day(30), result:'',
  remark:'총점·등급은 가중치(품질40·납기30·대응15·가격15)로 자동 계산'
},
'vendor_certificate_input':{
  _tips:{
    cno:'인증서 관리번호.',
    vcode:'업체 코드.',
    vname:'업체명.',
    ctype:'인증 종류.',
    cnum:'인증서에 적힌 번호.',
    issuer:'인증 기관.',
    idate:'발행일.',
    edate:'만료일. <b>만료 업체에 발주하면 심사 지적입니다.</b>',
    scope:'인증 범위. 우리가 맡기는 공정이 포함되는지 확인하세요.',
    remark:'갱신본 수령 메모.'
  },
  cno:seq('VC'), vcode:'V229', vname:'대현정밀가공', ctype:'IATF 16949',
  cnum:'IATF-'+(new Date().getFullYear()-2)+'-0912', issuer:'DNV',
  idate:day(-700), edate:day(30),
  scope:'금형부품 가공 (밀링·연삭·방전)', url:'',
  remark:'만료 60일 전 인증현황에 임박 알림 표시'
},

/* ══ 기준정보 ═════════════════════════════════════════ */

/* 가공공정관리 */
'machining_process_management':{
  _bump:'code',
  _tips:{
    code:'가공공정을 구분하는 코드. <b>공정단가·실적·기준공정이 모두 이 코드로 연결</b>됩니다. 소문자로 넣어도 대문자로 저장됩니다.',
    name:'현장에서 부르는 공정 이름. 작업지시서·공정이력카드에 그대로 찍힙니다.',
    group:'<b>가공/설계/조립</b> 중 하나. 그룹에 따라 실적등록 화면과 원가 집계 항목이 갈립니다.',
    order:'목록과 기준공정 전개 시의 표시 순서. 10단위로 띄워 사이에 끼울 여지를 둡니다.',
    useProgress:'진척률 집계에 넣을 공정이면 Y. 부대공정은 N으로 두면 진척률이 왜곡되지 않습니다.',
    usePlan:'가공계획·기준공정에서 고를 수 있게 하려면 Y. 폐지한 공정은 N으로 바꾸면 목록에서 빠집니다.',
    completeProgress:'이 공정이 끝났을 때 부품 진척률을 몇 %로 볼지. 합이 100이 되도록 배분합니다.',
    remark:'설비·외주 여부 등 현장 판단에 필요한 메모.'
  },
  code:'MC1', name:'고속가공', group:'가공', order:110,
  useProgress:'Y', usePlan:'Y', completeProgress:20,
  remark:'HSC 5축 · 코어 황삭 후 투입'
},

/* 자재단가변동 등록 */
'material_price_change_registration':{
  _tips:{
    regDate:'단가를 입력하는 날. 적용시작일과 다를 수 있습니다.',
    registrant:'단가를 등록한 담당자. 나중에 근거를 물을 때 확인용입니다.',
    kind:'<b>원재료 / 구매품</b> 중 하나. 발주 화면에서 이 구분으로 단가를 찾습니다.',
    material:'자재코드. 기준정보 › 자재등록에 있는 코드여야 발주 시 자동으로 붙습니다.',
    effective:'<b>이 날짜부터 유효한 단가</b>입니다. 발주일이 이 날짜 이후인 건에만 적용됩니다.',
    price:'단위당 금액(원). 사이즈 기준 단가면 아래 사이즈 칸을 반드시 채우세요.',
    size:'단가 기준 규격(T*W*L 등). 규격별로 단가가 다르면 규격마다 한 줄씩 등록합니다.',
    vendor:'이 단가를 주는 협력업체. 같은 자재라도 업체별로 단가가 다르면 각각 등록합니다.'
  },
  regDate:day(0), registrant:'김민수', kind:'원재료', material:'SKD61',
  effective:day(1), price:4200, size:'30*200*300', vendor:'대현정밀가공'
},

/* 공정단가변동 등록 */
'process_price_change_registration':{
  _tips:{
    regDate:'단가를 입력하는 날.',
    registrant:'등록 담당자.',
    group:'<b>설계/가공/조립</b> 공정그룹. 사내 실적 인건비는 이 그룹별로 집계됩니다.',
    process:'가공공정코드. 기준정보 › 가공공정관리에 등록된 코드를 씁니다.',
    effective:'<b>이 날짜부터 적용</b>되는 단가입니다. 인상 시에는 기존 행을 고치지 말고 새 적용시작일로 한 줄 더 등록하세요.',
    price:'시간당(또는 건당) 단가(원). 실적등록의 작업시간에 곱해져 원가가 됩니다.',
    vendor:'외주 단가면 협력업체를 지정합니다. <b>사내 단가는 비워둡니다.</b>'
  },
  regDate:day(0), registrant:'김민수', group:'가공', process:'MC1',
  effective:day(1), price:38000, vendor:'대현정밀가공'
}
};

/* ── 실행 ───────────────────────────────────────────── */
function fill(page,opt){
  const spec=S[page];
  if(!spec){ return {ok:false,msg:'이 화면은 등록예제가 준비되어 있지 않습니다.'} }
  opt=opt||{};
  try{ if(typeof window.add==='function') window.add(); }catch(e){}

  /* keyName/AUTO 는 화면 스크립트의 지역 상수라 window 로 못 읽는다 → 호출부에서 전달받는다 */
  const keyId=opt.keyId||((typeof window.keyName==='string')?window.keyName:null);
  const auto=(opt.auto!==undefined)?opt.auto:((typeof window.AUTO!=='undefined')&&window.AUTO);
  const skipped=[];
  let n=0;

  Object.keys(spec).forEach(id=>{
    if(id.charAt(0)==='_') return;           // _bump 등 메타 키
    if(auto&&keyId&&id===keyId) return;      // 자동채번 키는 add()가 채운 값 유지
    const v=spec[id];
    if(v===''||v===null||v===undefined) return;
    if(setVal(id,v)) n++;
    else if(v===REF||(v&&v.__ref)) skipped.push(id);
  });

  /* 계산칸 재산출을 위해 한 번 더 트리거 */
  Object.keys(spec).forEach(id=>{
    if(id.charAt(0)==='_') return;
    const el=document.getElementById(id);
    if(el&&!el.readOnly&&el.value!=='') fire(el);
  });

  /* 목록에 이미 있는 키면 자동으로 다음 번호로 밀어 중복을 막는다 */
  if(keyId){
    const kel=document.getElementById(keyId);
    const bump=spec._bump?document.getElementById(spec._bump):null;
    for(let g=0; g<60 && kel && gridKeys().has(String(kel.value).trim()); g++){
      if(bump){ bump.value=bumpTail(bump.value); fire(bump); }
      else if(!kel.readOnly){ kel.value=bumpTail(kel.value); fire(kel); }
      else break;
    }
  }

  let msg='등록예제를 채웠습니다. 내용 확인 후 [저장]을 누르세요.';
  if(skipped.length) msg+=' (조회목록이 비어 있어 '+skipped.length+'개 항목은 직접 선택하세요)';
  return {ok:true,msg:msg,filled:n,skipped:skipped};
}

window.MESSAMPLE={fill:fill,has:function(p){return !!S[p]},spec:function(p){return S[p]},D:D};
})();
