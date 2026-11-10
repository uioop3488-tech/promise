/**
 * 진하 ♥ 민석 모바일 청첩장 — 방명록 / 참석 의사 저장용 Apps Script
 *
 * 사용법
 * 1) 구글 시트 메뉴 [확장 프로그램] → [Apps Script] 를 열고, 이 파일 내용을 전부 붙여넣고 저장합니다.
 * 2) 오른쪽 위 [배포] → [새 배포] → 유형 '웹 앱'
 *    - 다음 사용자 인증 정보로 실행: 나
 *    - 액세스 권한이 있는 사용자: 모든 사용자
 * 3) [배포] → 권한 승인 → 나오는 '웹 앱 URL'(https://script.google.com/macros/s/…/exec)을
 *    청첩장 index.html 의 CONFIG.sheetApi 에 넣습니다.
 *
 * 코드를 고친 뒤에는 [배포] → [배포 관리] → 연필 → 버전 '새 버전' 으로 다시 배포해야 반영됩니다.
 */

const SHEET_GB = '방명록';     // 번호 | 작성 시각 | 이름 | 메시지 | 비밀번호(암호화)
const SHEET_RSVP = '참석의사'; // 제출 시각 | 어느 측 | 참석 여부 | 식사 | 성함 | 인원 | 연락처 뒷자리

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'list';
  if (action !== 'list') return json_({ ok: false, error: 'unknown action' });
  const sh = sheet_(SHEET_GB);
  const last = sh.getLastRow();
  if (last < 2) return json_({ ok: true, entries: [] });
  const rows = sh.getRange(2, 1, last - 1, 4).getValues();
  const entries = rows
    .filter(r => r[0] !== '')
    .map(r => ({ id: Number(r[0]), created_at: new Date(r[1]).toISOString(), name: String(r[2]), message: String(r[3]) }))
    .reverse(); // 최신 글이 앞으로
  return json_({ ok: true, entries });
}

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad request' }); }
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (d.action === 'gb_add') return json_(addGuestbook_(d));
    if (d.action === 'gb_delete') return json_(deleteGuestbook_(d));
    if (d.action === 'rsvp') return json_(addRsvp_(d));
    return json_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function addGuestbook_(d) {
  const name = clean_(d.name, 20), message = clean_(d.message, 300), pw = String(d.password || '');
  if (!name || !message) throw new Error('이름과 메시지를 입력해주세요');
  if (pw.length < 4 || pw.length > 20) throw new Error('비밀번호는 4~20자');
  const props = PropertiesService.getScriptProperties();
  const id = Number(props.getProperty('gbNextId') || '1');
  props.setProperty('gbNextId', String(id + 1));
  const salt = Utilities.getUuid();
  sheet_(SHEET_GB).appendRow([id, new Date(), safe_(name), safe_(message), salt + ':' + hash_(salt, pw)]);
  return { ok: true, id };
}

function deleteGuestbook_(d) {
  const id = Number(d.id), pw = String(d.password || '');
  const sh = sheet_(SHEET_GB);
  const last = sh.getLastRow();
  if (last < 2) return { ok: true, deleted: false };
  const rows = sh.getRange(2, 1, last - 1, 5).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (Number(rows[i][0]) !== id) continue;
    const parts = String(rows[i][4]).split(':');
    if (parts.length === 2 && hash_(parts[0], pw) === parts[1]) {
      sh.deleteRow(i + 2);
      return { ok: true, deleted: true };
    }
    return { ok: true, deleted: false };
  }
  return { ok: true, deleted: false };
}

function addRsvp_(d) {
  if (d.side !== '신랑' && d.side !== '신부') throw new Error('side');
  const attend = d.attend === true;
  const name = clean_(d.name, 20);
  const phone4 = String(d.phone4 || '');
  if (!name || !/^[0-9]{4}$/.test(phone4)) throw new Error('필수 항목');
  const meal = attend ? (d.meal === '예정' ? '식사함' : d.meal === '안함' ? '식사안함' : '') : '';
  const guests = attend ? Math.max(1, Math.min(6, Number(d.guests) || 1)) : 0;
  sheet_(SHEET_RSVP).appendRow([new Date(), d.side + '측', attend ? '참석' : '불참석', meal, safe_(name), guests, "'" + phone4]);
  return { ok: true };
}

// ---------- helpers ----------
function sheet_(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('시트 탭이 없습니다: ' + name);
  return sh;
}
function clean_(v, max) { return String(v || '').trim().slice(0, max); }
// =, +, -, @ 로 시작하는 값이 수식으로 실행되지 않도록
function safe_(v) { return /^[=+\-@]/.test(v) ? "'" + v : v; }
function hash_(salt, pw) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + pw, Utilities.Charset.UTF_8);
  return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
