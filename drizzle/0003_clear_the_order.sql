CREATE TABLE IF NOT EXISTS "lessons" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "source_url" text NOT NULL,
  "tags" text[] DEFAULT '{}' NOT NULL,
  "questions" text NOT NULL,
  "contact" text NOT NULL,
  "search_text" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
