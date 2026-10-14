-- ─────────────────────────────────────────────────────────────
-- 청첩장 방명록 스키마
-- Supabase SQL Editor에 통째로 붙여넣고 Run 하세요. (재실행해도 안전)
--
-- · 누구나 이름/메시지를 읽고 남길 수 있습니다.
-- · 글을 남길 때 정한 비밀번호가 맞아야만 삭제할 수 있고,
--   비밀번호는 서버에서 해시(bcrypt)로 저장·검증합니다.
-- · 비밀번호 해시 컬럼은 anon 키로 읽을 수 없습니다.
-- ─────────────────────────────────────────────────────────────

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.guestbook (
  id            bigint generated always as identity primary key,
  name          text not null check (char_length(name) between 1 and 20),
  message       text not null check (char_length(message) between 1 and 300),
  password_hash text not null,
  created_at    timestamptz not null default now()
);

create index if not exists guestbook_created_at_idx on public.guestbook (created_at desc);

alter table public.guestbook enable row level security;

-- 읽기: 공개 컬럼만 허용 (password_hash 제외)
revoke all on public.guestbook from anon, authenticated;
grant select (id, name, message, created_at) on public.guestbook to anon, authenticated;

drop policy if exists "guestbook public read" on public.guestbook;
create policy "guestbook public read"
  on public.guestbook for select to anon, authenticated using (true);

-- 쓰기: 아래 함수로만 가능 (비밀번호를 서버에서 해시)
create or replace function public.guestbook_add(p_name text, p_message text, p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if char_length(coalesce(p_password, '')) < 4 then
    raise exception '비밀번호는 4자 이상이어야 해요';
  end if;
  insert into public.guestbook (name, message, password_hash)
  values (btrim(p_name), btrim(p_message), crypt(p_password, gen_salt('bf')));
end;
$$;

-- 삭제: 비밀번호가 맞을 때만. 삭제되면 true, 틀리면 false
create or replace function public.guestbook_delete(p_id bigint, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  n int;
begin
  delete from public.guestbook
   where id = p_id and password_hash = crypt(p_password, password_hash);
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke all on function public.guestbook_add(text, text, text) from public;
revoke all on function public.guestbook_delete(bigint, text) from public;
grant execute on function public.guestbook_add(text, text, text) to anon, authenticated;
grant execute on function public.guestbook_delete(bigint, text) to anon, authenticated;
