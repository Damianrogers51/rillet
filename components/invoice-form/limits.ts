export const limits = {
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

export function exceeds(value: string, max: number) {
  return value !== "" && Number(value) > max;
}

export const characterLimitNotice = (value: string, max: number) =>
  value.length >= max ? `Limit is ${max.toLocaleString("en-US")} characters` : null;

export const numberLimitNotice = (max: number, unit = "") => `Max is ${max.toLocaleString("en-US")}${unit}`;
