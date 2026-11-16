-- ─────────────────────────────────────────────────────────────
-- 청첩장 참석 의사(RSVP) 스키마
-- Supabase SQL Editor에 통째로 붙여넣고 Run 하세요. (재실행해도 안전)
--
-- · 하객은 참석 의사를 '보내기'만 할 수 있고, 목록은 볼 수 없습니다.
-- · 응답은 Supabase Table Editor → rsvp 에서 확인/CSV 다운로드하세요.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.rsvp (
  id         bigint generated always as identity primary key,
  side       text not null check (side in ('신랑', '신부')),
  attend     boolean not null,
  meal       text check (meal in ('예정', '안함')),
  name       text not null check (char_length(name) between 1 and 20),
  guests     int  not null check (guests between 0 and 6),
  phone4     text not null check (phone4 ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now()
);

alter table public.rsvp enable row level security;

revoke all on public.rsvp from anon, authenticated;
grant insert (side, attend, meal, name, guests, phone4) on public.rsvp to anon, authenticated;

drop policy if exists "rsvp public insert" on public.rsvp;
create policy "rsvp public insert"
  on public.rsvp for insert to anon, authenticated with check (true);

-- 집계용 보기 (Table Editor 또는 SQL Editor에서 select * from rsvp_summary;)
create or replace view public.rsvp_summary with (security_invoker = true) as
select side,
       count(*) filter (where attend)                      as 참석_응답,
       coalesce(sum(guests) filter (where attend), 0)      as 참석_인원,
       coalesce(sum(guests) filter (where meal = '예정'), 0) as 식사_인원,
       count(*) filter (where not attend)                  as 불참_응답
  from public.rsvp
 group by side;
revoke all on public.rsvp_summary from anon, authenticated;
