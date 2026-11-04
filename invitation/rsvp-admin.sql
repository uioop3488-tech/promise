-- ─────────────────────────────────────────────────────────────
-- 참석자 명단 보기(admin.html)용 설정
-- rsvp.sql 을 먼저 실행한 뒤, 아래 '여기에-비밀번호' 를 원하는 비밀번호로 바꾸고 Run
-- 비밀번호를 바꾸고 싶으면 값만 고쳐서 다시 Run 하면 돼요.
-- ─────────────────────────────────────────────────────────────

-- 1) 관리자 비밀번호(해시로만 저장, 손님은 접근 불가)
create table if not exists public.invitation_admin (
  id        int primary key default 1 check (id = 1),
  pass_hash text not null
);
alter table public.invitation_admin enable row level security;
revoke all on table public.invitation_admin from anon, authenticated;

insert into public.invitation_admin (id, pass_hash)
values (1, encode(sha256(convert_to('여기에-비밀번호', 'UTF8')), 'hex'))
on conflict (id) do update set pass_hash = excluded.pass_hash;

-- 2) 비밀번호가 맞을 때만 응답 목록을 돌려주는 함수
create or replace function public.invitation_rsvp_list(p_pass text)
returns table (name text, attending boolean, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.invitation_admin a
    where a.id = 1
      and a.pass_hash = encode(sha256(convert_to(coalesce(p_pass, ''), 'UTF8')), 'hex')
  ) then
    perform pg_sleep(1);  -- 비밀번호 마구 넣어보기 방지
    raise exception 'wrong password' using errcode = '28P01';
  end if;

  return query
    select r.name, r.attending, r.created_at
    from public.invitation_rsvp r
    order by r.created_at desc;
end;
$$;

revoke all on function public.invitation_rsvp_list(text) from public;
grant execute on function public.invitation_rsvp_list(text) to anon, authenticated;
