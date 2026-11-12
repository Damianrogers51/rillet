"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Dialog } from "@base-ui/react/dialog";
import { Menu } from "@base-ui/react/menu";
import { Popover } from "@base-ui/react/popover";
import { twMerge } from "tailwind-merge";
import { Button } from "@/components/Button";
import { ConfirmPopover, ConfirmPopoverPopup } from "@/components/ConfirmPopover";
import { CopyButton, copyPillClassName } from "@/components/CopyButton";
import { EditInvoiceForm } from "@/components/CreateInvoiceSheet";
import { InvoicePreview } from "@/components/InvoicePreview";
import {
  InvoiceSheetPopup,
  PanelCloseButton,
  PreviewPane,
  Section,
  SidePanelHeader,
  sidePanelBodyClassName,
  sidePanelClassName,
} from "@/components/InvoiceSheetLayout";
import { SentInvoiceFlight, type Flight } from "@/components/SentInvoiceFlight";
import { ShreddedInvoice, type Shred } from "@/components/ShreddedInvoice";
import { StatusBadge } from "@/components/StatusBadge";
import { activityTimeFormat, dateFormat, formatMoney, formatPercent, formatUnitPrice } from "@/lib/format";
import {
  invoiceAmounts,
  lineItemAmountCents,
  isReadyToSend,
  markSent,
  markVoided,
  type Company,
  type Invoice,
  type PaymentStatus,
} from "@/lib/invoices";

const { Root: DialogRoot } = Dialog;
// Only one rendered element may carry a view-transition name, so the create sheet's panel doesn't get one.
const panelTransitionClassName = "[view-transition-name:invoice-panel]";

/**
 * Swaps the side panel with the old one sliding out as the new one slides in, in the given direction. `onSwapped` runs
 * once the new panel is in place, since focus can't move into it while the transition is still running.
 */
function swapPanel(direction: "forward" | "back", update: () => void, onSwapped?: () => void) {
  if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    flushSync(update);
    onSwapped?.();
    return;
  }
  const root = document.documentElement;
  root.dataset.panelSwap = direction;
  const transition = document.startViewTransition(() => flushSync(update));
  transition.finished.finally(() => {
    delete root.dataset.panelSwap;
    onSwapped?.();
  });
}

type InvoiceDetailsSheetProps = {
  invoice: Invoice | null;
  company: Company;
  today: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (invoice: Invoice) => void;
  /** Takes the invoice as it looks once sent, including any edits made alongside sending it. */
  onSend: (invoice: Invoice) => void;
  onVoid: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
};

