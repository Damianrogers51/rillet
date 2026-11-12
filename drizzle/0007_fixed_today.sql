-- Invoices created before new timestamps followed the demo calendar hold real dates past it; keep their time of day but move them onto that calendar's today.
CREATE FUNCTION "pg_temp"."onto_today"(ts timestamptz) RETURNS timestamptz LANGUAGE sql AS $$
  SELECT CASE
    WHEN (ts AT TIME ZONE 'America/New_York')::date > c."as_of_date"
      THEN (c."as_of_date" + (ts AT TIME ZONE 'America/New_York')::time) AT TIME ZONE 'America/New_York'
    ELSE ts
  END
  FROM "company" c LIMIT 1
$$;--> statement-breakpoint
UPDATE "invoices" SET
  "created_at" = pg_temp.onto_today("created_at"),
  "activity" = (
    SELECT coalesce(jsonb_agg(
      jsonb_set(entry, '{timestamp}', to_jsonb(to_char(pg_temp.onto_today((entry->>'timestamp')::timestamptz) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
      ORDER BY position
    ), '[]'::jsonb)
    FROM jsonb_array_elements("activity") WITH ORDINALITY AS entries(entry, position)
  )
WHERE "created_at" <> pg_temp.onto_today("created_at")
  OR EXISTS (
    SELECT 1 FROM jsonb_array_elements("activity") entry
    WHERE (entry->>'timestamp')::timestamptz <> pg_temp.onto_today((entry->>'timestamp')::timestamptz)
  );--> statement-breakpoint
ALTER TABLE "company" DROP COLUMN "as_of_date";
