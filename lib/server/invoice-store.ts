import "server-only";
import { and, count, desc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import { invoices } from "@/lib/db/schema";
import type { CreateInvoiceRequest, Customer, InvoiceCounts, InvoiceInput, InvoicePage } from "@/lib/api-types";
import {
  currencies,
  invoiceLimits,
  invoiceNumberAfter,
  isReadyToSend,
  nowOn,
  type Invoice,
  type InvoiceActivity,
  type LineItem,
  type PaymentStatus,
} from "@/lib/invoices";
import { getDb } from "@/lib/db/client";
import { getCompany } from "@/lib/server/company-store";

export type StoreResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

const paymentStatuses: PaymentStatus[] = ["Unsent", "Open", "Overdue", "Paid", "Voided"];

const notFound = { ok: false, status: 404, error: "Invoice not found" } as const;

function conflict(error: string): StoreResult<never> {
  return { ok: false, status: 409, error };
}

function toInvoice({ createdAt, paidDate, ...row }: typeof invoices.$inferSelect): Invoice {
  const invoice = { ...row, createdAt: createdAt.toISOString() };
  return paidDate ? { ...invoice, paidDate } : invoice;
}

async function findInvoice(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(invoices).where(eq(invoices.id, id));
  return row ? toInvoice(row) : null;
}

function activity(id: string, action: string, today: string): InvoiceActivity {
  return { id, timestamp: nowOn(today).toISOString(), actor: "You", action };
}

// Appends in the database rather than rewriting the list, so concurrent changes can't drop each other's entries.
function appendActivity(entry: InvoiceActivity) {
  return sql`${invoices.activity} || ${JSON.stringify([entry])}::jsonb`;
}

/** Updates the invoice only if it still matches `expected`, so two people changing it at once can't both win. */
async function updateInvoice(id: string, expected: SQL, changes: PgUpdateSetSource<typeof invoices>) {
  const db = await getDb();
  const [row] = await db
    .update(invoices)
    .set(changes)
    .where(and(eq(invoices.id, id), expected))
    .returning();
  return row ? toInvoice(row) : null;
}

function encodeCursor({ createdAt, invoiceNumber, id }: Invoice) {
  return Buffer.from(JSON.stringify([createdAt, invoiceNumber, id])).toString("base64url");
}

function decodeCursor(cursor: string) {
  try {
    const [createdAt, invoiceNumber, id] = JSON.parse(Buffer.from(cursor, "base64url").toString());
    if ([createdAt, invoiceNumber, id].every((part) => typeof part === "string"))
      return { createdAt, invoiceNumber, id };
  } catch {}
  return null;
}

export function isPaymentStatus(value: string): value is PaymentStatus {
  return (paymentStatuses as string[]).includes(value);
}

export async function listInvoices({
  status,
  cursor,
  limit,
}: {
  status: PaymentStatus | null;
  cursor: string | null;
  limit: number;
}): Promise<StoreResult<InvoicePage>> {
  const after = cursor ? decodeCursor(cursor) : null;
  if (cursor && !after) return { ok: false, status: 400, error: "Invalid cursor" };
  const db = await getDb();

  const [rows, statusCounts] = await Promise.all([
    db
      .select()
      .from(invoices)
      .where(
        and(
          status ? eq(invoices.paymentStatus, status) : undefined,
          // Newest first, so the page after the cursor is everything that sorts below it.
          after
            ? sql`(${invoices.createdAt}, ${invoices.invoiceNumber}, ${invoices.id}) < (${after.createdAt}::timestamptz, ${after.invoiceNumber}, ${after.id})`
            : undefined,
        ),
      )
      .orderBy(desc(invoices.createdAt), desc(invoices.invoiceNumber), desc(invoices.id))
      .limit(limit + 1),
    db.select({ status: invoices.paymentStatus, total: count() }).from(invoices).groupBy(invoices.paymentStatus),
  ]);

  const counts = Object.fromEntries([["all", 0], ...paymentStatuses.map((value) => [value, 0])]) as InvoiceCounts;
  for (const { status, total } of statusCounts) {
    counts[status] = total;
    counts.all += total;
  }

  const page = rows.slice(0, limit).map(toInvoice);
  const nextCursor = rows.length > limit ? encodeCursor(page.at(-1)!) : null;
  return { ok: true, value: { invoices: page, nextCursor, counts } };
}

export async function getInvoice(id: string): Promise<StoreResult<Invoice>> {
  const invoice = await findInvoice(id);
  return invoice ? { ok: true, value: invoice } : notFound;
}

/** Each customer's details from their most recent invoice, most recently billed first, for filling in a new one. */
export async function listCustomers(): Promise<Customer[]> {
  const db = await getDb();
  const rows = await db
    .selectDistinctOn([invoices.customerName], {
      customerName: invoices.customerName,
      billingEmail: invoices.billingEmail,
      billingAddress: invoices.billingAddress,
      currency: invoices.currency,
      issueDate: invoices.issueDate,
    })
    .from(invoices)
    .where(ne(invoices.customerName, ""))
    .orderBy(invoices.customerName, desc(invoices.issueDate), desc(invoices.invoiceNumber));
  return rows
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate))
    .map(({ issueDate, ...customer }) => {
      void issueDate;
      return customer;
    });
}

