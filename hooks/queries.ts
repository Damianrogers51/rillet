import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  invoicePageSize,
  type ActivityRequest,
  type CreateInvoiceRequest,
  type Customer,
  type InvoiceCounts,
  type InvoiceInput,
  type InvoicePage,
} from "@/lib/api-types";
import type { Invoice, PaymentStatus } from "@/lib/invoices";

function invoiceInput(invoice: Invoice): InvoiceInput {
  const {
    customerName,
    billingEmail,
    billingAddress,
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
    currency,
    issueDate,
    dueDate,
    memo,
    taxRate,
    discount,
    lineItems,
  };
}

class ApiError extends Error {
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

function fetchInvoicePage(
  { status, cursor }: { status: PaymentStatus | null; cursor: string | null },
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ limit: String(invoicePageSize) });
  if (status) params.set("status", status);
  if (cursor) params.set("cursor", cursor);
  return request<InvoicePage>(`/api/invoices?${params}`, { signal });
}

function fetchCustomers(signal?: AbortSignal) {
  return request<Customer[]>("/api/customers", { signal });
}

function fetchNextInvoiceNumber(issueDate: string, signal?: AbortSignal) {
  return request<{ invoiceNumber: string }>(`/api/invoices/next-number?issueDate=${issueDate}`, { signal });
}

function postInvoice(body: CreateInvoiceRequest) {
  return request<Invoice>("/api/invoices", { method: "POST", body: JSON.stringify(body) });
}

function putInvoice(id: string, body: InvoiceInput & ActivityRequest) {
  return request<Invoice>(`/api/invoices/${id}`, { method: "PUT", body: JSON.stringify(body) });
}

/** Sends a draft, saving any edits made alongside it first. */
function postSendInvoice(id: string, body: ActivityRequest & { input?: InvoiceInput }) {
  return request<Invoice>(`/api/invoices/${id}/send`, { method: "POST", body: JSON.stringify(body) });
}

function postVoidInvoice(id: string, body: ActivityRequest) {
  return request<Invoice>(`/api/invoices/${id}/void`, { method: "POST", body: JSON.stringify(body) });
}

function deleteInvoiceRequest(id: string) {
  return request<void>(`/api/invoices/${id}`, { method: "DELETE" });
}

export const invoiceKeys = {
  all: ["invoices"] as const,
  lists: () => [...invoiceKeys.all, "list"] as const,
  list: (status: PaymentStatus | null, cursor: string | null) => [...invoiceKeys.lists(), { status, cursor }] as const,
  nextNumbers: () => [...invoiceKeys.all, "next-number"] as const,
  nextNumber: (issueDate: string) => [...invoiceKeys.nextNumbers(), issueDate] as const,
};

export const customerKeys = { all: ["customers"] as const };

export function useInvoicePage(status: PaymentStatus | null, cursor: string | null, initialPage?: InvoicePage) {
  return useQuery({
    queryKey: invoiceKeys.list(status, cursor),
    queryFn: ({ signal }) => fetchInvoicePage({ status, cursor }, signal),
    // Keeps the current page on screen while the next one loads, instead of flashing an empty table.
    placeholderData: keepPreviousData,
    initialData: initialPage,
  });
}

/** Loads the page after the current one in the background, so Next shows it straight away. */
export function usePrefetchInvoicePage(status: PaymentStatus | null, cursor: string | null) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!cursor) return;
    queryClient.prefetchQuery({
      queryKey: invoiceKeys.list(status, cursor),
      queryFn: ({ signal }) => fetchInvoicePage({ status, cursor }, signal),
    });
  }, [queryClient, status, cursor]);
}

export function useCustomers() {
  return useQuery({ queryKey: customerKeys.all, queryFn: ({ signal }) => fetchCustomers(signal), staleTime: 60_000 });
}

export function useNextInvoiceNumber(issueDate: string, enabled: boolean) {
  return useQuery({
    queryKey: invoiceKeys.nextNumber(issueDate),
    queryFn: ({ signal }) => fetchNextInvoiceNumber(issueDate, signal),
    select: ({ invoiceNumber }) => invoiceNumber,
    enabled,
  });
}

function adjustCounts(counts: InvoiceCounts, from: PaymentStatus | null, to: PaymentStatus | null): InvoiceCounts {
  if (from === to) return counts;
  const next = { ...counts };
  if (from) next[from] -= 1;
  if (to) next[to] += 1;
  if (!from) next.all += 1;
  if (!to) next.all -= 1;
  return next;
}

