export const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export const shortDateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export const activityTimeFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/New_York",
});

const quantityFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 4 });
const decimalInputFormats = new Map<number, Intl.NumberFormat>();

export function moneyFormatOptions(currency: string): Intl.NumberFormatOptions {
  // "negative" leaves zero, including -0 and amounts that round to zero, unsigned.
  return { style: "currency", currency, currencyDisplay: "narrowSymbol", signDisplay: "negative" };
}

function unitPriceFormatOptions(currency: string): Intl.NumberFormatOptions {
  return { ...moneyFormatOptions(currency), minimumFractionDigits: 2, maximumFractionDigits: 4 };
}

export function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", moneyFormatOptions(currency)).format(cents / 100);
}

export function formatUnitPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", unitPriceFormatOptions(currency)).format(amount);
}

export function formatQuantity(quantity: number) {
  return quantityFormat.format(quantity);
}

export function formatPercent(rate: number) {
  return `${+(rate * 100).toFixed(2)}%`;
}

/** Pads a number input's value to `minimumFractionDigits` (keeping up to 4) for display while it's not being edited. */
export function formatDecimalInput(value: string, minimumFractionDigits: number) {
  if (value === "") return value;
  let format = decimalInputFormats.get(minimumFractionDigits);
  if (!format) {
    format = new Intl.NumberFormat("en-US", { useGrouping: false, minimumFractionDigits, maximumFractionDigits: 4 });
    decimalInputFormats.set(minimumFractionDigits, format);
  }
  return format.format(Number(value));
}

/** Drops all-zero decimals (`10.00` → `10`) so editing starts from the plain number. */
export function trimZeroDecimals(value: string) {
  return value.includes(".") && Number.isInteger(Number(value)) ? String(Number(value)) : value;
}

export function currencySymbol(currency: string) {
  const parts = new Intl.NumberFormat("en-US", moneyFormatOptions(currency)).formatToParts(0);
  return parts.find((part) => part.type === "currency")?.value ?? currency;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function pluralizeDays(days: number) {
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/** Whole days from `today` until `date`; negative once it has passed. */
export function daysUntil(date: string, today: string) {
  return Math.round((new Date(date).getTime() - new Date(today).getTime()) / DAY_MS);
}
