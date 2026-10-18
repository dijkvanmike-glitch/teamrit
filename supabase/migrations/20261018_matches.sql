-- Additive only: do not change responses, coach_status, fruit, or parents.
-- Rows store overrides/new matches; the seed keeps all original IDs and metadata.
begin;
create table if not exists public.matches (
  id text primary key check (id ~ '^(m[0-9]+|match-[0-9a-f-]{36})$'),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  revision integer not null check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.matches enable row level security;
revoke all on public.matches from anon, authenticated;
grant select on public.matches to anon, authenticated;
grant select, insert, update on public.matches to service_role;
create policy matches_public_read on public.matches for select to anon, authenticated using (true);
-- No insert/update/delete policies: public clients cannot write, even with the anon key.
commit;
