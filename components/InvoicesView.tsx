"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { CreateInvoiceSheet } from "@/components/CreateInvoiceSheet";
import { InvoiceFilters } from "@/components/InvoiceFilters";
import { InvoiceTable } from "@/components/InvoiceTable";
import { fetchInvoicePage, invoicePageSize, type InvoicePage } from "@/lib/invoice-api";
import type { Company, PaymentStatus } from "@/lib/invoices";
import {
  invoiceKeys,
  useCreateInvoice,
  useDeleteInvoice,
  useInvoicePage,
  useSaveInvoice,
  useSendInvoice,
  useVoidInvoice,
} from "@/lib/queries";

const filters = [
  { value: "all", label: "All", status: null },
  { value: "paid", label: "Paid", status: "Paid" },
  { value: "overdue", label: "Overdue", status: "Overdue" },
  { value: "drafts", label: "Drafts", status: "Unsent" },
] as const satisfies { value: string; label: string; status: PaymentStatus | null }[];

type FilterValue = (typeof filters)[number]["value"];

type InvoicesViewProps = {
  /** The first page of every invoice, rendered on the server. */
  initialPage: InvoicePage;
  company: Company;
  today: string;
};

export function InvoicesView({ initialPage, company, today }: InvoicesViewProps) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterValue>("all");
  // The cursor for each page visited so far; Previous steps back through them.
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const { status } = filters.find((option) => option.value === filter)!;
  const cursor = cursors.at(-1)!;
  const pageIndex = cursors.length - 1;
  const { data: page, isPlaceholderData } = useInvoicePage(
    status,
    cursor,
    status === null && cursor === null ? initialPage : undefined,
  );

  // Deleting the last invoice on a later page leaves it empty, so step back to the one before.
  if (page && !isPlaceholderData && page.invoices.length === 0 && pageIndex > 0) setCursors(cursors.slice(0, -1));

  const nextCursor = isPlaceholderData ? null : (page?.nextCursor ?? null);
  useEffect(() => {
    if (!nextCursor) return;
    queryClient.prefetchQuery({
      queryKey: invoiceKeys.list(status, nextCursor),
      queryFn: ({ signal }) => fetchInvoicePage({ status, cursor: nextCursor }, signal),
    });
  }, [queryClient, status, nextCursor]);

  const createInvoice = useCreateInvoice();
  const saveInvoice = useSaveInvoice();
  const sendInvoice = useSendInvoice();
  const voidInvoice = useVoidInvoice();
  const deleteInvoice = useDeleteInvoice();

  const counts = page?.counts ?? initialPage.counts;
  const total = counts[status ?? "all"];
  const invoices = page?.invoices ?? [];
  const firstShown = pageIndex * invoicePageSize + 1;
  const lastShown = firstShown + Math.max(invoices.length - 1, 0);

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <h1 className="text-[24px] leading-none font-[450] text-primary">Invoices</h1>
        {/* Centers the button on the title line, like the drawer headers. */}
        <div className="-my-[5px]">
          <CreateInvoiceSheet company={company} today={today} onCreate={(invoice) => createInvoice.mutate(invoice)} />
        </div>
      </div>

      <InvoiceFilters
        value={filter}
        onChange={(value) => {
          setFilter(value);
          setCursors([null]);
        }}
        options={filters.map(({ value, label, status }) => ({ value, label, count: counts[status ?? "all"] }))}
      />

      <InvoiceTable
        invoices={invoices}
        company={company}
        today={today}
        onSave={(invoice) => saveInvoice.mutate(invoice)}
        onSend={(invoice) => sendInvoice.mutate(invoice)}
        onVoid={(invoice) => voidInvoice.mutate(invoice)}
        onDelete={(invoice) => deleteInvoice.mutate(invoice)}
      />

      {total > invoicePageSize && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-4 px-1 text-[13px] text-tertiary">
          <span className="tabular-nums">
            <span className="text-secondary">
              {firstShown === lastShown ? firstShown : `${firstShown}–${lastShown}`}
            </span>{" "}
            of {total}
          </span>
          <div className="flex gap-1">
            <Button variant="secondary" disabled={pageIndex === 0} onClick={() => setCursors(cursors.slice(0, -1))}>
              Previous
            </Button>
            <Button variant="secondary" disabled={!nextCursor} onClick={() => setCursors([...cursors, nextCursor])}>
              Next
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
