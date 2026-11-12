export type InvoiceStatus = "Draft" | "Sent" | "Paid" | "Void";

export type PaymentStatus = "Unsent" | "Open" | "Overdue" | "Paid" | "Voided";

export type LineItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  accountCode: string;
};

export type InvoiceActivity = {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
};

export type Invoice = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  billingEmail: string;
  billingAddress: string;
  paymentTerms: string;
  status: InvoiceStatus;
  paymentStatus: PaymentStatus;
  currency: string;
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  memo: string;
  taxRate: number;
  discount: number;
  lineItems: LineItem[];
  activity: InvoiceActivity[];
};

export type Company = {
  name: string;
  industry: string;
  baseCurrency: string;
};

export const paymentTerms = {
  "Due on receipt": 0,
  "Net 15": 15,
  "Net 30": 30,
  "Net 45": 45,
  "Net 60": 60,
} as const;

export type PaymentTerms = keyof typeof paymentTerms;

export const currencies = ["USD", "CAD", "GBP", "EUR"] as const;

export function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Numbers keep counting up across years; only the year in the prefix changes. */
export function invoiceNumberAfter(highestSequence: number, issueDate: string) {
  return `INV-${issueDate.slice(0, 4)}-${String(highestSequence + 1).padStart(4, "0")}`;
}

export function toCents(amount: number) {
  return Math.round(amount * 100);
}

export function lineItemAmountCents(item: LineItem) {
  return toCents(item.quantity * item.unitPrice);
}

export function invoiceAmounts(invoice: Invoice) {
  const subtotalCents = invoice.lineItems.reduce((sum, item) => sum + lineItemAmountCents(item), 0);
  const discountCents = Math.max(Math.min(toCents(invoice.discount), subtotalCents), 0);
  const taxableCents = subtotalCents - discountCents;
  const taxCents = Math.round(taxableCents * invoice.taxRate);
  return { subtotalCents, discountCents, taxCents, totalCents: taxableCents + taxCents };
}

export function invoiceTotalCents(invoice: Invoice) {
  return invoiceAmounts(invoice).totalCents;
}

export function markSent(invoice: Invoice): Invoice {
  return {
    ...invoice,
    status: "Sent",
    paymentStatus: "Open",
    activity: [
      ...invoice.activity,
      {
        id: `${invoice.invoiceNumber}-sent-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor: "You",
        action: "Sent the invoice to the customer",
      },
    ],
  };
}

export function markVoided(invoice: Invoice): Invoice {
  return {
    ...invoice,
    status: "Void",
    paymentStatus: "Voided",
    activity: [
      ...invoice.activity,
      {
        id: `${invoice.invoiceNumber}-voided-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor: "You",
        action: "Voided the invoice",
      },
    ],
  };
}

/** Whether a draft has everything the invoice form requires before sending it. */
export function isReadyToSend(invoice: Invoice) {
  return (
    invoice.customerName.trim() !== "" &&
    /^[^\s@]+@[^\s@]+$/.test(invoice.billingEmail.trim()) &&
    invoice.lineItems.length > 0 &&
    invoice.lineItems.every((item) => item.description.trim() !== "") &&
    invoiceAmounts(invoice).subtotalCents >= 0
  );
}