export function InvoiceDetailsSheet({
  invoice,
  company,
  today,
  open,
  onOpenChange,
  onSave,
  onSend,
  onVoid,
  onDelete,
}: InvoiceDetailsSheetProps) {
  const [editing, setEditing] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [flight, setFlight] = useState<Flight | null>(null);
  const endFlight = useCallback(() => setFlight(null), []);
  const [sent, setSent] = useState(false);
  const [shred, setShred] = useState<Shred | null>(null);
  const endShred = useCallback(() => setShred(null), []);
  const previewPane = useRef<HTMLDivElement>(null);
  const editForm = useRef<HTMLFormElement>(null);

  // Without a page to animate from, the invoice is sent and the sheet closes straight away.
  function flyOff(invoice: Invoice, page?: DOMRect) {
    if (!page?.width || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onSend(invoice);
      onOpenChange(false);
      return;
    }
    setSent(true);
    setFlight({ id: invoice.id, invoice, rect: page, centered: true });
  }

  function deleteInvoice(invoice: Invoice) {
    const page = previewPane.current?.firstElementChild?.getBoundingClientRect();
    onDelete(invoice);
    onOpenChange(false);
    if (!page?.width || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setSent(true);
    setShred({ id: invoice.id, invoice, rect: page });
  }

  function sendInvoice(draft: Invoice) {
    if (!isReadyToSend(draft)) {
      startEditing(true);
      return;
    }
    flyOff(markSent(draft), previewPane.current?.firstElementChild?.getBoundingClientRect());
  }

  function startEditing(missingFields = false) {
    swapPanel(
      "forward",
      () => {
        setEditing(true);
        setShowMissing(missingFields);
      },
      () => {
        if (missingFields) editForm.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      },
    );
  }

  function stopEditing() {
    swapPanel("back", () => setEditing(false));
  }

  return (
    <DialogRoot
      open={open}
      onOpenChange={(nextOpen) => {
        // Dismissing while editing backs out to the details instead of closing.
        if (sent) return;
        if (!nextOpen && editing) stopEditing();
        else onOpenChange(nextOpen);
      }}
      onOpenChangeComplete={(isOpen) => {
        if (isOpen) return;
        setEditing(false);
        setShowMissing(false);
        setSent(false);
      }}
    >
      <InvoiceSheetPopup focusPopup>
        {invoice && editing && (
          <EditInvoiceForm
            ref={editForm}
            invoice={invoice}
            company={company}
            today={today}
            validateOnMount={showMissing}
            className={panelTransitionClassName}
            onCancel={stopEditing}
            onSave={(updated) =>
              swapPanel("back", () => {
                onSave(updated);
                setEditing(false);
              })
            }
            onSend={flyOff}
          />
        )}
        {invoice && !editing && (
          <>
            <InvoiceDetails
              invoice={invoice}
              className={panelTransitionClassName}
              inert={sent}
              onEdit={() => startEditing()}
              onSend={() => sendInvoice(invoice)}
              onVoid={() => onVoid(markVoided(invoice))}
              onClose={() => onOpenChange(false)}
              onDelete={() => deleteInvoice(invoice)}
            />
            <PreviewPane
              ref={previewPane}
              pageClassName={sent ? "invisible" : undefined}
              onDismiss={() => {
                if (!sent) onOpenChange(false);
              }}
            >
              <InvoicePreview invoice={invoice} company={company} />
            </PreviewPane>
          </>
        )}
      </InvoiceSheetPopup>
      {flight && (
        <SentInvoiceFlight
          key={flight.id}
          flight={flight}
          company={company}
          onSent={onSend}
          onClose={() => onOpenChange(false)}
          onDone={endFlight}
        />
      )}
      {shred && <ShreddedInvoice key={shred.id} shred={shred} company={company} onDone={endShred} />}
    </DialogRoot>
  );
}

type InvoiceDetailsProps = {
  invoice: Invoice;
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

function InvoiceDetails({ invoice, className, inert, onEdit, onSend, onVoid, onClose, onDelete }: InvoiceDetailsProps) {
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
            {invoice.paymentStatus === "Voided" && <DeleteInvoiceButton invoice={invoice} onConfirm={onDelete} />}
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
            <DetailRow label="Issued">{dateFormat.format(new Date(invoice.issueDate))}</DetailRow>
            <DetailRow label="Due">{dateFormat.format(new Date(invoice.dueDate))}</DetailRow>
            {invoice.paidDate && <DetailRow label="Paid">{dateFormat.format(new Date(invoice.paidDate))}</DetailRow>}
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
          <ol className="flex flex-col">
            {[...invoice.activity].reverse().map((event, index) => (
              <li
                key={event.id}
                className={twMerge(
                  "grid grid-rows-[1fr]",
                  isNewActivity(event.id) && "animate-row-in motion-reduce:animate-none",
                )}
              >
                <div
                  className={twMerge(
                    "min-h-0 overflow-hidden",
                    isNewActivity(event.id) && "animate-blur-in motion-reduce:animate-none",
                  )}
                >
                  <div
                    className={twMerge(
                      "relative flex items-center gap-3",
                      index < invoice.activity.length - 1 && "pb-5",
                    )}
                  >
                    {index < invoice.activity.length - 1 && (
                      <span
                        aria-hidden
                        className="absolute top-6 bottom-1 left-[9.25px] w-[1.5px] rounded-full bg-stone-300"
                      />
                    )}
                    <ActivityIcon action={event.action} />
                    <p className="min-w-0 flex-1 truncate text-primary">
                      <span className="text-tertiary">{event.actor.replace(/ automation$/, "")}</span>{" "}
                      {event.action.charAt(0).toLowerCase() + event.action.slice(1)}
                    </p>
                    <time dateTime={event.timestamp} className="shrink-0 text-xs text-tertiary">
                      {activityTimeFormat.format(new Date(event.timestamp))}
                    </time>
                  </div>
                </div>
              </li>
            ))}
          </ol>
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

const blurOutDuration = 180;
const blurInDuration = 260;
const resizeDuration = 320;

/** Blurs the old content out, swaps it for the new value's content, then blurs that in. */
function BlurSwap<T extends string>({
  value,
  animate,
  className,
  children,
}: {
  value: T;
  animate: boolean;
  className?: string;
  children: (value: T) => ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);
  const widthBeforeSwap = useRef<number | null>(null);
  if (shown !== value && !animate) setShown(value);

  useEffect(() => {
    const element = ref.current;
    if (shown === value || !animate || !element) return;
    const blurringOut = element.animate(
      [
        { opacity: 1, filter: "blur(0)" },
        { opacity: 0, filter: "blur(4px)" },
      ],
      {
        duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : blurOutDuration,
        easing: "ease-in",
        fill: "forwards",
      },
    );
    blurringOut.finished.then(
      () => {
        widthBeforeSwap.current = element.getBoundingClientRect().width;
        setShown(value);
      },
      () => {},
    );
    return () => blurringOut.cancel();
  }, [shown, value, animate]);

  useLayoutEffect(() => {
    const element = ref.current;
    const fromWidth = widthBeforeSwap.current;
    if (fromWidth === null || !element) return;
    widthBeforeSwap.current = null;
    element.getAnimations().forEach((animation) => animation.cancel());
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    element.animate(
      [
        { opacity: 0, filter: "blur(4px)" },
        { opacity: 1, filter: "blur(0)" },
      ],
      {
        duration: blurInDuration,
        easing: "ease-out",
      },
    );
    // Clipped on the right so wider new content doesn't spill over its neighbours while the width catches up.
    const clipPath = "inset(-0.5em 0 -0.5em -0.5em)";
    element.animate(
      [
        { width: `${fromWidth}px`, clipPath },
        { width: `${element.getBoundingClientRect().width}px`, clipPath },
      ],
      {
        duration: resizeDuration,
        easing: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
    );
  }, [shown]);

  return (
    <span ref={ref} className={className}>
      {children(shown)}
    </span>
  );
}

function DeleteInvoiceButton({ invoice, onConfirm }: { invoice: Invoice; onConfirm: () => void }) {
  return <ConfirmPopover triggerLabel="Delete Invoice" {...deleteConfirmation(invoice)} onConfirm={onConfirm} />;
}

const chevronDownPath = "M4.5 6.5L8 10l3.5-3.5";

/** Edit Draft with a split-off chevron that opens a menu of the draft's other actions. */
function EditDraftButton({
  invoice,
  onEdit,
  onDelete,
}: {
  invoice: Invoice;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div ref={groupRef} data-press-group className="flex">
      <Button onClick={onEdit} className="rounded-r-none pr-3.5">
        Edit Draft
      </Button>
      <Menu.Root>
        <Menu.Trigger
          ref={menuTriggerRef}
          aria-label="More draft actions"
          render={
            <Button
              squish={false}
              className="flex items-center rounded-l-none border-l-[0.5px] border-stone-100/25 pr-2.5 pl-2"
            />
          }
        >
          <svg viewBox="0 0 16 16" fill="none" aria-hidden className="size-3.5">
            <path
              d={chevronDownPath}
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
            <Menu.Popup
              className={twMerge(
                "flex min-w-40 origin-top-right flex-col p-1",
                "rounded-[20px] bg-surface text-[13px] shadow-lg ring-[0.5px] ring-stone-900/10 outline-none",
                "transition-[scale,opacity] duration-150 ease-out",
                "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
                "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
              )}
            >
              <Menu.Item
                onClick={() => setConfirmingDelete(true)}
                className={twMerge(
                  "flex h-8 cursor-pointer items-center rounded-full px-3.5 text-red-700 outline-none select-none",
                  "data-[highlighted]:bg-red-600/[7%]",
                )}
              >
                Delete Draft
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <Popover.Root open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <ConfirmPopoverPopup
          {...deleteConfirmation(invoice)}
          onConfirm={onDelete}
          anchor={groupRef}
          finalFocus={menuTriggerRef}
        />
      </Popover.Root>
    </div>
  );
}

function deleteConfirmation(invoice: Invoice) {
  const noun = invoice.paymentStatus === "Unsent" ? "draft" : "invoice";
  return {
    title: `Delete this ${noun}?`,
    description: `This ${noun} will be removed. This action can’t be undone.`,
    confirmLabel: "Delete",
  };
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

const activityIconPaths = {
  created: <path d="M8 4v8M4 8h8" />,
  edited: <path d="M10 4l2 2-6 6H4v-2z" />,
  sent: <path d="M4.75 11.25l6.5-6.5M6 4.75h5.25V10" />,
  paid: <path d="M4.5 8.5l2.25 2.25L11.5 5.5" />,
  overdue: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5.25V8l1.75 1.25" />
    </>
  ),
  voided: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M4.1 11.9L11.9 4.1" />
    </>
  ),
};

function activityKind(action: string): keyof typeof activityIconPaths | undefined {
  const text = action.toLowerCase();
  if (text.includes("void")) return "voided";
  if (text.includes("payment") || text.includes("paid")) return "paid";
  if (text.includes("overdue")) return "overdue";
  if (text.includes("sent")) return "sent";
  if (text.includes("edit")) return "edited";
  if (text.includes("creat")) return "created";
}

function ActivityIcon({ action }: { action: string }) {
  const kind = activityKind(action);
  return (
    <span
      aria-hidden
      className="flex size-5 shrink-0 items-center justify-center rounded-full bg-stone-700 text-stone-50"
    >
      {kind ? (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3"
        >
          {activityIconPaths[kind]}
        </svg>
      ) : (
        <span className="size-1 rounded-full bg-current" />
      )}
    </span>
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
