"use client";

import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { twMerge } from "tailwind-merge";

export type FilterOption<Value extends string> = {
  value: Value;
  label: string;
  count: number;
};

type InvoiceFiltersProps<Value extends string> = {
  options: FilterOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
};

export function InvoiceFilters<Value extends string>({ options, value, onChange }: InvoiceFiltersProps<Value>) {
  return (
    <ToggleGroup
      aria-label="Filter invoices"
      value={[value]}
      onValueChange={(groupValue) => {
        if (groupValue[0]) onChange(groupValue[0] as Value);
      }}
      className="flex flex-wrap items-center gap-1 text-[14px]"
    >
      {options.map((option) => (
        <Toggle
          key={option.value}
          value={option.value}
          className={twMerge(
            "flex items-center gap-2",
            "h-8.5 px-4",
            "cursor-pointer rounded-full text-secondary",
            "transition-colors",
            "hover:bg-stone-900/5",
            "data-[pressed]:bg-stone-900/[7%] data-[pressed]:text-primary data-[pressed]:hover:bg-stone-900/[9%]",
          )}
        >
          {option.label}
          <span className="font-mono text-xs text-stone-900/45">{option.count}</span>
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
