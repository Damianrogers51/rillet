import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  deleteInvoiceRequest,
  fetchCustomers,
  fetchInvoicePage,
  fetchNextInvoiceNumber,
  invoiceInput,
  postInvoice,
  postSendInvoice,
  postVoidInvoice,
  putInvoice,
  type InvoiceCounts,
  type InvoicePage,
} from "@/lib/invoice-api";
import type { Invoice, PaymentStatus } from "@/lib/invoices";

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
