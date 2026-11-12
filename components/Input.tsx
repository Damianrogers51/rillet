"use client";

import { useState, type ComponentProps, type ReactNode, type Ref } from "react";
import { Autocomplete as BaseAutocomplete } from "@base-ui/react/autocomplete";
import { Field } from "@base-ui/react/field";
import { Input as BaseInput } from "@base-ui/react/input";
import { Popover } from "@base-ui/react/popover";
import { Select as BaseSelect } from "@base-ui/react/select";
import { DayPicker, type ChevronProps } from "react-day-picker";
import { twMerge } from "tailwind-merge";
import { dateFormat } from "@/lib/format";

const fieldClassName = twMerge(
  "w-full min-w-0",
  "border-[0.5px] border-stone-900/15 bg-surface text-primary outline-none ring-0 ring-stone-900/[0.07]",
  // Dropdowns return focus only after their close animation, so the ring waits before fading to bridge that gap.
  "transition-[border-color,box-shadow,background-color,color] duration-100 [transition-delay:150ms,150ms,0ms,0ms]",
  "placeholder:text-stone-400 placeholder:transition-colors placeholder:duration-100",
  "focus:border-stone-900/25 focus:ring-4 focus:delay-0",
  "data-[popup-open]:border-stone-900/25 data-[popup-open]:ring-4 data-[popup-open]:delay-0",
  "data-[invalid]:border-red-500/30 data-[invalid]:bg-red-50/60 data-[invalid]:ring-red-500/10",
  "data-[invalid]:focus:border-red-500/50 data-[invalid]:data-[popup-open]:border-red-500/50",
  "data-[invalid]:text-red-700 data-[invalid]:placeholder:text-red-950/30",
);

const pillClassName = twMerge(fieldClassName, "h-8.5 rounded-full px-3.5");

const numberClassName =
  "font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

const positionerClassName = "z-50 outline-none";

const popupClassName = twMerge(
  "scroll-shadow min-w-[var(--anchor-width)] origin-[var(--transform-origin)] overflow-hidden",
  "text-[13px]",
  "rounded-[20px] border-[0.5px] border-stone-900/15 bg-white text-stone-900/80 shadow-lg outline-none",
  "transition-[scale,opacity] duration-100 ease-out",
  "data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0",
  "data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0",
);

const listClassName = twMerge(
  "scroll-shadow-source scroll-py-[4.75rem] overflow-y-auto overscroll-contain p-1",
  "max-h-[min(18.5rem,var(--available-height))]",
  "scrollbar-subtle",
);

const itemClassName = twMerge(
  "flex items-center justify-between gap-3 px-2.5 py-1.5",
  "cursor-pointer rounded-full outline-none select-none",
  "data-[highlighted]:bg-stone-900/5 data-[highlighted]:text-primary",
  "data-[selected]:text-primary",
);

type InputProps = Omit<ComponentProps<typeof BaseInput>, "className" | "prefix"> & {
  className?: string;
  /** A single character, like a currency symbol, shown before the value. */
  prefix?: string;
  /** A single character, like a percent sign, shown at the far end of the field. */
  suffix?: string;
};

const affixClassName = twMerge(
  "pointer-events-none absolute top-1/2 -translate-y-1/2",
  "font-mono text-stone-400 transition-colors duration-100",
  "peer-data-[invalid]:text-red-950/30",
);

export function Input({ className = "", type, prefix, suffix, ...props }: InputProps) {
  const input = (
    <BaseInput
      type={type}
      className={twMerge(
        pillClassName,
        type === "number" && numberClassName,
        (prefix || suffix) && "peer",
        prefix && "pl-[calc(0.875rem+1ch+0.25rem)]",
        suffix && "pr-[calc(0.875rem+1ch+0.25rem)]",
        className,
      )}
      {...props}
    />
  );
  if (!prefix && !suffix) return input;
  return (
    <div className="relative">
      {input}
      {prefix && (
        <span aria-hidden className={twMerge(affixClassName, "left-3.5")}>
          {prefix}
        </span>
      )}
      {suffix && (
        <span aria-hidden className={twMerge(affixClassName, "right-3.5")}>
          {suffix}
        </span>
      )}
    </div>
  );
}

