CREATE TABLE "job_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"year" text NOT NULL,
	"major" text NOT NULL,
	"roles" text[] NOT NULL,
	"link" text NOT NULL,
	"product_answer" text,
	"engineering_answer" text,
	"hours_per_week" integer NOT NULL,
	"resume_name" text NOT NULL,
	"resume_type" text NOT NULL,
	"resume" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
