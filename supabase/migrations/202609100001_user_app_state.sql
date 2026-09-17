create table if not exists public.user_app_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint user_app_state_data_is_object check (jsonb_typeof(data) = 'object'),
  constraint user_app_state_data_size check (octet_length(data::text) <= 5000000)
);

alter table public.user_app_state enable row level security;
alter table public.user_app_state force row level security;

revoke all on table public.user_app_state from anon;
revoke all on table public.user_app_state from authenticated;
grant select, insert, update, delete on table public.user_app_state to authenticated;

drop policy if exists "Users can read their own app state" on public.user_app_state;
create policy "Users can read their own app state"
on public.user_app_state
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Users can insert their own app state" on public.user_app_state;
create policy "Users can insert their own app state"
on public.user_app_state
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Users can update their own app state" on public.user_app_state;
create policy "Users can update their own app state"
on public.user_app_state
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Users can delete their own app state" on public.user_app_state;
create policy "Users can delete their own app state"
on public.user_app_state
for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create or replace function public.set_user_app_state_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

revoke all on function public.set_user_app_state_updated_at() from public, anon, authenticated;

drop trigger if exists set_user_app_state_updated_at on public.user_app_state;
create trigger set_user_app_state_updated_at
  before update on public.user_app_state
  for each row execute function public.set_user_app_state_updated_at();
