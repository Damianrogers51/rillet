import type { Invoice, PaymentStatus } from "@/lib/invoices";

export const invoicePageSize = 20;

/** The fields a person fills in; the server owns the id, number, statuses and activity. */
export type InvoiceInput = Pick<
  Invoice,
  | "customerName"
  | "billingEmail"
  | "billingAddress"
  | "currency"
  | "issueDate"
  | "dueDate"
  | "memo"
  | "taxRate"
  | "discount"
  | "lineItems"
>;

export type InvoiceCounts = Record<PaymentStatus | "all", number>;

export type InvoicePage = {
  invoices: Invoice[];
  /** Pass back as `cursor` for the page after this one; null on the last page. */
  nextCursor: string | null;
  counts: InvoiceCounts;
};

export type Customer = Pick<Invoice, "customerName" | "billingEmail" | "billingAddress" | "currency">;

/** Creates take a client-generated id so the optimistic row and the saved one stay the same row. */
export type CreateInvoiceRequest = InvoiceInput & { id: string; send: boolean };

/** `activityId` names the entry the server logs, matching the one already shown optimistically. */
export type ActivityRequest = { activityId: string };
