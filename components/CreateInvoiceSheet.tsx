"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Field } from "@base-ui/react/field";
import { Form } from "@base-ui/react/form";
import { Switch } from "@base-ui/react/switch";
import { Autocomplete, DatePicker, Input, Select, Textarea } from "@/components/Input";
import { Button } from "@/components/Button";
import { InvoicePreview } from "@/components/InvoicePreview";
import {
  InvoiceSheetPopup,
  PanelBackButton,
  PanelCloseButton,
  PreviewPane,
  Section,
  ShowPreviewButton,
  SidePanelHeader,
  sidePanelBodyClassName,
  sidePanelClassName,
  sidePanelFooterClassName,
} from "@/components/InvoiceSheetLayout";
import { SentInvoiceFlight, type Flight } from "@/components/SentInvoiceFlight";
import { currencySymbol, formatMoney, formatDecimalInput, formatPercent, trimZeroDecimals } from "@/lib/format";
import {
  addDays,
  currencies,
  invoiceAmounts,
  lineItemAmountCents,
  markSent,
  paymentTerms,
  type Company,
  type Invoice,
  type LineItem,
  type PaymentTerms,
} from "@/lib/invoices";
import { useCustomers, useNextInvoiceNumber } from "@/lib/queries";
import { twMerge } from "tailwind-merge";

const { Root: DialogRoot, Trigger: DialogTrigger } = Dialog;
const { Root: FieldRoot, Label: FieldLabel, Error: FieldError, Validity: FieldValidity } = Field;

type LineItemDraft = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

const limits = {
  customerName: 100,
  // RFC 5321 caps an address at 254 characters.
  billingEmail: 254,
  billingAddress: 200,
  description: 200,
  quantity: 1_000_000,
  unitPrice: 10_000_000,
  discountPercent: 100,
  taxPercent: 100,
  memo: 500,
};

function exceeds(value: string, max: number) {
  return value !== "" && Number(value) > max;
}

const characterLimitNotice = (value: string, max: number) =>
  value.length >= max ? `Limit is ${max.toLocaleString("en-US")} characters` : null;

const numberLimitNotice = (max: number, unit = "") => `Max is ${max.toLocaleString("en-US")}${unit}`;

// Untouched drafts keep their identity across edits, so caching by object lets unchanged preview rows skip re-rendering.
const lineItemCache = new WeakMap<LineItemDraft, LineItem>();

function toLineItem(draft: LineItemDraft): LineItem {
  let item = lineItemCache.get(draft);
  if (!item) {
    item = {
      id: draft.id,
      description: draft.description.trim(),
      quantity: Math.min(Number(draft.quantity) || 0, limits.quantity),
      unitPrice: Math.max(Math.min(Number(draft.unitPrice) || 0, limits.unitPrice), -limits.unitPrice),
      accountCode: "",
    };
    lineItemCache.set(draft, item);
  }
  return item;
}

function emptyLineItem(): LineItemDraft {
  return { id: `draft-li-${crypto.randomUUID()}`, description: "", quantity: "1.0", unitPrice: "" };
}

type CreateInvoiceSheetProps = {
  company: Company;
  today: string;
  onCreate: (invoice: Invoice) => void;
};

