import type { Invoice, PaymentStatus } from "@/lib/invoices";

export const invoicePageSize = 20;

/** The fields a person fills in; the server owns the id, number, statuses and activity. */
export type InvoiceInput = Pick<
  Invoice,
  | "customerName"
  | "billingEmail"
  | "billingAddress"
  | "paymentTerms"
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

export type Customer = Pick<Invoice, "customerName" | "billingEmail" | "billingAddress" | "currency" | "paymentTerms">;

/** Creates take a client-generated id so the optimistic row and the saved one stay the same row. */
export type CreateInvoiceRequest = InvoiceInput & { id: string; send: boolean };

/** `activityId` names the entry the server logs, matching the one already shown optimistically. */
export type ActivityRequest = { activityId: string };

export function invoiceInput(invoice: Invoice): InvoiceInput {
  const {
    customerName,
    billingEmail,
    billingAddress,
    paymentTerms,
    currency,
    issueDate,
    dueDate,
    memo,
    taxRate,
    discount,
    lineItems,
  } = invoice;
  return {
    customerName,
    billingEmail,
    billingAddress,
    paymentTerms,
    currency,
    issueDate,
    dueDate,
    memo,
    taxRate,
    discount,
    lineItems,
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(body?.error ?? response.statusText, response.status);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export function fetchInvoicePage(
  { status, cursor }: { status: PaymentStatus | null; cursor: string | null },
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ limit: String(invoicePageSize) });
  if (status) params.set("status", status);
  if (cursor) params.set("cursor", cursor);
  return request<InvoicePage>(`/api/invoices?${params}`, { signal });
}

export function fetchCustomers(signal?: AbortSignal) {
  return request<Customer[]>("/api/customers", { signal });
}

export function fetchNextInvoiceNumber(issueDate: string, signal?: AbortSignal) {
  return request<{ invoiceNumber: string }>(`/api/invoices/next-number?issueDate=${issueDate}`, { signal });
}

export function postInvoice(body: CreateInvoiceRequest) {
  return request<Invoice>("/api/invoices", { method: "POST", body: JSON.stringify(body) });
}

export function putInvoice(id: string, body: InvoiceInput & ActivityRequest) {
  return request<Invoice>(`/api/invoices/${id}`, { method: "PUT", body: JSON.stringify(body) });
}

/** Sends a draft, saving any edits made alongside it first. */
export function postSendInvoice(id: string, body: ActivityRequest & { input?: InvoiceInput }) {
  return request<Invoice>(`/api/invoices/${id}/send`, { method: "POST", body: JSON.stringify(body) });
}

export function postVoidInvoice(id: string, body: ActivityRequest) {
  return request<Invoice>(`/api/invoices/${id}/void`, { method: "POST", body: JSON.stringify(body) });
}

export function deleteInvoiceRequest(id: string) {
  return request<void>(`/api/invoices/${id}`, { method: "DELETE" });
}
