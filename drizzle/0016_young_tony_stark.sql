ALTER TABLE "orders" ADD COLUMN "free_cookie" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "free_cookie_used_at" timestamp with time zone;