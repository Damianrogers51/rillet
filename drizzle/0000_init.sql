CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"customer_name" text NOT NULL,
	"billing_email" text NOT NULL,
	"billing_address" text NOT NULL,
	"payment_terms" text NOT NULL,
	"status" text NOT NULL,
	"payment_status" text NOT NULL,
	"currency" text NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"paid_date" date,
	"memo" text NOT NULL,
	"tax_rate" double precision NOT NULL,
	"discount" double precision NOT NULL,
	"line_items" jsonb NOT NULL,
	"activity" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoiceNumber_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE INDEX "invoices_listing_idx" ON "invoices" USING btree ("issue_date" DESC NULLS LAST,"invoice_number" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "invoices_payment_status_idx" ON "invoices" USING btree ("payment_status");