"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Chevron } from "@/components/Input";
import { CreateInvoiceSheet } from "@/components/invoice-form/CreateInvoiceSheet";
import { SegmentedFilter } from "@/components/SegmentedFilter";
import { InvoiceTable } from "@/components/list/InvoiceTable";
import { invoicePageSize, type InvoicePage } from "@/lib/api-types";
import type { Company, PaymentStatus } from "@/lib/invoices";
import {
  useCreateInvoice,
  useDeleteInvoice,
  useInvoicePage,
  usePrefetchInvoicePage,
  useSaveInvoice,
  useSendInvoice,
  useVoidInvoice,
} from "@/hooks/queries";
import { twMerge } from "tailwind-merge";

const filters = [
  { value: "all", label: "All", status: null },
  { value: "drafts", label: "Drafts", status: "Unsent" },
  { value: "open", label: "Open", status: "Open" },
  { value: "overdue", label: "Overdue", status: "Overdue" },
  { value: "paid", label: "Paid", status: "Paid" },
  { value: "void", label: "Void", status: "Voided" },
] as const satisfies { value: string; label: string; status: PaymentStatus | null }[];

const pageButtonClassName = "flex size-8.5 items-center justify-center px-0";

type FilterValue = (typeof filters)[number]["value"];

type InvoicesViewProps = {
  /** The first page of every invoice, rendered on the server. */
  initialPage: InvoicePage;
  company: Company;
  today: string;
};

export function InvoicesView({ initialPage, company, today }: InvoicesViewProps) {
  const [filter, setFilter] = useState<FilterValue>("all");
  // The cursor for each page visited so far; the previous page button steps back through them.
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
  usePrefetchInvoicePage(status, nextCursor);

  const createInvoice = useCreateInvoice();
  const saveInvoice = useSaveInvoice();
  const sendInvoice = useSendInvoice();
  const voidInvoice = useVoidInvoice();
  const deleteInvoice = useDeleteInvoice();

  const counts = page?.counts ?? initialPage.counts;
  const total = counts[status ?? "all"];
  const invoices = page?.invoices ?? [];
  const firstShown = invoices.length ? pageIndex * invoicePageSize + 1 : 0;
  const lastShown = invoices.length ? firstShown + invoices.length - 1 : 0;

  return (
    <div className="flex w-full flex-col gap-4">
      <h1 className="mb-4 text-[24px] leading-none font-[450] text-primary">Invoices</h1>

      <div className="flex items-center justify-between gap-4">
        <SegmentedFilter
          label="Filter invoices"
          // On small screens the tabs run out to the screen's left edge and fade at both ends as they scroll.
          className={twMerge(
            "min-w-0",
            "max-sm:-ml-6 max-sm:px-6",
            "max-sm:[mask-image:linear-gradient(to_right,transparent,black_1.5rem,black_calc(100%-1.5rem),transparent)]",
          )}
          value={filter}
          onChange={(value) => {
            setFilter(value);
            setCursors([null]);
          }}
          options={filters.map(({ value, label, status }) => ({ value, label, count: counts[status ?? "all"] }))}
        />
        <div className="shrink-0">
          <CreateInvoiceSheet company={company} today={today} onCreate={(invoice) => createInvoice.mutate(invoice)} />
        </div>
      </div>

      <InvoiceTable
        invoices={invoices}
        company={company}
        today={today}
        onSave={(invoice) => saveInvoice.mutate(invoice)}
        onSend={(invoice) => sendInvoice.mutate(invoice)}
        onVoid={(invoice) => voidInvoice.mutate(invoice)}
        onDelete={(invoice) => deleteInvoice.mutate(invoice)}
      />

      <nav aria-label="Pages" className="flex items-center justify-end gap-3 px-1 text-[13px] text-tertiary">
        <span className="tabular-nums">
          <span className="text-secondary">{firstShown === lastShown ? firstShown : `${firstShown}–${lastShown}`}</span>{" "}
          of {total}
        </span>
        <div className="flex gap-1">
          <Button
            variant="tertiary"
            aria-label="Previous page"
            className={pageButtonClassName}
            disabled={pageIndex === 0}
            onClick={() => setCursors(cursors.slice(0, -1))}
          >
            <Chevron orientation="left" />
          </Button>
          <Button
            variant="tertiary"
            aria-label="Next page"
            className={pageButtonClassName}
            disabled={!nextCursor}
            onClick={() => setCursors([...cursors, nextCursor])}
          >
            <Chevron orientation="right" />
          </Button>
        </div>
      </nav>
    </div>
  );
}
