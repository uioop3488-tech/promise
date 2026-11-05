/**
 * 공동 청첩장 모임 초대장 → 구글 시트 참석 명단
 *
 * 설치 방법
 * 1. 명단 시트에서 확장 프로그램 > Apps Script 를 열고(또는 script.google.com 새 프로젝트)
 *    원래 코드를 지운 뒤 이 파일 내용을 붙여넣고 저장
 * 2. 배포 > 새 배포 > 유형: 웹 앱
 *    - 실행 사용자: 나
 *    - 액세스 권한이 있는 사용자: 모든 사용자
 * 3. 권한 승인 후 나오는 웹 앱 URL(…/exec)을 초대장 index.html 의 RSVP_ENDPOINT 에 넣기
 *
 * 같은 이름으로 다시 보내면 새 줄을 만들지 않고 그 사람의 줄을 고쳐요.
 */
var SHEET_ID = '1uHCsLeiPQ2P7mBN-wI704X6gpEUXgmDMb-xSLoQ93kU';
var SHEET_NAME = '응답';

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var name = String(data.name || '').trim().slice(0, 30);
    if (!name || typeof data.attending !== 'boolean') {
      return json_({ ok: false, error: 'bad_request' });
    }
    // 이름이 = + - @ 로 시작해도 수식으로 바뀌지 않게
    var safeName = /^[=+\-@]/.test(name) ? "'" + name : name;
    var status = data.attending ? '참석' : '불참';
    var now = new Date();

    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    var last = Math.max(sheet.getLastRow(), 1);
    var names = last > 1
      ? sheet.getRange(2, 1, last - 1, 1).getDisplayValues().map(function (r) { return r[0].trim(); })
      : [];

    var found = names.indexOf(name);
    if (found >= 0) {
      var row = found + 2;
      sheet.getRange(row, 2).setValue(status);
      sheet.getRange(row, 4).setValue(now);
    } else {
      var empty = names.indexOf('');
      var newRow = empty >= 0 ? empty + 2 : last + 1;
      sheet.getRange(newRow, 1, 1, 4).setValues([[safeName, status, now, now]]);
    }
    return json_({ ok: true });
  } catch (err) {
    Logger.log(err);
    return json_({ ok: false, error: 'server_error', detail: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 편집기에서 직접 실행해 보는 테스트.
 * 위쪽 함수 선택 칸에서 testRsvp 를 고르고 ▷ 실행 → 시트에 "연결 테스트" 줄이 생기면 정상.
 * 확인 후 시트에서 그 줄은 지워주세요.
 */
function testRsvp() {
  var out = doPost({ postData: { contents: JSON.stringify({ name: '연결 테스트', attending: true }) } });
  Logger.log(out.getContent());
}
