CREATE TABLE "company" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"industry" text NOT NULL,
	"base_currency" text NOT NULL,
	"as_of_date" date NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "invoice_prompt_examples" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"input" text NOT NULL,
	"expected_draft_fields" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoice_prompt_examples" ENABLE ROW LEVEL SECURITY;