"use client";

import { useState, type ReactNode } from "react";
import { twMerge } from "tailwind-merge";
import { BlurSwap } from "@/components/BlurSwap";
import { Button } from "@/components/Button";
import { ConfirmPopover } from "@/components/ConfirmPopover";
import { CopyButton, copyPillClassName } from "@/components/CopyButton";
import {
  PanelCloseButton,
  Section,
  SidePanelHeader,
  sidePanelBodyClassName,
  sidePanelClassName,
} from "@/components/InvoiceSheetLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { ActivityTimeline } from "@/components/details/ActivityTimeline";
import { EditDraftButton, deleteConfirmation } from "@/components/details/DraftActions";
import {
  dateFormat,
  daysUntil,
  formatMoney,
  formatPercent,
  formatUnitPrice,
  pluralizeDays,
  timestampDateFormat,
} from "@/lib/format";
import { invoiceAmounts, lineItemAmountCents, type Invoice, type PaymentStatus } from "@/lib/invoices";

type InvoiceDetailsProps = {
  invoice: Invoice;
  today: string;
  className?: string;
  inert: boolean;
  onEdit: () => void;
  onSend: () => void;
  onVoid: () => void;
  onClose: () => void;
  onDelete: () => void;
};

function openedState(invoice: Invoice) {
  return { id: invoice.id, status: invoice.paymentStatus, activityIds: new Set(invoice.activity.map(({ id }) => id)) };
}

export function InvoiceDetails({
  invoice,
  today,
  className,
  inert,
  onEdit,
  onSend,
  onVoid,
  onClose,
  onDelete,
}: InvoiceDetailsProps) {
  // How the invoice looked when it opened, so only changes made while it's showing animate in.
  const [opened, setOpened] = useState(() => openedState(invoice));
  if (opened.id !== invoice.id) setOpened(openedState(invoice));
  const statusChanged = opened.id === invoice.id && invoice.paymentStatus !== opened.status;
  const isNewActivity = (id: string) => opened.id === invoice.id && !opened.activityIds.has(id);
  const { subtotalCents, discountCents, taxCents, totalCents } = invoiceAmounts(invoice);
  const money = (cents: number) => formatMoney(cents, invoice.currency);
  const draft = invoice.status === "Draft";
  const cancellable = invoice.paymentStatus === "Open" || invoice.paymentStatus === "Overdue";

  return (
    <div className={twMerge(sidePanelClassName, className)} inert={inert}>
      <SidePanelHeader
        title="Details"
        actions={
          <>
            {draft && (
              <>
                <Button variant="secondary" onClick={onSend}>
                  Send Invoice
                </Button>
                <EditDraftButton invoice={invoice} onEdit={onEdit} onDelete={onDelete} />
              </>
            )}
            {cancellable && (
              <ConfirmPopover
                triggerLabel="Cancel Invoice"
                title="Cancel this invoice?"
                description={
                  <>
                    <span className="font-mono">{invoice.invoiceNumber}</span> will be voided
                    {invoice.customerName && <> and {invoice.customerName} will no longer owe anything</>}.
                  </>
                }
                confirmLabel="Cancel Invoice"
                onConfirm={onVoid}
              />
            )}
            {invoice.paymentStatus === "Voided" && (
              <ConfirmPopover triggerLabel="Delete Invoice" {...deleteConfirmation(invoice)} onConfirm={onDelete} />
            )}
            <PanelCloseButton onClick={onClose} />
          </>
        }
      />

      <div className={twMerge(sidePanelBodyClassName, "pb-20")}>
        <InvoiceSummary invoice={invoice} total={money(totalCents)} animate={statusChanged} />

        <Section title="Details">
          <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2.5">
            <DetailRow label="Invoice number">
              <CopyButton
                value={invoice.invoiceNumber}
                className={twMerge(copyPillClassName, "font-mono text-primary")}
                iconClassName="text-current"
              />
            </DetailRow>
            <DetailRow label="Currency">{invoice.currency}</DetailRow>
            <DetailRow label="Customer">{invoice.customerName || emptyValue}</DetailRow>
            <DetailRow label="Billing email">{invoice.billingEmail || emptyValue}</DetailRow>
            <DetailRow label="Billing address">{invoice.billingAddress || emptyValue}</DetailRow>
            <DetailRow label="Created">{timestampDateFormat.format(new Date(invoice.createdAt))}</DetailRow>
            <DetailRow label="Issued">{draft ? emptyValue : dateFormat.format(new Date(invoice.issueDate))}</DetailRow>
            <DetailRow label="Due">
              <DueDate invoice={invoice} today={today} />
            </DetailRow>
            <DetailRow label="Paid">
              {invoice.paidDate ? dateFormat.format(new Date(invoice.paidDate)) : emptyValue}
            </DetailRow>
            <DetailRow label="Memo">{invoice.memo || emptyValue}</DetailRow>
          </dl>
        </Section>

        <Section title="Items">
          <dl className="grid grid-cols-[1fr_8rem_max-content] gap-x-8 gap-y-2.5">
            {invoice.lineItems.map((item) => (
              <div key={item.id} className="col-span-3 grid grid-cols-subgrid">
                <dt className="min-w-0 truncate text-primary">
                  {item.description || emptyValue}
                  {item.quantity !== 1 && ` × ${+item.quantity.toFixed(4)}`}
                </dt>
                <dd className="font-mono text-tertiary">{formatUnitPrice(item.unitPrice, invoice.currency)}</dd>
                <dd className="text-right font-mono text-primary">{money(lineItemAmountCents(item))}</dd>
              </div>
            ))}
            <div className="col-span-3 h-4" />
            <SummaryRow label="Subtotal" value={money(subtotalCents)} />
            {discountCents > 0 && <SummaryRow label="Discount" value={`−${money(discountCents)}`} />}
            <SummaryRow label={`Tax (${formatPercent(invoice.taxRate)})`} value={money(taxCents)} />
            <div className="col-span-2 col-start-2 my-1.5 border-t-[0.5px] border-stone-200" />
            <SummaryRow label={`Total (${invoice.currency})`} value={money(totalCents)} />
          </dl>
        </Section>

        <Section title="Activity">
          <ActivityTimeline activity={invoice.activity} isNew={isNewActivity} />
        </Section>
      </div>
    </div>
  );
}

