ALTER TABLE "flavors" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Every flavor already on the menu keeps the place it had, which was the order it was
-- added in. Without this they all start at 0 and the menu falls back to the tie-break.
UPDATE "flavors" SET "sort_order" = ordered.position FROM (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS position FROM "flavors"
) AS ordered WHERE "flavors".id = ordered.id;
