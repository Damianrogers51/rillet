"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Ref } from "react";
import { Form } from "@base-ui/react/form";
import {
  Autocomplete,
  DatePicker,
  Input,
  Select,
  TextField,
  Textarea,
  characterLimitNotice,
  exceeds,
  numberLimitNotice,
} from "@/components/Input";
import { Button } from "@/components/Button";
import { InvoicePreview } from "@/components/InvoicePreview";
import {
  PanelBackButton,
  PanelCloseButton,
  PreviewPane,
  previewPageRect,
  Section,
  ShowPreviewButton,
  SidePanelHeader,
  sidePanelBodyClassName,
  sidePanelClassName,
  sidePanelFooterClassName,
} from "@/components/InvoiceSheetLayout";
import { Switch } from "@/components/Switch";
import {
  LineItemList,
  allItemFieldKeys,
  emptyLineItem,
  itemFieldKey,
  toLineItem,
  toLineItemDraft,
  type LineItemDraft,
} from "@/components/invoice-form/LineItems";
import {
  addDays,
  currencies,
  invoiceAmounts,
  invoiceLimits,
  lineItemAmountCents,
  markSent,
  type Company,
  type Invoice,
} from "@/lib/invoices";
import { prefersReducedMotion } from "@/lib/motion";
import { useCustomers, useNextInvoiceNumber } from "@/hooks/queries";
import { twMerge } from "tailwind-merge";

// Invoices store the discount as an amount; four decimals keep the percentage close enough to round back to it.
function discountPercentOf(invoice: Invoice) {
  const { subtotalCents } = invoiceAmounts(invoice);
  if (!invoice.discount || subtotalCents <= 0) return "";
  return String(+((invoice.discount * 100 * 100) / subtotalCents).toFixed(4));
}

type InvoiceFormProps = {
  ref?: Ref<HTMLFormElement>;
  /** Fills the form from an existing invoice and saves changes to it instead of creating a new one. */
  editing?: Invoice;
  /** Flags every missing field as soon as the form opens, for a draft that couldn't be sent as it was. */
  validateOnMount?: boolean;
  className?: string;
  validationKey?: number;
  company: Company;
  today: string;
  /** Replaces an invoice that was just submitted with "Create another" checked. */
  continuing?: boolean;
  createAnother?: boolean;
  onCreateAnotherChange?: (createAnother: boolean) => void;
  onDismiss: () => void;
  /** `sentFrom` is where the preview page sat when the invoice was sent or saved, for the submit animation. */
  onSubmit: (invoice: Invoice, sentFrom?: DOMRect) => void;
};

