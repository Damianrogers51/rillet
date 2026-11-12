import { date, doublePrecision, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { InvoiceActivity, InvoiceStatus, LineItem, PaymentStatus } from "@/lib/invoices";

export const invoices = pgTable(
  "invoices",
  {
    id: text().primaryKey(),
    invoiceNumber: text().notNull().unique(),
    customerName: text().notNull(),
    billingEmail: text().notNull(),
    billingAddress: text().notNull(),
    status: text().$type<InvoiceStatus>().notNull(),
    paymentStatus: text().$type<PaymentStatus>().notNull(),
    currency: text().notNull(),
    issueDate: date({ mode: "string" }).notNull(),
    dueDate: date({ mode: "string" }).notNull(),
    paidDate: date({ mode: "string" }),
    memo: text().notNull(),
    taxRate: doublePrecision().notNull(),
    discount: doublePrecision().notNull(),
    lineItems: jsonb().$type<LineItem[]>().notNull(),
    activity: jsonb().$type<InvoiceActivity[]>().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Matches the table's newest-first order, so each page and its cursor lookup is a single index range.
    index("invoices_listing_idx").on(table.createdAt.desc(), table.invoiceNumber.desc(), table.id.desc()),
    index("invoices_payment_status_idx").on(table.paymentStatus),
  ],
  // Supabase serves public tables over its REST API to anyone holding the public key; with row-level security on and
  // no policies, only the app's own database connection can reach this one.
).enableRLS();

/** The business sending the invoices; a single row. */
export const company = pgTable("company", {
  id: integer().primaryKey().default(1),
  name: text().notNull(),
  industry: text().notNull(),
  baseCurrency: text().notNull(),
}).enableRLS();
