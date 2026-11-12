"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { CopyButton, copyPillClassName } from "@/components/CopyButton";
import { InvoiceDetailsSheet } from "@/components/InvoiceDetailsSheet";
import { StatusBadge } from "@/components/StatusBadge";
import { dateFormat, daysUntil, formatMoney, pluralizeDays, shortDateFormat } from "@/lib/format";
import { invoiceTotalCents, type Company, type Invoice } from "@/lib/invoices";
import { twMerge } from "tailwind-merge";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

function DueDate({ invoice, today }: { invoice: Invoice; today: string }) {
  const dueDate = new Date(invoice.dueDate);
  const absolute = dateFormat.format(dueDate);

  if (invoice.paymentStatus === "Paid" && invoice.paidDate) {
    return <span title={`Due ${absolute}`}>Paid {shortDateFormat.format(new Date(invoice.paidDate))}</span>;
  }

  if (invoice.paymentStatus === "Voided") {
    return <span>—</span>;
  }

  const daysUntilDue = daysUntil(invoice.dueDate, today);

  if (daysUntilDue < 0) {
    return (
      <span title={absolute} className="text-red-700">
        {pluralizeDays(-daysUntilDue)} overdue
      </span>
    );
  }

  return <span title={absolute}>{daysUntilDue === 0 ? "Due today" : `Due in ${pluralizeDays(daysUntilDue)}`}</span>;
}

// Invoices created within the last hour show how long ago, so new ones stand out from the issue dates around them.
function IssuedDate({ invoice }: { invoice: Invoice }) {
  const absolute = dateFormat.format(new Date(invoice.issueDate));
  const createdAt = new Date(invoice.activity[0]?.timestamp ?? 0).getTime();
  const [now, setNow] = useState<number | null>(null);
  const age = now === null ? Infinity : now - createdAt;
  const recent = age < HOUR_MS;

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    if (Date.now() - createdAt >= HOUR_MS) return;
    const interval = setInterval(tick, 15_000);
    return () => clearInterval(interval);
  }, [createdAt]);

  if (!recent) return <span>{absolute}</span>;
  const minutes = Math.floor(age / MINUTE_MS);
  return <span title={absolute}>{minutes < 1 ? "Just now" : `${minutes} min ago`}</span>;
}

type InvoiceTableProps = {
  invoices: Invoice[];
  company: Company;
  today: string;
  onSave: (invoice: Invoice) => void;
  onSend: (invoice: Invoice) => void;
  onVoid: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
};