export async function peekInvoiceNumber(issueDate: string) {
  const db = await getDb();
  const [{ highest }] = await db
    .select({
      highest: sql<number>`coalesce(max(substring(${invoices.invoiceNumber} from '(\\d+)$')::int), 0)`.mapWith(Number),
    })
    .from(invoices);
  return invoiceNumberAfter(highest, issueDate);
}

function uniqueViolation(error: unknown): string | undefined {
  for (let current = error; current instanceof Error || (current && typeof current === "object");) {
    const { code, constraint, cause } = current as { code?: string; constraint?: string; cause?: unknown };
    if (code === "23505") return constraint ?? "unknown";
    current = cause;
  }
  return undefined;
}

export async function createInvoice({ id, send, ...input }: CreateInvoiceRequest): Promise<StoreResult<Invoice>> {
  if (await findInvoice(id)) return conflict("An invoice with this id already exists");
  const db = await getDb();
  const { today } = await getCompany();
  // Someone else can take the next number between reading it and inserting, so a clash just tries the one after.
  for (let attempt = 0; attempt < 5; attempt++) {
    const invoiceNumber = await peekInvoiceNumber(today);
    const createdAt = nowOn(today);
    const invoice: Invoice = {
      ...input,
      issueDate: today,
      createdAt: createdAt.toISOString(),
      id,
      invoiceNumber,
      status: send ? "Sent" : "Draft",
      paymentStatus: send ? "Open" : "Unsent",
      activity: [
        activity(`${invoiceNumber}-created`, send ? "Created the invoice" : "Created a draft invoice", today),
        ...(send ? [activity(`${invoiceNumber}-sent`, "Sent the invoice to the customer", today)] : []),
      ],
    };
    if (send && !isReadyToSend(invoice)) return { ok: false, status: 422, error: "This invoice isn't ready to send" };
    try {
      const [row] = await db
        .insert(invoices)
        .values({ ...invoice, createdAt })
        .returning();
      return { ok: true, value: toInvoice(row) };
    } catch (error) {
      const constraint = uniqueViolation(error);
      if (constraint === "invoices_pkey") return conflict("An invoice with this id already exists");
      if (!constraint) throw error;
    }
  }
  return conflict("Couldn't assign an invoice number, try again");
}

const isDraft = eq(invoices.status, "Draft");

export async function replaceInvoice(
  id: string,
  input: InvoiceInput,
  activityId: string,
): Promise<StoreResult<Invoice>> {
  const existing = await findInvoice(id);
  if (!existing) return notFound;
  if (existing.status !== "Draft") return conflict("Only drafts can be edited");
  const { today } = await getCompany();
  // The issue date and number are fixed once a draft exists.
  const updated = await updateInvoice(id, isDraft, {
    ...input,
    issueDate: existing.issueDate,
    activity: appendActivity(activity(activityId, "Edited the invoice", today)),
  });
  return updated ? { ok: true, value: updated } : conflict("Only drafts can be edited");
}

export async function sendInvoice(
  id: string,
  { activityId, input }: { activityId: string; input?: InvoiceInput },
): Promise<StoreResult<Invoice>> {
  const existing = await findInvoice(id);
  if (!existing) return notFound;
  if (existing.status !== "Draft") return conflict("Only drafts can be sent");
  const { today } = await getCompany();
  const draft = { ...existing, ...input, issueDate: today };
  if (!isReadyToSend(draft)) return { ok: false, status: 422, error: "This invoice isn't ready to send" };
  if (draft.dueDate < today) return invalid("The due date can't be before the day it's sent");
  const updated = await updateInvoice(id, isDraft, {
    ...input,
    issueDate: today,
    status: "Sent",
    paymentStatus: "Open",
    activity: appendActivity(activity(activityId, "Sent the invoice to the customer", today)),
  });
  return updated ? { ok: true, value: updated } : conflict("Only drafts can be sent");
}