type PageParams = { status: PaymentStatus | null; cursor: string | null };

function patchPages(queryClient: QueryClient, patch: (page: InvoicePage, params: PageParams) => InvoicePage) {
  for (const [key, page] of queryClient.getQueriesData<InvoicePage>({ queryKey: invoiceKeys.lists() })) {
    if (page) queryClient.setQueryData(key, patch(page, key.at(-1) as PageParams));
  }
}

function cachedStatus(queryClient: QueryClient, id: string) {
  for (const [, page] of queryClient.getQueriesData<InvoicePage>({ queryKey: invoiceKeys.lists() })) {
    const invoice = page?.invoices.find((candidate) => candidate.id === id);
    if (invoice) return invoice.paymentStatus;
  }
  return null;
}

function showUpdated(queryClient: QueryClient, invoice: Invoice) {
  const previousStatus = cachedStatus(queryClient, invoice.id);
  patchPages(queryClient, (page) => ({
    ...page,
    invoices: page.invoices.map((existing) => (existing.id === invoice.id ? invoice : existing)),
    counts: previousStatus ? adjustCounts(page.counts, previousStatus, invoice.paymentStatus) : page.counts,
  }));
}

/**
 * Applies a change to every cached page straight away so the table and its animations don't wait on the network,
 * rolls it back if the request fails, and refetches afterwards so the server's version wins.
 */
function useOptimisticMutation(
  request: (invoice: Invoice) => Promise<unknown>,
  show: (queryClient: QueryClient, invoice: Invoice) => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onMutate: async (invoice) => {
      await queryClient.cancelQueries({ queryKey: invoiceKeys.all });
      const snapshot = queryClient.getQueriesData({ queryKey: invoiceKeys.all });
      show(queryClient, invoice);
      return { snapshot };
    },
    onError: (error, _invoice, context) => {
      context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
      console.error(error);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: invoiceKeys.all }),
        queryClient.invalidateQueries({ queryKey: customerKeys.all }),
      ]),
  });
}

/** The server logs its activity entry under this id, so it matches the entry already shown optimistically. */
const latestActivityId = (invoice: Invoice) => invoice.activity.at(-1)?.id ?? crypto.randomUUID();

export function useCreateInvoice() {
  return useOptimisticMutation(
    (invoice) => postInvoice({ ...invoiceInput(invoice), id: invoice.id, send: invoice.status !== "Draft" }),
    (queryClient, invoice) => {
      patchPages(queryClient, (page, { status, cursor }) => {
        const counts = adjustCounts(page.counts, null, invoice.paymentStatus);
        const shown = cursor === null && (!status || status === invoice.paymentStatus);
        return { ...page, counts, invoices: shown ? [invoice, ...page.invoices] : page.invoices };
      });
      // The next form previews the number after this one before the server confirms it.
      queryClient.setQueriesData<{ invoiceNumber: string }>(
        { queryKey: invoiceKeys.nextNumbers() },
        (data) =>
          data && {
            invoiceNumber: data.invoiceNumber.replace(/\d+$/, (sequence) =>
              String(Number(sequence) + 1).padStart(sequence.length, "0"),
            ),
          },
      );
    },
  );
}

export function useSaveInvoice() {
  return useOptimisticMutation(
    (invoice) => putInvoice(invoice.id, { ...invoiceInput(invoice), activityId: latestActivityId(invoice) }),
    showUpdated,
  );
}

/** Takes the invoice as it looks once sent, including any edits made alongside sending it. */
export function useSendInvoice() {
  return useOptimisticMutation(
    (invoice) => postSendInvoice(invoice.id, { activityId: latestActivityId(invoice), input: invoiceInput(invoice) }),
    showUpdated,
  );
}

/** Takes the invoice as it looks once voided. */
export function useVoidInvoice() {
  return useOptimisticMutation(
    (invoice) => postVoidInvoice(invoice.id, { activityId: latestActivityId(invoice) }),
    showUpdated,
  );
}

export function useDeleteInvoice() {
  return useOptimisticMutation(
    (invoice) => deleteInvoiceRequest(invoice.id),
    (queryClient, invoice) => {
      const previousStatus = cachedStatus(queryClient, invoice.id) ?? invoice.paymentStatus;
      patchPages(queryClient, (page) => ({
        ...page,
        invoices: page.invoices.filter((existing) => existing.id !== invoice.id),
        counts: adjustCounts(page.counts, previousStatus, null),
      }));
    },
  );
}