export function InvoiceForm({
  ref,
  editing,
  validateOnMount = false,
  className,
  validationKey = 0,
  company,
  today,
  continuing = false,
  createAnother = false,
  onCreateAnotherChange,
  onDismiss,
  onSubmit,
}: InvoiceFormProps) {
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
  const [currency, setCurrency] = useState<string>(editing?.currency ?? company.baseCurrency);
  const [dueDate, setDueDate] = useState(editing?.dueDate ?? addDays(today, 30));
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
    }
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

  const { data: nextInvoiceNumber = "" } = useNextInvoiceNumber(today, !editing);
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
      currency,
      dueDate,
      memo: memo.trim(),
      taxRate: Math.min(Number(taxPercent) || 0, invoiceLimits.taxPercent) / 100,
      // Stored as an amount so existing invoices and totals keep working; rounded to the cent.
      discount:
        Math.round((discountableCents * Math.min(Number(discountPercent) || 0, invoiceLimits.discountPercent)) / 100) /
        100,
      lineItems: items,
    };
    if (editing) return { ...editing, ...details };
    return {
      id: crypto.randomUUID(),
      invoiceNumber,
      ...details,
      status: send ? "Sent" : "Draft",
      paymentStatus: send ? "Open" : "Unsent",
      issueDate: today,
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

  // A draft only needs a customer to be found again; everything else is checked when it's sent.
  function canSaveDraft() {
    if (blockNegativeSubtotal()) return false;
    if (customerName.trim()) return true;
    formActions.current?.validate("customerName");
    customerNameField.current?.querySelector("input")?.focus();
    return false;
  }

  function submitAnimated(invoice: Invoice) {
    const page = previewPageRect(previewPane.current);
    const animate = page && !prefersReducedMotion();
    if (animate) setSent(true);
    onSubmit(invoice, animate ? page : undefined);
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

  function saveChanges() {
    if (!editing || !canSaveDraft()) return;
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

  function saveDraft() {
    if (canSaveDraft()) submitAnimated(buildInvoice(false));
  }

  const draft = buildInvoice();
  const { subtotalCents } = invoiceAmounts(draft);

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
          submitAnimated(editing ? markSent(buildEdited(editing), today) : buildInvoice(true));
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
              notice={characterLimitNotice(customerName, invoiceLimits.customerName)}
            >
              <Autocomplete
                required
                maxLength={invoiceLimits.customerName}
                placeholder="Acme Labs"
                value={customerName}
                suggestions={[...knownCustomers.keys()]}
                onChange={changeCustomerName}
              />
            </TextField>

            <TextField label="Billing email" notice={characterLimitNotice(billingEmail, invoiceLimits.billingEmail)}>
              <Input
                required
                type="email"
                maxLength={invoiceLimits.billingEmail}
                placeholder="ap@acmelabs.example"
                value={billingEmail}
                onChange={(event) => setBillingEmail(event.target.value)}
              />
            </TextField>

            <TextField
              label="Billing address"
              notice={characterLimitNotice(billingAddress, invoiceLimits.billingAddress)}
            >
              <Input
                maxLength={invoiceLimits.billingAddress}
                placeholder="415 Market Street, San Francisco, CA 94105"
                value={billingAddress}
                onChange={(event) => setBillingAddress(event.target.value)}
              />
            </TextField>
          </Section>

          <Section title="Payment">
            <Select label="Currency" value={currency} options={[...currencies]} onChange={setCurrency} />
            <DatePicker label="Due date" value={dueDate} min={today} onChange={setDueDate} />
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
            <LineItemList
              items={lineItems}
              addedItemId={addedItemId}
              checkedItemFields={checkedItemFields}
              subtotalCents={subtotalCents}
              currency={currency}
              onChange={updateLineItem}
              onRemove={removeLineItem}
            />
          </Section>

          <Section title="Additional">
            <div className="grid grid-cols-2 gap-3">
              <PercentField
                label="Discount"
                max={invoiceLimits.discountPercent}
                value={discountPercent}
                onChange={setDiscountPercent}
              />
              <PercentField
                label="Tax rate"
                max={invoiceLimits.taxPercent}
                value={taxPercent}
                onChange={setTaxPercent}
              />
            </div>

            <TextField label="Memo" notice={characterLimitNotice(memo, invoiceLimits.memo)}>
              <Textarea
                maxLength={invoiceLimits.memo}
                placeholder="What this invoice covers"
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
              />
            </TextField>
          </Section>
        </div>

        <footer className={sidePanelFooterClassName}>
          {editing ? (
            <Button variant="secondary" className="ml-auto" onClick={saveChanges}>
              Save Changes
            </Button>
          ) : (
            <>
              <Switch className="mr-auto" checked={createAnother} onCheckedChange={(on) => onCreateAnotherChange?.(on)}>
                Create More
              </Switch>
              <Button variant="secondary" onClick={saveDraft}>
                Save as Draft
              </Button>
            </>
          )}
          <Button type="submit" onClick={() => setCheckedItemFields(allItemFieldKeys(lineItems))}>
            Send Invoice
          </Button>
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

type PercentFieldProps = { label: string; max: number; value: string; onChange: (value: string) => void };

function PercentField({ label, max, value, onChange }: PercentFieldProps) {
  return (
    <TextField label={label} notice={exceeds(value, max) && numberLimitNotice(max, "%")}>
      <Input
        type="number"
        min={0}
        max={max}
        step="any"
        inputMode="decimal"
        placeholder="0"
        suffix="%"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </TextField>
  );
}
