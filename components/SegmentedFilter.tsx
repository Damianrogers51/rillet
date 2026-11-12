"use client";

import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { twMerge } from "tailwind-merge";

export type FilterOption<Value extends string> = {
  value: Value;
  label: string;
  count: number;
};

type SegmentedFilterProps<Value extends string> = {
  label: string;
  options: FilterOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  className?: string;
};

export function SegmentedFilter<Value extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedFilterProps<Value>) {
  return (
    <ToggleGroup
      aria-label={label}
      value={[value]}
      onValueChange={(groupValue) => {
        if (groupValue[0]) onChange(groupValue[0] as Value);
      }}
      className={twMerge(
        // Scrolls sideways when the options don't fit; the vertical padding keeps focus rings from being clipped.
        "-my-1 flex items-center gap-1 overflow-x-auto py-1 [scrollbar-width:none]",
        "text-[14px]",
        className,
      )}
    >
      {options.map((option) => (
        <Toggle
          key={option.value}
          value={option.value}
          className={twMerge(
            "flex shrink-0 items-center gap-2",
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