export async function voidInvoice(id: string, { activityId }: { activityId: string }): Promise<StoreResult<Invoice>> {
  const voidable = inArray(invoices.paymentStatus, ["Open", "Overdue"]);
  const { today } = await getCompany();
  const updated = await updateInvoice(id, voidable, {
    status: "Void",
    paymentStatus: "Voided",
    activity: appendActivity(activity(activityId, "Voided the invoice", today)),
  });
  if (updated) return { ok: true, value: updated };
  return (await findInvoice(id)) ? conflict("Only open or overdue invoices can be voided") : notFound;
}

export async function deleteInvoice(id: string): Promise<StoreResult<null>> {
  const db = await getDb();
  const deleted = await db
    .delete(invoices)
    .where(and(eq(invoices.id, id), inArray(invoices.status, ["Draft", "Void"])))
    .returning({ id: invoices.id });
  if (deleted.length) return { ok: true, value: null };
  return (await findInvoice(id)) ? conflict("Only drafts and voided invoices can be deleted") : notFound;
}

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

/** Checks the shape of a request body; whether a draft is complete enough to send is checked when it's sent. */
export function parseInvoiceInput(body: unknown): StoreResult<InvoiceInput> {
  const value = (body ?? {}) as Record<string, unknown>;
  const strings = ["customerName", "billingEmail", "billingAddress", "memo"] as const;
  for (const key of strings) {
    if (typeof value[key] !== "string") return invalid(`${key} must be a string`);
    if (value[key].length > invoiceLimits[key])
      return invalid(`${key} can be at most ${invoiceLimits[key]} characters`);
  }
  if (!(currencies as readonly unknown[]).includes(value.currency)) return invalid("Unsupported currency");
  for (const key of ["issueDate", "dueDate"] as const) {
    if (typeof value[key] !== "string" || !isoDate.test(value[key])) return invalid(`${key} must be a YYYY-MM-DD date`);
  }
  for (const key of ["taxRate", "discount"] as const) {
    if (typeof value[key] !== "number" || !Number.isFinite(value[key]) || value[key] < 0) {
      return invalid(`${key} must be a non-negative number`);
    }
  }
  if ((value.taxRate as number) > invoiceLimits.taxPercent / 100) return invalid("taxRate can be at most 1");
  if (!Array.isArray(value.lineItems)) return invalid("lineItems must be a list");
  const lineItemsValid = value.lineItems.every(
    (item) =>
      typeof item?.id === "string" &&
      typeof item.description === "string" &&
      typeof item.accountCode === "string" &&
      Number.isFinite(item.quantity) &&
      Number.isFinite(item.unitPrice),
  );
  if (!lineItemsValid) return invalid("Every line item needs an id, description, account code, quantity and price");
  const lineItemsInRange = (value.lineItems as LineItem[]).every(
    (item) =>
      item.description.length <= invoiceLimits.description &&
      item.quantity >= 0 &&
      item.quantity <= invoiceLimits.quantity &&
      Math.abs(item.unitPrice) <= invoiceLimits.unitPrice,
  );
  if (!lineItemsInRange) {
    return invalid(
      `Line item descriptions can be at most ${invoiceLimits.description} characters, quantities between 0 and ` +
        `${invoiceLimits.quantity}, and unit prices within ±${invoiceLimits.unitPrice}`,
    );
  }
  const { customerName, billingEmail, billingAddress, memo, currency, issueDate, dueDate } = value as InvoiceInput;
  const { taxRate, discount, lineItems } = value as InvoiceInput;
  return {
    ok: true,
    value: {
      customerName,
      billingEmail,
      billingAddress,
      memo,
      currency,
      issueDate,
      dueDate,
      taxRate,
      discount,
      lineItems: lineItems.map(({ id, description, quantity, unitPrice, accountCode }) => ({
        id,
        description,
        quantity,
        unitPrice,
        accountCode,
      })),
    },
  };
}

function invalid(error: string): StoreResult<never> {
  return { ok: false, status: 422, error };
}
