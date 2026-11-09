UPDATE "orders" SET "free_cookie_count" = 1 WHERE "free_cookie";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "free_cookie" DROP NOT NULL;
