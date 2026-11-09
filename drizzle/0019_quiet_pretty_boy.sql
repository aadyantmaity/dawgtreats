UPDATE "orders" SET "free_cookie_count" = 1 WHERE "free_cookie";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "free_cookie";