export function CreateInvoiceSheet({ company, today, onCreate }: CreateInvoiceSheetProps) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [validationKey, setValidationKey] = useState(0);
  const [flight, setFlight] = useState<Flight | null>(null);
  const endFlight = useCallback(() => setFlight(null), []);
  const resetOnClose = useRef(false);
  const sending = useRef(false);
  const [createAnother, setCreateAnother] = useState(false);
  // Focuses the fresh form that replaces a submitted one while the drawer stays open.
  const [continuing, setContinuing] = useState(false);
  const keepOpenAfterSend = useRef(false);

  function startAnother() {
    setContinuing(true);
    setFormKey((key) => key + 1);
  }

  const closeAfterSend = useCallback(() => {
    sending.current = false;
    if (keepOpenAfterSend.current) {
      setContinuing(true);
      setFormKey((key) => key + 1);
    } else {
      setOpen(false);
    }
  }, []);

  return (
    <DialogRoot
      open={open}
      onOpenChange={(nextOpen) => {
        if (!sending.current) setOpen(nextOpen);
      }}
      onOpenChangeComplete={(isOpen) => {
        if (isOpen) return;
        setContinuing(false);
        setCreateAnother(false);
        if (resetOnClose.current) {
          resetOnClose.current = false;
          setFormKey((key) => key + 1);
        } else {
          setValidationKey((key) => key + 1);
        }
      }}
    >
      <DialogTrigger render={<Button />}>Create Invoice</DialogTrigger>

      {/* Stays mounted while closed so dismissing keeps what was typed; a successful submit resets it. */}
      <InvoiceSheetPopup keepMounted>
        <CreateInvoiceForm
          key={formKey}
          validationKey={validationKey}
          company={company}
          today={today}
          continuing={continuing}
          createAnother={createAnother}
          onCreateAnotherChange={setCreateAnother}
          onDismiss={() => setOpen(false)}
          onSubmit={(invoice, sentFrom) => {
            // The send animation adds the invoice once its mock send finishes, then closes the drawer or resets it.
            if (sentFrom) {
              sending.current = true;
              keepOpenAfterSend.current = createAnother;
              if (!createAnother) resetOnClose.current = true;
              setFlight({ id: invoice.id, invoice, rect: sentFrom, centered: !createAnother });
              return;
            }
            onCreate(invoice);
            if (createAnother) {
              startAnother();
            } else {
              resetOnClose.current = true;
              setOpen(false);
            }
          }}
        />
      </InvoiceSheetPopup>
      {flight && (
        <SentInvoiceFlight
          key={flight.id}
          flight={flight}
          company={company}
          onSent={onCreate}
          onClose={closeAfterSend}
          onDone={endFlight}
        />
      )}
    </DialogRoot>
  );
}

type EditInvoiceFormProps = {
  ref?: Ref<HTMLFormElement>;
  invoice: Invoice;
  company: Company;
  today: string;
  /** Flags every missing field as soon as the form opens, for a draft that couldn't be sent as it was. */
  validateOnMount: boolean;
  onCancel: () => void;
  onSave: (invoice: Invoice) => void;
  /** `sentFrom` is where the preview page sat when the invoice was sent, for the send animation. */
  onSend: (invoice: Invoice, sentFrom?: DOMRect) => void;
  className?: string;
};

/** The create form filled from an existing invoice, for editing it in place inside another invoice sheet. */
export function EditInvoiceForm({
  ref,
  invoice,
  company,
  today,
  validateOnMount,
  onCancel,
  onSave,
  onSend,
  className,
}: EditInvoiceFormProps) {
  return (
    <CreateInvoiceForm
      ref={ref}
      editing={invoice}
      validateOnMount={validateOnMount}
      validationKey={0}
      company={company}
      today={today}
      continuing={false}
      createAnother={false}
      onCreateAnotherChange={() => {}}
      onDismiss={onCancel}
      onSubmit={(edited, sentFrom) => (edited.status === "Draft" ? onSave(edited) : onSend(edited, sentFrom))}
      className={className}
    />
  );
}

function toLineItemDraft(item: LineItem): LineItemDraft {
  return {
    id: item.id,
    description: item.description,
    quantity: formatDecimalInput(String(item.quantity), 1),
    unitPrice: formatDecimalInput(String(item.unitPrice), 2),
  };
}

// Invoices store the discount as an amount; four decimals keep the percentage close enough to round back to it.
function discountPercentOf(invoice: Invoice) {
  const { subtotalCents } = invoiceAmounts(invoice);
  if (!invoice.discount || subtotalCents <= 0) return "";
  return String(+((invoice.discount * 100 * 100) / subtotalCents).toFixed(4));
}

