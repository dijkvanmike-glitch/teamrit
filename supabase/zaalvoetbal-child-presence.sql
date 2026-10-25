-- Applied only to the isolated zaalvoetbal database. Existing responses retained.
ALTER TABLE public.responses ADD COLUMN IF NOT EXISTS child_presence jsonb
CHECK (child_presence IS NULL OR jsonb_typeof(child_presence)='object');