export function InvoiceTable({ invoices, company, today, onSave, onSend, onVoid, onDelete }: InvoiceTableProps) {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  function openDetails(invoice: Invoice) {
    setSelectedInvoice(invoice);
    setDetailsOpen(true);
  }

  // Only one row is in the tab order, so Tab moves past the table; the arrow keys move between rows.
  const [activeId, setActiveId] = useState<string | null>(null);
  const tabbableId = invoices.some((invoice) => invoice.id === activeId) ? activeId : invoices[0]?.id;

  function moveFocus(event: KeyboardEvent<HTMLTableRowElement>, index: number) {
    const targets = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: invoices.length - 1 };
    if (!(event.key in targets)) return;
    event.preventDefault();
    const next = Math.min(Math.max(targets[event.key as keyof typeof targets], 0), invoices.length - 1);
    const rows = event.currentTarget.parentElement?.querySelectorAll<HTMLTableRowElement>("tr[data-invoice-row]");
    rows?.[next]?.focus();
  }

  // Remembers the change too, so the sheet keeps showing it if the invoice then leaves the current page.
  function track(change: (invoice: Invoice) => void) {
    return (invoice: Invoice) => {
      setSelectedInvoice(invoice);
      change(invoice);
    };
  }

  return (
    <>
      <div
        className={twMerge(
          "scroll-shadow-x w-full overflow-hidden pb-2",
          "text-[13px]",
          "rounded-2xl border-[0.5px] border-stone-900/10 bg-surface text-secondary",
        )}
      >
        <div className={twMerge("overflow-x-auto", "scroll-shadow-x-source scrollbar-subtle")}>
          <div className="w-fit min-w-full px-2">
            <table className="w-full min-w-[1200px] border-collapse text-left whitespace-nowrap">
              <colgroup>
                <col className="w-48" />
                <col className="w-32" />
                <col />
                <col className="w-56" />
                <col className="w-44" />
                <col className="w-28" />
              </colgroup>
              <thead>
                <tr className="*:font-normal">
                  <th className="py-3 pr-10 pl-4 text-right whitespace-nowrap">Total</th>
                  <th className="py-3 pr-6">Status</th>
                  <th className="py-3 pr-6">Customer</th>
                  <th className="py-3 pr-6">Invoice Number</th>
                  <th className="py-3 pr-6">Due</th>
                  <th className="py-3 pr-4 text-right">Issued</th>
                </tr>
              </thead>

              <tbody>
                {invoices.length === 0 && (
                  <tr className="relative after:absolute after:inset-x-2 after:top-0 after:h-[0.5px] after:bg-divider">
                    <td colSpan={6} className="py-10 text-center">
                      No invoices match this filter
                    </td>
                  </tr>
                )}
                {invoices.map((invoice, index) => (
                  <tr
                    key={invoice.id}
                    data-invoice-row
                    tabIndex={invoice.id === tabbableId ? 0 : -1}
                    aria-label={`Open invoice ${invoice.invoiceNumber} for ${invoice.customerName}`}
                    onClick={() => openDetails(invoice)}
                    onFocus={() => setActiveId(invoice.id)}
                    onKeyDown={(event) => {
                      if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                        event.preventDefault();
                        openDetails(invoice);
                        return;
                      }
                      moveFocus(event, index);
                    }}
                    className={twMerge(
                      "group relative",
                      "cursor-pointer outline-none",
                      "after:absolute after:inset-x-2 after:top-0 after:h-[0.5px] after:bg-divider",
                      "hover:bg-stone-900/[1.5%]",
                      "focus-visible:bg-stone-900/5",
                      "*:first:rounded-l-lg *:last:rounded-r-lg",
                    )}
                  >
                    <td className="py-2.5 pr-10 pl-4 text-right whitespace-nowrap tabular-nums">
                      <span className="font-mono font-medium text-primary">
                        {formatMoney(invoiceTotalCents(invoice), invoice.currency)}
                      </span>
                      <span className="ml-3">{invoice.currency}</span>
                    </td>
                    <td className="py-2.5 pr-6">
                      <StatusBadge status={invoice.paymentStatus} />
                    </td>
                    <td className="py-2.5 pr-6 whitespace-nowrap">{invoice.customerName}</td>
                    <td className="py-2.5 pr-6">
                      <CopyButton
                        value={invoice.invoiceNumber}
                        tabIndex={invoice.id === tabbableId ? 0 : -1}
                        iconClassName={twMerge(
                          "text-current opacity-0",
                          "group-hover:opacity-100 group-focus-visible:opacity-100 group-focus-visible/copy:opacity-100",
                        )}
                        className={twMerge(copyPillClassName, "font-mono")}
                      />
                    </td>
                    <td className="py-2.5 pr-6 whitespace-nowrap">
                      <DueDate invoice={invoice} today={today} />
                    </td>
                    <td className="py-2.5 pr-4 text-right whitespace-nowrap">
                      <IssuedDate invoice={invoice} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <InvoiceDetailsSheet
        // Follows the server's copy of the open invoice; keeps the last version once it leaves the current page.
        invoice={invoices.find((invoice) => invoice.id === selectedInvoice?.id) ?? selectedInvoice}
        company={company}
        today={today}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onSave={track(onSave)}
        onSend={track(onSend)}
        onVoid={track(onVoid)}
        onDelete={onDelete}
      />
    </>
  );
}
