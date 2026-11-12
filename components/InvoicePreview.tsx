import { memo, type ReactNode } from "react";
import type { Format } from "@number-flow/react";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { InvoiceMark } from "@/components/InvoiceMark";
import {
  dateFormat,
  formatMoney,
  formatPercent,
  formatQuantity,
  formatUnitPrice,
  moneyFormatOptions,
} from "@/lib/format";
import { invoiceAmounts, lineItemAmountCents, type Company, type Invoice, type LineItem } from "@/lib/invoices";
import { twMerge } from "tailwind-merge";

export function InvoicePreview({ invoice, company }: { invoice: Invoice; company: Company }) {
  const { subtotalCents, discountCents, taxCents, totalCents } = invoiceAmounts(invoice);
  const money = (cents: number) => formatMoney(cents, invoice.currency);
  const formatDate = (isoDate: string) => (isoDate ? dateFormat.format(new Date(isoDate)) : "—");
  const lineItems = invoice.lineItems.filter((item) => item.description || item.unitPrice);

  return (
    <article className="relative flex grow flex-col gap-13 p-7 text-[13px] text-secondary [overflow-wrap:anywhere]">
      <InvoiceMark seed={invoice.invoiceNumber} className="absolute top-7 right-7 size-11" />

      <header className="flex flex-col gap-1">
        <span className="text-[24px] leading-none font-[450] text-primary">Invoice</span>
        <span className="mt-0.5 font-mono">{invoice.invoiceNumber}</span>
        <dl className="mt-12 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
          <dt className="text-tertiary">Issued</dt>
          <dd className="font-[450] text-primary">{formatDate(invoice.issueDate)}</dd>
          <dt className="text-tertiary">Due</dt>
          <dd className="font-[450] text-primary">{formatDate(invoice.dueDate)}</dd>{" "}
        </dl>
      </header>

      <div className="grid grid-cols-[1fr_21rem]">
        <div className="flex flex-col gap-1 pr-4">
          <Label>From</Label>
          <span className="font-[450] text-primary">{company.name}</span>
        </div>
        <div className="flex flex-col gap-1">
          <Label>To</Label>
          <Placeholder value={invoice.customerName} fallback="Acme Labs" strong />
          <Placeholder value={invoice.billingAddress} fallback="415 Market Street, San Francisco, CA 94105" />
          <Placeholder value={invoice.billingEmail} fallback="ap@acmelabs.example" />
        </div>
      </div>

      <div className="flex flex-col">
        <table className="w-full table-fixed border-collapse text-left">
          <thead>
            <tr className="border-b-[0.5px] border-stone-200 text-tertiary *:pb-2 *:font-normal">
              <th>Description</th>
              <th className="w-20 pr-4">Quantity</th>
              <th className="w-32 pr-4 text-right">Unit price</th>
              <th className="w-32 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item) => (
              <PreviewLineItemRow key={item.id} item={item} currency={invoice.currency} />
            ))}
          </tbody>
        </table>

        <dl className="mt-13 ml-auto grid w-[21rem] grid-cols-[1fr_auto] gap-x-4 gap-y-1.5">
          <dt className="text-tertiary">Subtotal</dt>
          <dd className="text-right font-mono">{money(subtotalCents)}</dd>
          {discountCents > 0 && (
            <>
              <dt className="text-tertiary">Discount</dt>
              <dd className="text-right font-mono">−{money(discountCents)}</dd>
            </>
          )}
          <dt className="text-tertiary">Tax ({formatPercent(invoice.taxRate)})</dt>
          <dd className="text-right font-mono">{money(taxCents)}</dd>
          <div
            className={twMerge(
              "col-span-2 flex items-baseline justify-between gap-4",
              "mt-3 pt-5",
              "border-t-[0.5px] border-stone-200 text-primary",
            )}
          >
            <dt className="text-tertiary">Amount due ({invoice.currency})</dt>
            <dd className="font-mono text-[32px] leading-none font-medium tracking-tight">
              <AnimatedNumber value={totalCents / 100} format={moneyFormatOptions(invoice.currency) as Format} />
            </dd>
          </div>
        </dl>
      </div>

      {invoice.memo && (
        <div className="mt-auto flex flex-col gap-1">
          <Label>Memo</Label>
          <p className="leading-relaxed">{invoice.memo}</p>
        </div>
      )}
    </article>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <span className="text-tertiary">{children}</span>;
}

type PlaceholderProps = { value: string; fallback: string; strong?: boolean };

function Placeholder({ value, fallback, strong }: PlaceholderProps) {
  if (!value) return <span className="font-[450] text-stone-400">{fallback}</span>;
  return <span className={`font-[450] ${strong ? "text-primary" : ""}`}>{value}</span>;
}

const PreviewLineItemRow = memo(function PreviewLineItemRow({ item, currency }: { item: LineItem; currency: string }) {
  return (
    <tr className="align-top *:py-1.5 first:*:pt-3">
      <td className="pr-4 break-words text-primary">
        {item.description || <span className="text-stone-400">Platform subscription</span>}
      </td>
      <td className="pr-4 font-mono whitespace-nowrap">{formatQuantity(item.quantity)}</td>
      <td className="pr-4 text-right font-mono whitespace-nowrap">{formatUnitPrice(item.unitPrice, currency)}</td>
      <td className="text-right font-mono whitespace-nowrap text-primary">
        {formatMoney(lineItemAmountCents(item), currency)}
      </td>
    </tr>
  );
});
