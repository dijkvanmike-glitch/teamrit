-- Preserve every slot and signup; close the extra referee slot for new claims.
begin;
create or replace function public.set_hall_duty(p_match text,p_role text,p_slot integer,p_name text,p_revision integer,p_claim boolean)
returns setof public.hall_duty_slots
language plpgsql security definer set search_path = '' as $$
begin
  if p_name is null or not exists (select 1 from public.parents where name=p_name) then
    raise exception 'Onbekende ouder' using errcode='22023';
  end if;
  if p_claim is true and p_role='referee' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_match || ':referee',0));
    if p_slot<>1 or exists (select 1 from public.hall_duty_slots where match_id=p_match and role='referee' and parent_name is not null) then
      return;
    end if;
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
notify pgrst, 'reload schema';
commit;