type TextareaProps = Omit<ComponentProps<typeof BaseInput>, "className" | "render"> & {
  className?: string;
  rows?: number;
};

export function Textarea({ className = "", rows = 3, ...props }: TextareaProps) {
  return (
    <BaseInput
      render={<textarea rows={rows} />}
      className={twMerge(fieldClassName, "resize-none rounded-2xl px-3.5 py-2 leading-relaxed", className)}
      {...props}
    />
  );
}

type SelectProps = {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
};

export function Select({ label, value, options, onChange }: SelectProps) {
  return (
    <BaseSelect.Root value={value} onValueChange={(nextValue) => nextValue !== null && onChange(nextValue)}>
      <div className="flex flex-col gap-1.5">
        <BaseSelect.Label className="text-secondary">{label}</BaseSelect.Label>
        <BaseSelect.Trigger
          className={twMerge(pillClassName, "flex cursor-pointer items-center justify-between gap-3 text-left")}
        >
          <BaseSelect.Value />
          <BaseSelect.Icon className="flex text-stone-500">
            <ChevronIcon />
          </BaseSelect.Icon>
        </BaseSelect.Trigger>
      </div>
      <BaseSelect.Portal>
        <BaseSelect.Positioner className={positionerClassName} sideOffset={6} alignItemWithTrigger={false}>
          <BaseSelect.Popup className={popupClassName}>
            <BaseSelect.List className={listClassName}>
              {options.map((option) => (
                <BaseSelect.Item key={option} value={option} className={itemClassName}>
                  <BaseSelect.ItemText>{option}</BaseSelect.ItemText>
                  <BaseSelect.ItemIndicator className="flex text-secondary">
                    <CheckIcon />
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}

type AutocompleteProps = {
  value: string;
  suggestions: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
};

export function Autocomplete({ value, suggestions, onChange, placeholder, required, maxLength }: AutocompleteProps) {
  return (
    <BaseAutocomplete.Root
      items={suggestions}
      value={value}
      onValueChange={onChange}
      openOnInputClick
      required={required}
    >
      <span className="relative flex">
        <BaseAutocomplete.Input
          placeholder={placeholder}
          maxLength={maxLength}
          className={twMerge(pillClassName, "pr-8")}
        />
        <BaseAutocomplete.Trigger
          aria-label="Show suggestions"
          className="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-3 pl-2 text-stone-500"
        >
          <ChevronIcon />
        </BaseAutocomplete.Trigger>
      </span>
      <BaseAutocomplete.Portal>
        <BaseAutocomplete.Positioner className={twMerge(positionerClassName, "data-[empty]:hidden")} sideOffset={6}>
          <BaseAutocomplete.Popup className={popupClassName}>
            <BaseAutocomplete.List className={listClassName}>
              {(suggestion: string) => (
                <BaseAutocomplete.Item key={suggestion} value={suggestion} className={itemClassName}>
                  {suggestion}
                </BaseAutocomplete.Item>
              )}
            </BaseAutocomplete.List>
          </BaseAutocomplete.Popup>
        </BaseAutocomplete.Positioner>
      </BaseAutocomplete.Portal>
    </BaseAutocomplete.Root>
  );
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function serializeDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const selectedDayClassName = "[&>button]:bg-stone-900 [&>button]:text-stone-50 [&>button]:hover:bg-stone-900";

const calendarClassNames = {
  months: "relative",
  month: "flex flex-col gap-2",
  month_caption: "flex h-8 items-center pl-2.5 font-[450] text-primary",
  nav: "absolute top-0 right-0 flex items-center",
  button_previous: twMerge(
    "flex size-8 items-center justify-center",
    "cursor-pointer rounded-full text-secondary",
    "hover:bg-stone-900/5",
    "disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent",
  ),
  button_next: twMerge(
    "flex size-8 items-center justify-center",
    "cursor-pointer rounded-full text-secondary",
    "hover:bg-stone-900/5",
    "disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent",
  ),
  month_grid: "border-collapse",
  weekday: "size-9 text-[12px] font-normal text-tertiary",
  day: "p-0 text-center tabular-nums",
  day_button: twMerge(
    "size-9",
    "cursor-pointer rounded-full outline-none",
    "transition-colors duration-100",
    "hover:bg-stone-900/5",
    "focus-visible:ring-2 focus-visible:ring-stone-900/20",
  ),
  today: twMerge(
    "[&:not([data-selected])>button]:bg-stone-500",
    "[&:not([data-selected])>button]:text-stone-50",
    "[&:not([data-selected])>button]:hover:bg-stone-600",
  ),
  selected: selectedDayClassName,
  outside: "text-stone-900/25",
  disabled: "text-stone-900/25 [&>button]:cursor-default [&>button]:hover:bg-transparent",
};

export function Chevron({ orientation }: Pick<ChevronProps, "orientation">) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      aria-hidden
      className={twMerge("size-3.5", orientation === "left" && "rotate-180")}
    >
      <path d="M6.5 4.5 10 8l-3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type DatePickerProps = {
  label: string;
  value: string;
  min?: string;
  today?: string;
  onChange: (value: string) => void;
};

export function DatePicker({ label, value, min, today, onChange }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseDate(value);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <div className="flex flex-col gap-1.5">
        <span className="text-secondary">{label}</span>
        <Popover.Trigger
          aria-label={`${label}, ${dateFormat.format(new Date(value))}`}
          className={twMerge(pillClassName, "flex cursor-pointer items-center justify-between gap-3 text-left")}
        >
          {dateFormat.format(new Date(value))}
          <CalendarIcon />
        </Popover.Trigger>
      </div>
      <Popover.Portal>
        <Popover.Positioner className={positionerClassName} sideOffset={6} align="start">
          <Popover.Popup className={twMerge(popupClassName, "min-w-0 rounded-[30px] p-3")}>
            <DayPicker
              mode="single"
              required
              selected={selected}
              defaultMonth={selected}
              today={today ? parseDate(today) : undefined}
              disabled={min ? { before: parseDate(min) } : undefined}
              startMonth={min ? parseDate(min) : undefined}
              showOutsideDays
              classNames={calendarClassNames}
              components={{ Chevron }}
              onSelect={(date) => {
                onChange(serializeDate(date));
                setOpen(false);
              }}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      aria-hidden
      className="pointer-events-none size-3.5 text-stone-500"
    >
      <rect x="2.5" y="3.5" width="11" height="10" rx="2" />
      <path d="M2.5 6.5h11M5.5 2v2.5M10.5 2v2.5" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      aria-hidden
      className="pointer-events-none size-3.5"
    >
      <path d="M4.5 6.5 8 10l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden className="size-3.5">
      <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type TextFieldProps = {
  label: string;
  name?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
  /** Shown below the field when it has no validation error of its own, like a character limit being reached. */
  notice?: ReactNode;
  children: ReactNode;
};

/** A labelled field that shows its most pressing validation problem underneath. */
export function TextField({ label, name, className, ref, notice, children }: TextFieldProps) {
  return (
    <Field.Root ref={ref} name={name} className={twMerge("flex flex-col gap-1.5", className)}>
      <Field.Label className="text-secondary">{label}</Field.Label>
      {children}
      <FieldMessage notice={notice} />
    </Field.Root>
  );
}

export function exceeds(value: string, max: number) {
  return value !== "" && Number(value) > max;
}

export const characterLimitNotice = (value: string, max: number) =>
  value.length >= max ? `Limit is ${max.toLocaleString("en-US")} characters` : null;

export const numberLimitNotice = (max: number, unit = "") => `Max is ${max.toLocaleString("en-US")}${unit}`;

export const fieldMessageClassName = "border-x-[0.5px] border-transparent px-3.5 text-xs text-red-700";

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
    <Field.Validity>
      {({ validity }) => {
        const message =
          validityMessages.find(([key]) => validity[key])?.[1] ||
          notice ||
          (validity.stepMismatch && "Use up to 2 decimal places");
        if (!message) return null;
        return (
          <Field.Error match className={twMerge(fieldMessageClassName, "motion-safe:animate-type-in")}>
            {message}
          </Field.Error>
        );
      }}
    </Field.Validity>
  );
}
