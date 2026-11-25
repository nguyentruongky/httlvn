CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "pastor_nhu_danh" (
	"id" serial PRIMARY KEY NOT NULL,
	"pastor_id" integer NOT NULL,
	"nhu_danh" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "pastoral_assignments" ADD COLUMN "organization_id" integer;--> statement-breakpoint
ALTER TABLE "pastor_nhu_danh" ADD CONSTRAINT "pastor_nhu_danh_pastor_id_pastors_id_fk" FOREIGN KEY ("pastor_id") REFERENCES "public"."pastors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pastoral_assignments" ADD CONSTRAINT "pastoral_assignments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pastors" DROP COLUMN "chuc_danh";--> statement-breakpoint
ALTER TABLE "pastors" DROP COLUMN "nhu_danh";