type CreateInvoiceFormProps = {
  ref?: Ref<HTMLFormElement>;
  /** Fills the form from an existing invoice and saves changes to it instead of creating a new one. */
  editing?: Invoice;
  validateOnMount?: boolean;
  className?: string;
  validationKey: number;
  company: Company;
  today: string;
  /** Replaces an invoice that was just submitted with "Create another" checked. */
  continuing: boolean;
  createAnother: boolean;
  onCreateAnotherChange: (createAnother: boolean) => void;
  onDismiss: () => void;
  /** `sentFrom` is where the preview page sat when the invoice was sent or saved, for the submit animation. */
  onSubmit: (invoice: Invoice, sentFrom?: DOMRect) => void;
};

function CreateInvoiceForm({
  ref,
  editing,
  validateOnMount = false,
  className,
  validationKey,
  company,
  today,
  continuing,
  createAnother,
  onCreateAnotherChange,
  onDismiss,
  onSubmit,
}: CreateInvoiceFormProps) {
  const formActions = useRef<Form.Actions>(null);
  const previewPane = useRef<HTMLDivElement>(null);
  const [sent, setSent] = useState(false);
  const customerNameField = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (continuing) customerNameField.current?.querySelector("input")?.focus();
  }, [continuing]);
  const [customerName, setCustomerName] = useState(editing?.customerName ?? "");
  const [billingEmail, setBillingEmail] = useState(editing?.billingEmail ?? "");
  const [billingAddress, setBillingAddress] = useState(editing?.billingAddress ?? "");
  const [terms, setTerms] = useState<PaymentTerms>(
    editing && editing.paymentTerms in paymentTerms ? (editing.paymentTerms as PaymentTerms) : "Net 30",
  );
  const [currency, setCurrency] = useState<string>(editing?.currency ?? "USD");
  const issueDate = editing?.issueDate ?? today;
  const [dueDate, setDueDate] = useState(editing?.dueDate ?? addDays(today, paymentTerms["Net 30"]));
  const [lineItems, setLineItems] = useState<LineItemDraft[]>(() =>
    editing?.lineItems.length ? editing.lineItems.map(toLineItemDraft) : [emptyLineItem()],
  );
  const [addedItemId, setAddedItemId] = useState<string | null>(null);
  // Fields in rows added after a send attempt start clean until they're edited or Send is pressed again.
  const [checkedItemFields, setCheckedItemFields] = useState<ReadonlySet<string>>(() =>
    validateOnMount ? allItemFieldKeys(lineItems) : new Set(),
  );
  useEffect(() => {
    if (!validateOnMount) return;
    formActions.current?.validate();
  }, [validateOnMount]);
  const [prevValidationKey, setPrevValidationKey] = useState(validationKey);
  if (validationKey !== prevValidationKey) {
    setPrevValidationKey(validationKey);
    setCheckedItemFields(new Set());
    setAddedItemId(null);
  }
  const [discountPercent, setDiscountPercent] = useState(() => (editing ? discountPercentOf(editing) : ""));
  const [taxPercent, setTaxPercent] = useState(editing?.taxRate ? String(+(editing.taxRate * 100).toFixed(4)) : "");
  const [memo, setMemo] = useState(editing?.memo ?? "");

  const { data: customers } = useCustomers();
  const knownCustomers = useMemo(
    () => new Map((customers ?? []).map((customer) => [customer.customerName, customer])),
    [customers],
  );

  function changeCustomerName(name: string) {
    setCustomerName(name);
    const known = knownCustomers.get(name);
    if (known && !billingEmail && !billingAddress) {
      setBillingEmail(known.billingEmail);
      setBillingAddress(known.billingAddress);
      setCurrency(known.currency);
      if (known.paymentTerms in paymentTerms) changeTerms(known.paymentTerms as PaymentTerms);
    }
  }

  function changeTerms(nextTerms: PaymentTerms) {
    setTerms(nextTerms);
    setDueDate(addDays(issueDate, paymentTerms[nextTerms]));
  }

  const updateLineItem = useCallback(
    (id: string, changes: Partial<LineItemDraft>) => {
      setLineItems((items) => items.map((item) => (item.id === id ? { ...item, ...changes } : item)));
      // Base UI revalidates edited fields after a send attempt, so the summary follows suit.
      setCheckedItemFields((checked) => {
        const keys = Object.keys(changes).map((field) => itemFieldKey(id, field));
        if (!checked.size || keys.every((key) => checked.has(key))) return checked;
        return new Set([...checked, ...keys]);
      });
    },
    [setCheckedItemFields],
  );

  const removeLineItem = useCallback((id: string) => {
    setLineItems((items) => items.filter((item) => item.id !== id));
  }, []);

  const { data: nextInvoiceNumber = "" } = useNextInvoiceNumber(issueDate, !editing);
  const invoiceNumber = editing?.invoiceNumber ?? nextInvoiceNumber;

  function buildInvoice(send = false): Invoice {
    const createdAt = new Date().toISOString();
    const items = lineItems.map(toLineItem);
    const discountableCents = Math.max(
      items.reduce((sum, item) => sum + lineItemAmountCents(item), 0),
      0,
    );
    const details = {
      customerName: customerName.trim(),
      billingEmail: billingEmail.trim(),
      billingAddress: billingAddress.trim(),
      paymentTerms: terms,
      currency,
      dueDate,
      memo: memo.trim(),
      taxRate: Math.min(Number(taxPercent) || 0, limits.taxPercent) / 100,
      // Stored as an amount so existing invoices and totals keep working; rounded to the cent.
      discount:
        Math.round((discountableCents * Math.min(Number(discountPercent) || 0, limits.discountPercent)) / 100) / 100,
      lineItems: items,
    };
    if (editing) return { ...editing, ...details };
    return {
      id: crypto.randomUUID(),
      invoiceNumber,
      ...details,
      status: send ? "Sent" : "Draft",
      paymentStatus: send ? "Open" : "Unsent",
      issueDate,
      activity: [
        {
          id: `${invoiceNumber}-created`,
          timestamp: createdAt,
          actor: "You",
          action: send ? "Created the invoice" : "Created a draft invoice",
        },
        ...(send
          ? [
              {
                id: `${invoiceNumber}-sent`,
                timestamp: createdAt,
                actor: "You",
                action: "Sent the invoice to the customer",
              },
            ]
          : []),
      ],
    };
  }

  function blockNegativeSubtotal() {
    if (subtotalCents >= 0) return false;
    document.querySelector<HTMLInputElement>("form input[aria-label^='Unit price'][aria-invalid='true']")?.focus();
    return true;
  }

  function submitAnimated(invoice: Invoice) {
    const page = previewPane.current?.firstElementChild?.getBoundingClientRect();
    const animate = page?.width && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (animate) setSent(true);
    onSubmit(invoice, animate ? page : undefined);
  }

  function submitInvoice(send: boolean) {
    submitAnimated(buildInvoice(send));
  }

  function sendInvoice() {
    submitInvoice(true);
  }

  function buildEdited(editing: Invoice): Invoice {
    const invoice = buildInvoice();
    return {
      ...invoice,
      // The form doesn't edit account codes, so items keep the ones they had.
      lineItems: invoice.lineItems.map((item) => ({
        ...item,
        accountCode: editing.lineItems.find((original) => original.id === item.id)?.accountCode ?? "",
      })),
    };
  }

  // A draft only needs a customer to be found again; everything else is checked when it's sent.
  function saveChanges() {
    if (!editing) return;
    if (blockNegativeSubtotal()) return;
    if (!customerName.trim()) {
      formActions.current?.validate("customerName");
      customerNameField.current?.querySelector("input")?.focus();
      return;
    }
    const invoice = buildEdited(editing);
    onSubmit({
      ...invoice,
      activity: [
        ...editing.activity,
        {
          id: `${invoiceNumber}-edited-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor: "You",
          action: "Edited the invoice",
        },
      ],
    });
  }

  function sendEdited() {
    if (editing) submitAnimated(markSent(buildEdited(editing)));
  }

  function saveDraft() {
    if (blockNegativeSubtotal()) return;
    if (!customerName.trim()) {
      formActions.current?.validate("customerName");
      customerNameField.current?.querySelector("input")?.focus();
      return;
    }
    submitInvoice(false);
  }

  const draft = buildInvoice();
  const { subtotalCents, discountCents, taxCents, totalCents } = invoiceAmounts(draft);
  const money = (cents: number) => formatMoney(cents, currency);

  return (
    <>
      {/* Remounting on close clears Base UI's field validity while the values above persist. */}
      <Form
        ref={ref}
        key={validationKey}
        className={twMerge(sidePanelClassName, className)}
        // Nothing in the form can change once the invoice is on its way.
        inert={sent}
        actionsRef={formActions}
        onSubmit={(event) => {
          event.preventDefault();
          if (blockNegativeSubtotal()) return;
          if (editing) sendEdited();
          else sendInvoice();
        }}
      >
        <SidePanelHeader
          title={editing ? "Edit Draft" : "Create Invoice"}
          actions={
            <>
              <ShowPreviewButton>
                <InvoicePreview invoice={draft} company={company} />
              </ShowPreviewButton>
              {editing ? <PanelBackButton onClick={onDismiss} /> : <PanelCloseButton onClick={onDismiss} />}
            </>
          }
        />

        <div className={sidePanelBodyClassName}>
          <Section title="Customer">
            <TextField
              ref={customerNameField}
              name="customerName"
              label="Name"
              notice={characterLimitNotice(customerName, limits.customerName)}
            >
              <Autocomplete
                required
                maxLength={limits.customerName}
                placeholder="Acme Labs"
                value={customerName}
                suggestions={[...knownCustomers.keys()]}
                onChange={changeCustomerName}
              />
            </TextField>

            <TextField label="Billing email" notice={characterLimitNotice(billingEmail, limits.billingEmail)}>
              <Input
                required
                type="email"
                maxLength={limits.billingEmail}
                placeholder="ap@acmelabs.example"
                value={billingEmail}
                onChange={(event) => setBillingEmail(event.target.value)}
              />
            </TextField>

            <TextField label="Billing address" notice={characterLimitNotice(billingAddress, limits.billingAddress)}>
              <Input
                maxLength={limits.billingAddress}
                placeholder="415 Market Street, San Francisco, CA 94105"
                value={billingAddress}
                onChange={(event) => setBillingAddress(event.target.value)}
              />
            </TextField>
          </Section>

          <Section title="Payment">
            {/* <Select
              label="Payment terms"
              value={terms}
              options={Object.keys(paymentTerms)}
              onChange={(value) => changeTerms(value as PaymentTerms)}
            /> */}
            <Select label="Currency" value={currency} options={[...currencies]} onChange={setCurrency} />
            <DatePicker label="Due date" value={dueDate} min={issueDate} onChange={setDueDate} />
          </Section>

          <Section
            title="Items"
            action={
              <Button
                variant="tertiary"
                onClick={() => {
                  const item = emptyLineItem();
                  setLineItems((items) => [...items, item]);
                  setAddedItemId(item.id);
                }}
              >
                Add item
              </Button>
            }
          >
            <div className="grid grid-cols-[50%_1fr_1fr_2.375rem] items-center gap-x-2 gap-y-2">
              <span className="text-secondary">Description</span>
              <span className="text-secondary">Quantity</span>
              <span className="text-secondary">Unit price</span>
              <span />

              {lineItems.map((item, index) => (
                <LineItemRow
                  key={item.id}
                  item={item}
                  index={index}
                  autoFocus={item.id === addedItemId}
                  canRemove={lineItems.length > 1}
                  negativeSubtotal={subtotalCents < 0}
                  currency={currency}
                  onChange={updateLineItem}
                  onRemove={removeLineItem}
                />
              ))}
            </div>

            <LineItemProblems items={lineItems} checkedItemFields={checkedItemFields} subtotalCents={subtotalCents} />
          </Section>

          <Section title="Additional">
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Discount"
                notice={
                  exceeds(discountPercent, limits.discountPercent) && numberLimitNotice(limits.discountPercent, "%")
                }
              >
                <Input
                  type="number"
                  min={0}
                  max={limits.discountPercent}
                  step="any"
                  inputMode="decimal"
                  placeholder="0"
                  suffix="%"
                  value={discountPercent}
                  onChange={(event) => setDiscountPercent(event.target.value)}
                />
              </TextField>
              <TextField
                label="Tax rate"
                notice={exceeds(taxPercent, limits.taxPercent) && numberLimitNotice(limits.taxPercent, "%")}
              >
                <Input
                  type="number"
                  min={0}
                  max={limits.taxPercent}
                  step="any"
                  inputMode="decimal"
                  placeholder="0"
                  suffix="%"
                  value={taxPercent}
                  onChange={(event) => setTaxPercent(event.target.value)}
                />
              </TextField>
            </div>

            <TextField label="Memo" notice={characterLimitNotice(memo, limits.memo)}>
              <Textarea
                maxLength={limits.memo}
                placeholder="What this invoice covers"
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
              />
            </TextField>
          </Section>

          <dl className="ml-auto grid w-64 grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 lg:hidden">
            <SummaryRow label="Subtotal" value={money(subtotalCents)} />
            {discountCents > 0 && <SummaryRow label="Discount" value={`−${money(discountCents)}`} />}
            <SummaryRow label={`Tax (${formatPercent(draft.taxRate)})`} value={money(taxCents)} />
            <div
              className={twMerge(
                "col-span-2 flex justify-between gap-4",
                "mt-1.5 pt-2.5",
                "border-t-[0.5px] border-stone-200 text-primary",
              )}
            >
              <dt>Total</dt>
              <dd className="font-mono font-medium">{money(totalCents)}</dd>
            </div>
          </dl>
        </div>

        <footer className={sidePanelFooterClassName}>
          {editing ? (
            <>
              <Button variant="secondary" className="ml-auto" onClick={saveChanges}>
                Save Changes
              </Button>
              <Button type="submit" onClick={() => setCheckedItemFields(allItemFieldKeys(lineItems))}>
                Send Invoice
              </Button>
            </>
          ) : (
            <>
              <label className="group/switch mr-auto flex cursor-pointer items-center gap-2 text-[13px] text-secondary select-none">
                <Switch.Root
                  checked={createAnother}
                  onCheckedChange={onCreateAnotherChange}
                  className={twMerge(
                    "relative h-4.5 w-7.5 shrink-0",
                    "rounded-full",
                    // Solid tints of the surface rather than translucent ones, so toggling fades between solid colors
                    // instead of through half-transparent grays.
                    "bg-[color-mix(in_oklab,var(--color-stone-900)_12%,var(--color-surface))]",
                    "group-hover/switch:bg-[color-mix(in_oklab,var(--color-stone-900)_15%,var(--color-surface))]",
                    "transition-colors duration-150",
                    "data-[checked]:bg-stone-900 data-[checked]:group-hover/switch:bg-stone-800",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900/40",
                  )}
                >
                  <Switch.Thumb
                    className={twMerge(
                      "absolute top-0.5 left-0.5 size-3.5",
                      "rounded-full bg-white",
                      "transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
                      "data-[checked]:translate-x-3",
                    )}
                  />
                </Switch.Root>
                Create More
              </label>
              <Button variant="secondary" onClick={saveDraft}>
                Save as Draft
              </Button>
              <Button
                type="submit"
                onClick={() =>
                  setCheckedItemFields(
                    new Set(lineItems.flatMap((item) => lineItemFields.map((field) => itemFieldKey(item.id, field)))),
                  )
                }
              >
                Send Invoice
              </Button>
            </>
          )}
        </footer>
      </Form>

      <PreviewPane
        ref={previewPane}
        onDismiss={() => {
          if (!sent) onDismiss();
        }}
        pageClassName={twMerge(
          // The send animation's copy takes over from here.
          sent && "invisible",
          continuing && "motion-safe:animate-page-grow",
        )}
      >
        <InvoicePreview invoice={draft} company={company} />
      </PreviewPane>
    </>
  );
}

type LineItemRowProps = {
  item: LineItemDraft;
  index: number;
  autoFocus: boolean;
  canRemove: boolean;
  negativeSubtotal: boolean;
  currency: string;
  onChange: (id: string, changes: Partial<LineItemDraft>) => void;
  onRemove: (id: string) => void;
};

// Each row suggests a different kind of charge, so a multi-line invoice reads like a real one while it's empty.
const descriptionPlaceholders = [
  "Platform subscription",
  "Implementation services",
  "Onboarding and training",
  "Additional seats",
  "Priority support",
  "Data migration",
];

const LineItemRow = memo(function LineItemRow({
  item,
  index,
  autoFocus,
  canRemove,
  negativeSubtotal,
  currency,
  onChange,
  onRemove,
}: LineItemRowProps) {
  const position = `item ${index + 1}`;

  return (
    <div className="col-span-4 grid grid-cols-subgrid items-center">
      <FieldRoot>
        <Input
          required
          autoFocus={autoFocus}
          aria-label={`Description for ${position}`}
          maxLength={limits.description}
          placeholder={descriptionPlaceholders[index % descriptionPlaceholders.length]}
          value={item.description}
          onChange={(event) => onChange(item.id, { description: event.target.value })}
        />
      </FieldRoot>
      <FieldRoot>
        <Input
          required
          aria-label={`Quantity for ${position}`}
          type="number"
          min={0}
          max={limits.quantity}
          step="any"
          inputMode="decimal"
          value={item.quantity}
          onKeyDown={(event) => {
            if (["-", "+", "e", "E"].includes(event.key)) event.preventDefault();
          }}
          onFocus={(event) => {
            const quantity = trimZeroDecimals(event.target.value);
            if (quantity !== item.quantity) onChange(item.id, { quantity });
          }}
          onBlur={(event) => {
            const quantity = formatDecimalInput(event.target.value, 1);
            if (quantity !== item.quantity) onChange(item.id, { quantity });
          }}
          onChange={(event) => {
            const quantity = event.target.value;
            // Rejected edits snap back to the last value, so quantity never goes negative.
            if (quantity === "" || Number(quantity) >= 0) onChange(item.id, { quantity });
          }}
        />
      </FieldRoot>
      <FieldRoot invalid={(negativeSubtotal && Number(item.unitPrice) < 0) || undefined}>
        <Input
          required
          aria-label={`Unit price for ${position}`}
          type="number"
          min={-limits.unitPrice}
          max={limits.unitPrice}
          step="any"
          inputMode="decimal"
          placeholder="0.00"
          prefix={currencySymbol(currency)}
          value={item.unitPrice}
          onFocus={(event) => {
            const unitPrice = trimZeroDecimals(event.target.value);
            if (unitPrice !== item.unitPrice) onChange(item.id, { unitPrice });
          }}
          onBlur={(event) => {
            const unitPrice = formatDecimalInput(event.target.value, 2);
            if (unitPrice !== item.unitPrice) onChange(item.id, { unitPrice });
          }}
          onChange={(event) => onChange(item.id, { unitPrice: event.target.value })}
        />
      </FieldRoot>
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        disabled={!canRemove}
        aria-label={`Remove ${position}`}
        className={twMerge(
          "flex size-8 items-center justify-center",
          "cursor-pointer rounded-full text-stone-500 hover:bg-stone-900/5",
          "disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent",
        )}
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden className="size-3.5">
          <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
});

type TextFieldProps = {
  label: string;
  name?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
  notice?: ReactNode;
  children: ReactNode;
};

function TextField({ label, name, className, ref, notice, children }: TextFieldProps) {
  return (
    <FieldRoot ref={ref} name={name} className={twMerge("flex flex-col gap-1.5", className)}>
      <FieldLabel className="text-secondary">{label}</FieldLabel>
      {children}
      <FieldMessage notice={notice} />
    </FieldRoot>
  );
}

const messageClassName = "border-x-[0.5px] border-transparent px-3.5 text-xs text-red-700";

// Earlier entries win, so a field only ever shows its most pressing problem. The live limit notice sits between
// hard errors and the softer decimal-places hint.
const validityMessages: [keyof ValidityState, string][] = [
  ["valueMissing", "This field can't be left empty"],
  ["badInput", "Enter a number"],
  ["typeMismatch", "Enter a valid email address"],
  ["rangeUnderflow", "Can't be negative"],
];

function FieldMessage({ notice }: { notice?: ReactNode }) {
  return (
    <FieldValidity>
      {({ validity }) => {
        const message =
          validityMessages.find(([key]) => validity[key])?.[1] ||
          notice ||
          (validity.stepMismatch && "Use up to 2 decimal places");
        if (!message) return null;
        return (
          <FieldError match className={twMerge(messageClassName, "motion-safe:animate-type-in")}>
            {message}
          </FieldError>
        );
      }}
    </FieldValidity>
  );
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const lineItemFields = ["description", "quantity", "unitPrice"] as const;
const lineItemFieldNames = { description: "description", quantity: "quantity", unitPrice: "unit price" };

function allItemFieldKeys(items: LineItemDraft[]) {
  return new Set(items.flatMap((item) => lineItemFields.map((field) => itemFieldKey(item.id, field))));
}

function itemFieldKey(id: string, field: string) {
  return `${id}:${field}`;
}

function lineItemsProblem(items: LineItemDraft[], checkedItemFields: ReadonlySet<string>, subtotalCents: number) {
  const checked = (item: LineItemDraft, field: (typeof lineItemFields)[number]) =>
    checkedItemFields.has(itemFieldKey(item.id, field));
  const missing = lineItemFields
    .filter((field) => items.some((item) => checked(item, field) && item[field] === ""))
    .map((field) => lineItemFieldNames[field]);
  if (missing.length) {
    const fields = missing.length > 1 ? `${missing.slice(0, -1).join(", ")} and ${missing.at(-1)}` : missing[0];
    return `${capitalize(fields)} can't be left empty`;
  }
  if (subtotalCents < 0) return "Negative prices can't bring the subtotal below zero";
  if (items.some((item) => item.description.length >= limits.description))
    return `Description limit is ${limits.description.toLocaleString("en-US")} characters`;
  if (items.some((item) => exceeds(item.quantity, limits.quantity)))
    return `Quantity max is ${limits.quantity.toLocaleString("en-US")}`;
  if (items.some((item) => Math.abs(Number(item.unitPrice)) > limits.unitPrice))
    return `Unit price must be within ±${limits.unitPrice.toLocaleString("en-US")}`;
  return null;
}

function LineItemProblems({
  items,
  checkedItemFields,
  subtotalCents,
}: {
  items: LineItemDraft[];
  checkedItemFields: ReadonlySet<string>;
  subtotalCents: number;
}) {
  const problem = lineItemsProblem(items, checkedItemFields, subtotalCents);
  if (!problem) return null;
  return (
    <p key={problem} aria-live="polite" className={twMerge(messageClassName, "-mt-1 motion-safe:animate-type-in")}>
      {problem}
    </p>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd className="text-right font-mono">{value}</dd>
    </>
  );
}
