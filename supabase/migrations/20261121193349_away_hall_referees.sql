-- Add one referee slot per away hall block. Retain all existing rows and permissions.
begin;
alter table public.hall_duty_slots drop constraint hall_duty_slots_match_id_check;
alter table public.hall_duty_slots add constraint hall_duty_slots_match_id_check check (match_id in (
'match-db7c6d63-8bec-42b2-a1a6-01805adf1715','match-08152765-277a-415b-9d53-f69406fe9388',
'match-c90e9736-79f2-4349-8b05-f8b894ef813a','match-2a247f9c-2087-473b-84d8-8891121fb1a9','match-00849cc8-26fc-4ef9-a0a4-f8b7ddcb8038'));
alter table public.hall_duty_slots add constraint hall_duty_slots_away_role_check check (
match_id in ('match-db7c6d63-8bec-42b2-a1a6-01805adf1715','match-08152765-277a-415b-9d53-f69406fe9388') or (role='referee' and slot_no=1));
insert into public.hall_duty_slots(match_id,role,slot_no)
select m,'referee',1 from unnest(array['match-c90e9736-79f2-4349-8b05-f8b894ef813a','match-2a247f9c-2087-473b-84d8-8891121fb1a9','match-00849cc8-26fc-4ef9-a0a4-f8b7ddcb8038']) m
on conflict (match_id,role,slot_no) do nothing;
notify pgrst,'reload schema';
commit;
