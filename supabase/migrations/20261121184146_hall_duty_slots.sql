-- Additive: existing matches, responses, fruit, parents and coach_status stay intact.
begin;
create table public.hall_duty_slots (
  match_id text not null check (match_id in ('match-db7c6d63-8bec-42b2-a1a6-01805adf1715','match-08152765-277a-415b-9d53-f69406fe9388')),
  role text not null check (role in ('hall','referee')),
  slot_no integer not null check (slot_no between 1 and 2),
  parent_name text check (parent_name is null or length(parent_name) between 1 and 120),
  revision integer not null default 0 check (revision >= 0),
  primary key (match_id, role, slot_no),
  unique (match_id, role, parent_name)
);
alter table public.hall_duty_slots enable row level security;
revoke all on public.hall_duty_slots from public, anon, authenticated;
grant select on public.hall_duty_slots to anon, authenticated;
create policy hall_duties_read on public.hall_duty_slots for select to anon, authenticated using (true);
insert into public.hall_duty_slots (match_id,role,slot_no)
select m,r,s from unnest(array['match-db7c6d63-8bec-42b2-a1a6-01805adf1715','match-08152765-277a-415b-9d53-f69406fe9388']) m
cross join unnest(array['hall','referee']) r cross join generate_series(1,2) s;
-- Narrow atomic operation. Like existing TeamRit signups, identity is a roster name,
-- not an authenticated account. Public callers cannot insert/delete/overwrite slots.
create function public.set_hall_duty(p_match text,p_role text,p_slot integer,p_name text,p_revision integer,p_claim boolean)
returns setof public.hall_duty_slots
language plpgsql security definer set search_path = '' as $$
begin
  if p_name is null or not exists (select 1 from public.parents where name=p_name) then
    raise exception 'Onbekende ouder' using errcode='22023';
  end if;
  return query update public.hall_duty_slots
    set parent_name=case when p_claim then p_name else null end,revision=revision+1
    where match_id=p_match and role=p_role and slot_no=p_slot and revision=p_revision
      and ((p_claim is true and parent_name is null) or (p_claim is false and parent_name=p_name))
    returning *;
exception when unique_violation then
  raise exception 'Je staat al ingeschreven voor deze taak' using errcode='23505';
end;
$$;
revoke all on function public.set_hall_duty(text,text,integer,text,integer,boolean) from public;
grant execute on function public.set_hall_duty(text,text,integer,text,integer,boolean) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
