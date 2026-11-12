"use client";

import { memo, type FocusEvent } from "react";
import { Field } from "@base-ui/react/field";
import { twMerge } from "tailwind-merge";
import { Input, exceeds, fieldMessageClassName } from "@/components/Input";
import { currencySymbol, formatDecimalInput, trimZeroDecimals } from "@/lib/format";
import { invoiceLimits, type LineItem } from "@/lib/invoices";

export type LineItemDraft = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

// Untouched drafts keep their identity across edits, so caching by object lets unchanged preview rows skip re-rendering.
const lineItemCache = new WeakMap<LineItemDraft, LineItem>();

export function toLineItem(draft: LineItemDraft): LineItem {
  let item = lineItemCache.get(draft);
  if (!item) {
    item = {
      id: draft.id,
      description: draft.description.trim(),
      quantity: Math.min(Number(draft.quantity) || 0, invoiceLimits.quantity),
      unitPrice: Math.max(Math.min(Number(draft.unitPrice) || 0, invoiceLimits.unitPrice), -invoiceLimits.unitPrice),
      accountCode: "",
    };
    lineItemCache.set(draft, item);
  }
  return item;
}

export function toLineItemDraft(item: LineItem): LineItemDraft {
  return {
    id: item.id,
    description: item.description,
    quantity: formatDecimalInput(String(item.quantity), 1),
    unitPrice: formatDecimalInput(String(item.unitPrice), 2),
  };
}

export function emptyLineItem(): LineItemDraft {
  return { id: `draft-li-${crypto.randomUUID()}`, description: "", quantity: "1.0", unitPrice: "" };
}

const lineItemFields = ["description", "quantity", "unitPrice"] as const;
const lineItemFieldNames = { description: "description", quantity: "quantity", unitPrice: "unit price" };

export function itemFieldKey(id: string, field: string) {
  return `${id}:${field}`;
}

export function allItemFieldKeys(items: LineItemDraft[]) {
  return new Set(items.flatMap((item) => lineItemFields.map((field) => itemFieldKey(item.id, field))));
}

type LineItemListProps = {
  items: LineItemDraft[];
  addedItemId: string | null;
  /** Fields that have been edited or sent, so empty ones are reported in the summary below the rows. */
  checkedItemFields: ReadonlySet<string>;
  subtotalCents: number;
  currency: string;
  onChange: (id: string, changes: Partial<LineItemDraft>) => void;
  onRemove: (id: string) => void;
};

export function LineItemList({
  items,
  addedItemId,
  checkedItemFields,
  subtotalCents,
  currency,
  onChange,
  onRemove,
}: LineItemListProps) {
  const problem = lineItemsProblem(items, checkedItemFields, subtotalCents);
  return (
    <>
      <div className="grid grid-cols-[50%_1fr_1fr_2.375rem] items-center gap-x-2 gap-y-2">
        <span className="text-secondary">Description</span>
        <span className="text-secondary">Quantity</span>
        <span className="text-secondary">Unit price</span>
        <span />

        {items.map((item, index) => (
          <LineItemRow
            key={item.id}
            item={item}
            index={index}
            autoFocus={item.id === addedItemId}
            canRemove={items.length > 1}
            negativeSubtotal={subtotalCents < 0}
            currency={currency}
            onChange={onChange}
            onRemove={onRemove}
          />
        ))}
      </div>

      {problem && (
        <p
          key={problem}
          aria-live="polite"
          className={twMerge(fieldMessageClassName, "-mt-1 motion-safe:animate-type-in")}
        >
          {problem}
        </p>
      )}
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

  // Trailing zeros drop away while a number is being edited and come back, padded to `places`, once it's left.
  function decimalProps(field: "quantity" | "unitPrice", places: number) {
    const update = (value: string) => {
      if (value !== item[field]) onChange(item.id, { [field]: value });
    };
    return {
      value: item[field],
      onFocus: (event: FocusEvent<HTMLInputElement>) => update(trimZeroDecimals(event.target.value)),
      onBlur: (event: FocusEvent<HTMLInputElement>) => update(formatDecimalInput(event.target.value, places)),
    };
  }

  return (
    <div className="col-span-4 grid grid-cols-subgrid items-center">
      <Field.Root>
        <Input
          required
          autoFocus={autoFocus}
          aria-label={`Description for ${position}`}
          maxLength={invoiceLimits.description}
          placeholder={descriptionPlaceholders[index % descriptionPlaceholders.length]}
          value={item.description}
          onChange={(event) => onChange(item.id, { description: event.target.value })}
        />
      </Field.Root>
      <Field.Root>
        <Input
          required
          aria-label={`Quantity for ${position}`}
          type="number"
          min={0}
          max={invoiceLimits.quantity}
          step="any"
          inputMode="decimal"
          {...decimalProps("quantity", 1)}
          onKeyDown={(event) => {
            if (["-", "+", "e", "E"].includes(event.key)) event.preventDefault();
          }}
          onChange={(event) => {
            const quantity = event.target.value;
            // Rejected edits snap back to the last value, so quantity never goes negative.
            if (quantity === "" || Number(quantity) >= 0) onChange(item.id, { quantity });
          }}
        />
      </Field.Root>
      <Field.Root invalid={(negativeSubtotal && Number(item.unitPrice) < 0) || undefined}>
        <Input
          required
          aria-label={`Unit price for ${position}`}
          type="number"
          min={-invoiceLimits.unitPrice}
          max={invoiceLimits.unitPrice}
          step="any"
          inputMode="decimal"
          placeholder="0.00"
          prefix={currencySymbol(currency)}
          {...decimalProps("unitPrice", 2)}
          onChange={(event) => onChange(item.id, { unitPrice: event.target.value })}
        />
      </Field.Root>
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

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function lineItemsProblem(items: LineItemDraft[], checkedItemFields: ReadonlySet<string>, subtotalCents: number) {
  const checked = (item: LineItemDraft, field: (typeof lineItemFields)[number]) =>
    checkedItemFields.has(itemFieldKey(item.id, field));
  const missing = lineItemFields
    .filter((field) => items.some((item) => checked(item, field) && item[field] === ""))
    .map((field) => lineItemFieldNames[field]);
  if (missing.length) {
    const fields = missing.length > 1 ? `${missing.slice(0, -1).join(", ")} and ${missing.at(-1)}` : missing[0];
    return `${capitalize(fields)} ${missing.length > 1 ? "are" : "is"} required to send this invoice`;
  }
  if (subtotalCents < 0) return "Negative prices can't bring the subtotal below zero";
  if (items.some((item) => item.description.length >= invoiceLimits.description))
    return `Description limit is ${invoiceLimits.description.toLocaleString("en-US")} characters`;
  if (items.some((item) => exceeds(item.quantity, invoiceLimits.quantity)))
    return `Quantity max is ${invoiceLimits.quantity.toLocaleString("en-US")}`;
  if (items.some((item) => Math.abs(Number(item.unitPrice)) > invoiceLimits.unitPrice))
    return `Unit price must be within ±${invoiceLimits.unitPrice.toLocaleString("en-US")}`;
  return null;
}
