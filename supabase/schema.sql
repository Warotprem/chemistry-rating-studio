create extension if not exists pgcrypto;

create table if not exists public.rating_reveals (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  rater_name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  reveal_data jsonb not null default '{}'::jsonb
);

create index if not exists rating_reveals_updated_at_idx
  on public.rating_reveals (updated_at desc);

create table if not exists public.rating_activity_logs (
  id text primary key,
  timestamp timestamptz not null,
  session_id text,
  rater_name text,
  event_type text not null,
  summary text,
  event_data jsonb not null default '{}'::jsonb
);

create index if not exists rating_activity_logs_timestamp_idx
  on public.rating_activity_logs (timestamp desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists rating_reveals_set_updated_at on public.rating_reveals;
create trigger rating_reveals_set_updated_at
before update on public.rating_reveals
for each row
execute procedure public.set_updated_at();

alter table public.rating_reveals enable row level security;
alter table public.rating_activity_logs enable row level security;

drop policy if exists "rating_reveals_public_select" on public.rating_reveals;
create policy "rating_reveals_public_select"
on public.rating_reveals
for select
to anon, authenticated
using (true);

drop policy if exists "rating_reveals_public_insert" on public.rating_reveals;
create policy "rating_reveals_public_insert"
on public.rating_reveals
for insert
to anon, authenticated
with check (true);

drop policy if exists "rating_reveals_public_update" on public.rating_reveals;
create policy "rating_reveals_public_update"
on public.rating_reveals
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "rating_activity_logs_public_select" on public.rating_activity_logs;
create policy "rating_activity_logs_public_select"
on public.rating_activity_logs
for select
to anon, authenticated
using (true);

drop policy if exists "rating_activity_logs_public_insert" on public.rating_activity_logs;
create policy "rating_activity_logs_public_insert"
on public.rating_activity_logs
for insert
to anon, authenticated
with check (true);

drop policy if exists "rating_activity_logs_public_update" on public.rating_activity_logs;
create policy "rating_activity_logs_public_update"
on public.rating_activity_logs
for update
to anon, authenticated
using (true)
with check (true);
