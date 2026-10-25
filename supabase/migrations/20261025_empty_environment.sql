BEGIN;
CREATE TABLE public."parents" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"name" text NOT NULL,
"children" text[] DEFAULT '{}'::text[] NOT NULL
);
ALTER TABLE public."parents" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."responses" (
"parent_name" text NOT NULL,
"present" text,
"drive" text,
"seats" text,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"match_id" text NOT NULL,
"parent_present" text,
"family_key" text NOT NULL
);
ALTER TABLE public."responses" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."coach_status" (
"match_id" text NOT NULL,
"present" text,
"substitute_name" text,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public."coach_status" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."fruit" (
"match_id" text NOT NULL,
"parent_name" text,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public."fruit" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."matches" (
"id" text NOT NULL,
"data" jsonb NOT NULL,
"revision" integer NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public."matches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."parents" ADD CONSTRAINT "parents_pkey" PRIMARY KEY (id);
ALTER TABLE public."parents" ADD CONSTRAINT "parents_name_key" UNIQUE (name);
ALTER TABLE public."responses" ADD CONSTRAINT "responses_parent_name_fkey" FOREIGN KEY (parent_name) REFERENCES parents(name) ON DELETE CASCADE;
ALTER TABLE public."fruit" ADD CONSTRAINT "fruit_pkey" PRIMARY KEY (match_id);
ALTER TABLE public."fruit" ADD CONSTRAINT "fruit_parent_name_fkey" FOREIGN KEY (parent_name) REFERENCES parents(name);
ALTER TABLE public."coach_status" ADD CONSTRAINT "coach_status_pkey" PRIMARY KEY (match_id);
ALTER TABLE public."responses" ADD CONSTRAINT "responses_pkey" PRIMARY KEY (family_key, match_id);
ALTER TABLE public."matches" ADD CONSTRAINT "matches_id_check" CHECK ((id ~ '^(m[0-9]+|match-[0-9a-f-]{36})$'::text));
ALTER TABLE public."matches" ADD CONSTRAINT "matches_data_check" CHECK ((jsonb_typeof(data) = 'object'::text));
ALTER TABLE public."matches" ADD CONSTRAINT "matches_revision_check" CHECK ((revision > 0));
ALTER TABLE public."matches" ADD CONSTRAINT "matches_pkey" PRIMARY KEY (id);
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
COMMIT;