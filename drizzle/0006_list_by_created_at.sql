-- Rows inserted before the app set created_at itself hold the time the seed ran; their first activity entry is the real creation time.
UPDATE "invoices" SET "created_at" = ("activity"->0->>'timestamp')::timestamptz WHERE jsonb_array_length("activity") > 0;--> statement-breakpoint
DROP INDEX "invoices_listing_idx";--> statement-breakpoint
CREATE INDEX "invoices_listing_idx" ON "invoices" USING btree ("created_at" DESC NULLS LAST,"invoice_number" DESC NULLS LAST,"id" DESC NULLS LAST);