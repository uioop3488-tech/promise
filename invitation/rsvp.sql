-- ─────────────────────────────────────────────────────────────
-- 공동 청첩장 모임 초대장: 참석 여부(RSVP) 표
-- Supabase → SQL Editor → New query 에 붙여넣고 Run (재실행해도 안전)
-- 응답 확인: Table Editor → invitation_rsvp
-- ─────────────────────────────────────────────────────────────
create table if not exists public.invitation_rsvp (
  id         bigint generated always as identity primary key,
  name       text not null check (char_length(btrim(name)) between 1 and 30),
  attending  boolean not null,
  created_at timestamptz not null default now()
);

alter table public.invitation_rsvp enable row level security;

-- 손님(공개 키)은 응답 "추가"만 가능. 목록 조회·수정·삭제는 불가.
grant insert on table public.invitation_rsvp to anon, authenticated;
revoke select, update, delete on table public.invitation_rsvp from anon, authenticated;

drop policy if exists "guests can rsvp" on public.invitation_rsvp;
create policy "guests can rsvp" on public.invitation_rsvp
  for insert to anon, authenticated
  with check (true);

-- 같은 사람이 여러 번 보내면 마지막 응답만 보고 싶을 때 쓰는 보기
create or replace view public.invitation_rsvp_latest
with (security_invoker = true) as
select distinct on (btrim(name)) btrim(name) as name, attending, created_at
from public.invitation_rsvp
order by btrim(name), created_at desc;
revoke all on public.invitation_rsvp_latest from anon, authenticated;
