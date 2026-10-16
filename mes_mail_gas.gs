/* ── v328: 발주서 메일 발송용 구글 앱스 스크립트 (태진 구글 계정으로 배포) ──────────
 * 메일은 이 스크립트를 「배포한 구글 계정」의 Gmail 로 나갑니다.
 *
 * 설치 (태진 구글 계정으로 로그인한 상태에서 한 번만)
 *  1) https://script.google.com → [새 프로젝트] → 이 파일 내용을 통째로 붙여넣고 저장
 *  2) [배포] → [새 배포] → 유형 「웹 앱」
 *       - 다음 사용자 인증 정보로 실행 : 나 (태진 계정)
 *       - 액세스 권한이 있는 사용자   : 모든 사용자
 *  3) 권한 허용 창이 뜨면 태진 계정으로 [허용]  (Gmail 보내기 · 외부 그림 가져오기)
 *  4) 나온 웹 앱 URL(…/exec)을 mes_mail.js 의 GAS_URL 에 넣는다
 *  코드를 고친 뒤에는 [배포] → [배포 관리] → 연필 → 버전 「새 버전」 으로 다시 배포 (URL 그대로 유지)
 *
 * 요청 (POST, text/plain JSON)
 *  {action:'whoami'}                                       → {ok, from}
 *  {action:'sendOrderMail', to, cc, subject, text, html, attachments:[{name,url}]} → {ok, from}
 */
const SENDER_NAME = '태진다이텍';   // 받는 쪽에 보이는 보낸 사람 이름

function doPost(e) {
  try {
    const p = JSON.parse(e.postData.contents || '{}');
    const from = Session.getEffectiveUser().getEmail();
    if (p.action === 'whoami') return out({ ok: true, from: from });
    if (p.action !== 'sendOrderMail') return out({ ok: false, error: '알 수 없는 요청: ' + p.action });
    if (!p.to) return out({ ok: false, error: '받는 사람이 없습니다' });

    // 부품 그림 — 주소에서 받아 첨부 (못 받은 그림은 건너뜀)
    const files = (p.attachments || []).map(function (a) {
      try { return UrlFetchApp.fetch(a.url).getBlob().setName(a.name || 'image.png'); }
      catch (x) { return null; }
    }).filter(Boolean);

    const opt = { name: SENDER_NAME, htmlBody: p.html || undefined, attachments: files };
    if (p.cc) opt.cc = p.cc;
    GmailApp.sendEmail(p.to, p.subject || '(제목 없음)', p.text || '', opt);
    return out({ ok: true, from: from, attached: files.length });
  } catch (err) {
    return out({ ok: false, error: String(err && err.message || err) });
  }
}

// 브라우저로 주소를 열면 어느 계정으로 배포됐는지 보여준다
function doGet() {
  return out({ ok: true, from: Session.getEffectiveUser().getEmail() });
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