const summaryVerbs: Record<PaymentStatus, [verb: string, preposition: string]> = {
  Unsent: ["drafted", "for"],
  Open: ["billed", "to"],
  Overdue: ["billed", "to"],
  Paid: ["paid", "by"],
  Voided: ["voided", "for"],
};

/** Reads the invoice as one sentence, like "$1,200.00 billed to Acme Labs". */
function InvoiceSummary({ invoice, total, animate }: { invoice: Invoice; total: string; animate: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="mb-1 flex items-center gap-2.5 text-[13px]">
        <BlurSwap value={invoice.paymentStatus} animate={animate} className="flex">
          {(status) => <StatusBadge status={status} />}
        </BlurSwap>
        <span className="font-mono">{invoice.invoiceNumber}</span>
      </div>
      <p className="text-[24px] leading-[1.3] font-[450] text-balance text-tertiary">
        <span className="text-primary">{total}</span>{" "}
        <BlurSwap value={invoice.paymentStatus} animate={animate} className="inline-block whitespace-nowrap">
          {(status) => {
            const [verb, preposition] = summaryVerbs[status];
            return invoice.customerName ? `${verb} ${preposition}` : verb;
          }}
        </BlurSwap>
        {invoice.customerName && (
          <>
            {" "}
            <span className="text-primary">{invoice.customerName}</span>
          </>
        )}
      </p>
    </div>
  );
}

function DueDate({ invoice, today }: { invoice: Invoice; today: string }) {
  const overdueDays = invoice.paymentStatus === "Overdue" ? -daysUntil(invoice.dueDate, today) : 0;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      {dateFormat.format(new Date(invoice.dueDate))}
      {overdueDays > 0 && <span className="text-red-700">{pluralizeDays(overdueDays)} overdue</span>}
    </span>
  );
}

const emptyValue = <span className="text-stone-900/30">—</span>;

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-tertiary">{label}</dt>
      <dd className="text-primary">{children}</dd>
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="col-start-2 text-tertiary">{label}</dt>
      <dd className="text-right font-mono text-primary">{value}</dd>
    </>
  );
}
