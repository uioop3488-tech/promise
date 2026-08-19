# 허위 약속의 민족 🗓️

> 미루고 미룬 약속, 오늘은 정하자.

이름만 입력하고 접속해서 **가능한 날짜(점심 / 저녁 / 종일)**를 모으고,
가장 많이 겹치는 날짜 **1~3순위**를 자동으로 보여주는 모임 날짜 정하기 웹앱입니다.
When2meet의 상위호환을 목표로, 더 예쁘고 직관적으로.

- **프론트엔드**: 단일 `index.html` (프레임워크 없이 순수 JS). Netlify에 드래그하면 바로 배포.
- **백엔드**: Supabase (무료 티어). `@supabase/supabase-js`를 CDN으로 사용.
- **저장소**: 모든 데이터는 Supabase에 저장. localStorage는 "내 이름 / 최근 참여" 편의용으로만.

---

## 🚀 빠른 시작 (5분)

1. [supabase.com](https://supabase.com) 가입 → **New project** 생성
2. 아래 **② SQL** 전문을 SQL Editor에 붙여넣고 실행
3. **③** 에서 URL·anon key를 복사해 `index.html`에 붙여넣기
4. `index.html`을 브라우저로 열어 테스트 → **④** 순서로 Netlify 배포

> 키를 넣기 전에 `index.html`을 열면 **“설정이 필요해요”** 안내 화면이 뜹니다. 정상입니다.

---

## ① Supabase 프로젝트 만들기

1. [supabase.com](https://supabase.com) 접속 → 가입/로그인.
2. **New project** 클릭.
   - **Name**: 아무거나 (예: `promise`)
   - **Database Password**: 강한 비밀번호 (이건 DB 관리용 — 앱과는 무관)
   - **Region**: 가까운 곳 (예: Northeast Asia (Seoul))
3. 생성까지 1~2분 기다립니다.

---

## ② 실행할 SQL (테이블 + RLS 정책) — 복붙만 하세요

왼쪽 메뉴 **SQL Editor → New query** 에 아래 전문을 그대로 붙여넣고 **Run** 하세요.

```sql
-- ─────────────────────────────────────────────────────────────
-- 「허위 약속의 민족」 스키마 + RLS + Realtime
-- SQL Editor에 통째로 붙여넣고 Run 하세요. (재실행해도 안전)
-- ─────────────────────────────────────────────────────────────

-- 1) 모임
create table if not exists public.meetings (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  description        text default '',
  host_password_hash text not null,             -- SHA-256 해시 (평문 저장 안 함)
  date_start         date not null,
  date_end           date not null,
  is_closed          boolean not null default false,
  code               text unique,               -- 짧은 초대 코드 (앱이 자동 생성)
  created_at         timestamptz not null default now()
);

-- 2) 참여자
create table if not exists public.participants (
  id         uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

-- 3) 가능일 (slot: 'lunch' | 'dinner' | 'allday')
create table if not exists public.availabilities (
  id             uuid primary key default gen_random_uuid(),
  meeting_id     uuid not null references public.meetings(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  date           date not null,
  slot           text not null check (slot in ('lunch','dinner','allday')),
  created_at     timestamptz not null default now()
);

-- 조회 성능용 인덱스
create index if not exists idx_participants_meeting   on public.participants(meeting_id);
create index if not exists idx_avail_meeting          on public.availabilities(meeting_id);
create index if not exists idx_avail_participant      on public.availabilities(participant_id);

-- ─────────────────────────────────────────────────────────────
-- RLS: 익명 공개 앱에 맞춘 최소 보안
--  · anon 키만으로 읽기/쓰기 허용 (지인 모임용)
--  · 비밀번호(주최자) 검증은 앱 레벨에서 처리 (SHA-256 해시 대조)
-- ─────────────────────────────────────────────────────────────
alter table public.meetings       enable row level security;
alter table public.participants   enable row level security;
alter table public.availabilities enable row level security;

-- 이미 있으면 지우고 다시 (재실행 안전)
drop policy if exists "public all meetings"       on public.meetings;
drop policy if exists "public all participants"   on public.participants;
drop policy if exists "public all availabilities" on public.availabilities;

create policy "public all meetings"
  on public.meetings       for all to anon, authenticated using (true) with check (true);
create policy "public all participants"
  on public.participants   for all to anon, authenticated using (true) with check (true);
create policy "public all availabilities"
  on public.availabilities for all to anon, authenticated using (true) with check (true);

-- ─────────────────────────────────────────────────────────────
-- Realtime: 참여 인원/결과 실시간 반영용 (선택이지만 권장)
-- ─────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.meetings;
alter publication supabase_realtime add table public.participants;
alter publication supabase_realtime add table public.availabilities;
```

### 짧은 모임 코드 (이미 SQL을 실행했다면, 이 한 줄만 추가로 실행)

모임을 **짧은 코드/URL**로 공유하려면 `meetings`에 `code` 컬럼이 필요해요.
처음 만드는 프로젝트면 위 SQL의 `meetings` 정의에 이미 `code`가 없으니, 아래를 **한 번** 실행하세요:

```sql
alter table public.meetings add column if not exists code text unique;
```

- `code`는 6자리 짧은 코드(예: `k7m2xq`)로, 앱이 자동 생성합니다.
- 초대 링크가 `...?m=k7m2xq` 처럼 짧아지고, 랜딩의 **“코드·링크로 참여”**에서 코드만 입력해도 들어갈 수 있어요.
- 이 컬럼 없이도 앱은 동작하지만(옛 UUID 링크로), 짧은 코드를 쓰려면 위 한 줄이 필요합니다.

> **참고 — 보안 수준**: anon key는 공개돼도 되는 키입니다. 위 정책은 “아는 사람끼리
> 쓰는 공개 모임” 수준의 최소 보안입니다. 모임 **삭제·마감**은 앱에서 주최자
> 비밀번호(해시)가 일치할 때만 실행되도록 막아 두었습니다(완벽한 서버 강제는 아님).
> 더 엄격히 막고 싶다면 삭제/수정을 Supabase **Edge Function**으로 옮겨
> 서버에서 비번을 검증하도록 확장할 수 있습니다.

---

## ③ URL·anon key 복사해서 붙여넣기

1. Supabase 프로젝트 → **Project Settings**(톱니바퀴) → **API Keys** (또는 **Data API**).
2. 두 값을 복사합니다.
   - **Project URL** — 예: `https://abcdefgh.supabase.co`
   - **anon public** key — `eyJhbGciOi...` 로 시작하는 긴 문자열
3. `index.html`을 편집기로 열고, **상단 `<script>` 안**의 두 상수를 채웁니다.

```js
/* ① 여기에 Supabase 키를 넣으세요 */
const SUPABASE_URL      = 'https://abcdefgh.supabase.co'; // ← Project URL
const SUPABASE_ANON_KEY = 'eyJhbGciOi...';                // ← anon public key
```

저장하면 끝. (`service_role` 키는 절대 넣지 마세요 — 그건 비밀 키입니다.)

---

## ④ Netlify 배포

### 새로 배포 (드래그 앤 드롭)
1. [app.netlify.com](https://app.netlify.com) 로그인.
2. **Sites** 화면의 점선 박스(“**Drag and drop your site output folder here**”)에
   `index.html`이 든 **폴더**를 드래그해서 올립니다.
   - 파일 하나만 올려도 되지만, 폴더째 올리는 게 확실합니다.
3. 잠시 후 `https://랜덤이름.netlify.app` 주소가 생깁니다. 그 주소가 그대로 초대 링크의 기반이 됩니다.

### 기존 사이트 업데이트
1. 해당 사이트 → **Deploys** 탭.
2. 아래 **“Drag and drop your site output folder here”** 박스에 새 폴더를 다시 드래그.
3. 새 배포가 자동으로 반영됩니다.

> 원한다면 **Site settings → Domain management**에서 원하는 서브도메인으로 이름을 바꿀 수 있어요.

---

## 🧪 로컬에서 바로 테스트

- 키를 넣은 뒤 `index.html`을 **더블클릭**해서 브라우저로 열면 바로 동작합니다.
  (별도 서버 불필요. `file://` 로 열어도 Supabase 통신은 됩니다.)
- 키를 아직 안 넣었다면 **“설정이 필요해요”** 화면이 뜹니다 — 정상입니다.
- 여러 명 시뮬레이션: **시크릿 창**이나 다른 브라우저로 같은 `?m=...` 링크를 열어
  다른 이름으로 참여해 보세요. 참여 인원·순위·히트맵이 실시간으로 바뀝니다.

---

## 🧩 데이터 구조 요약

| 테이블 | 주요 컬럼 |
|---|---|
| `meetings` | `id`, `title`, `description`, `host_password_hash`, `date_start`, `date_end`, `is_closed`, `created_at` |
| `participants` | `id`, `meeting_id`(FK), `name`, `created_at` |
| `availabilities` | `id`, `meeting_id`(FK), `participant_id`(FK), `date`, `slot`(`lunch`/`dinner`/`allday`), `created_at` |

- **순위 기준**: 각 날짜에 ‘가능’으로 표시한 총 인원 합산 = `점심 인원 + 저녁 인원`
  (**종일**은 점심·저녁 둘 다 카운트). 동점이면 **빠른 날짜** 우선.
- **날짜 범위**: 접속일 기준 **오늘 ~ 다음 달 말일**로 자동 계산.
- **비밀번호**: 브라우저에서 **SHA-256**(Web Crypto)으로 해시한 뒤 저장. 원문은 저장·전송하지 않음.
- **저장 방식**: 내 선택은 자동 저장. 저장 시 내 기존 행을 지우고 다시 넣어 **마지막 저장 우선**.

---

## 🙋 기능 한눈에

- **랜딩**: 모임 만들기 / 링크로 참여하기.
- **모임 만들기**: 제목·설명·주최자 비번 입력 → 고유 URL(`index.html?m=<id>`) 발급 + 복사 버튼.
- **참여**: 이름만 입력해 진입. 같은 이름이 있으면 “본인이면 이어서 수정 / 아니면 다른 이름”.
  달력에서 날짜별 **점심 / 저녁 / 종일** 선택(여러 개·언제든 정정). 자동 저장.
- **대시보드**: 참여 인원(실시간), 초대 링크·복사, 겹치는 날짜 **1·2·3위**(금·은·동).
- **결과 히트맵**: 날짜 × (점심/저녁) 그리드, 겹칠수록 색이 진하게. 칸 hover/탭 시 가능한 사람 목록.
- **관리(주최자)**: 비번 입력 시 **마감**(입력 잠금, 결과만 공개) / **삭제**.

---

## ✅ 내가 직접 해야 할 일 체크리스트

- [ ] **Supabase 가입** 후 새 프로젝트 생성 (①)
- [ ] **SQL 실행** — ②의 SQL 전문을 SQL Editor에 붙여넣고 Run
- [ ] **키 입력** — Project Settings에서 URL·anon key 복사 → `index.html` 상단 두 상수에 붙여넣기 (③)
- [ ] **로컬 테스트** — `index.html`을 열어 모임 만들기·참여 확인
- [ ] **Netlify 배포** — 폴더를 드래그(신규) 또는 Deploys 탭에 드래그(업데이트) (④)
- [ ] **링크 공유** — 만든 모임의 초대 링크를 친구들에게 전달 🎉

---

즐거운 약속 되세요. 이번엔 진짜 잡히길. 🫶
