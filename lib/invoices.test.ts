import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { invoiceAmounts, isReadyToSend, markSent, markVoided, type Invoice, type LineItem } from "@/lib/invoices";

function item(overrides: Partial<LineItem> = {}): LineItem {
  return { id: "l1", description: "Platform subscription", quantity: 1, unitPrice: 100, accountCode: "", ...overrides };
}

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "1",
    invoiceNumber: "INV-2026-0001",
    customerName: "Acme Labs",
    billingEmail: "ap@acme.example",
    billingAddress: "",
    status: "Draft",
    paymentStatus: "Unsent",
    currency: "USD",
    issueDate: "2026-05-04",
    createdAt: "2026-05-04T16:00:00.000Z",
    dueDate: "2026-06-03",
    memo: "",
    taxRate: 0,
    discount: 0,
    lineItems: [item()],
    activity: [],
    ...overrides,
  };
}

describe("invoice amounts", () => {
  it("rounds each line to the cent before adding them", () => {
    const amounts = invoiceAmounts(
      invoice({ lineItems: [item({ unitPrice: 1.004 }), item({ id: "l2", unitPrice: 1.004 })] }),
    );
    assert.equal(amounts.subtotalCents, 200);
  });

  it("applies the discount before tax and never discounts more than the subtotal", () => {
    const amounts = invoiceAmounts(invoice({ discount: 10, taxRate: 0.08 }));
    assert.deepEqual(amounts, { subtotalCents: 10000, discountCents: 1000, taxCents: 720, totalCents: 9720 });

    const wipedOut = invoiceAmounts(invoice({ discount: 150 }));
    assert.deepEqual(wipedOut, { subtotalCents: 10000, discountCents: 10000, taxCents: 0, totalCents: 0 });
  });

  it("lets a credit line reduce the subtotal", () => {
    const amounts = invoiceAmounts(invoice({ lineItems: [item(), item({ id: "l2", unitPrice: -40 })] }));
    assert.equal(amounts.subtotalCents, 6000);
    assert.equal(amounts.totalCents, 6000);
  });
});

describe("ready to send", () => {
  it("accepts a draft that has a customer, a real email, and described lines", () => {
    assert.equal(isReadyToSend(invoice({ customerName: "  Acme Labs  ", billingEmail: " ap@acme.example " })), true);
  });

  it("rejects a draft that is missing what sending needs", () => {
    assert.equal(isReadyToSend(invoice({ customerName: "  " })), false);
    assert.equal(isReadyToSend(invoice({ billingEmail: "not-an-email" })), false);
    assert.equal(isReadyToSend(invoice({ lineItems: [] })), false);
    assert.equal(isReadyToSend(invoice({ lineItems: [item({ description: "  " })] })), false);
    assert.equal(isReadyToSend(invoice({ lineItems: [item({ unitPrice: -1 })] })), false);
  });
});

describe("sending and voiding", () => {
  const draft = invoice({
    issueDate: "2026-04-01",
    activity: [
      { id: "created", timestamp: "2026-04-01T12:00:00.000Z", actor: "You", action: "Created a draft invoice" },
    ],
  });

  it("issues a draft on the day it's sent and keeps its history", () => {
    const sent = markSent(draft, "2026-05-04");
    assert.equal(sent.issueDate, "2026-05-04");
    assert.equal(sent.status, "Sent");
    assert.equal(sent.paymentStatus, "Open");
    assert.deepEqual(
      sent.activity.map((entry) => entry.action),
      ["Created a draft invoice", "Sent the invoice to the customer"],
    );
    assert.equal(sent.invoiceNumber, draft.invoiceNumber);
  });

  it("voids an invoice without dropping the record", () => {
    const voided = markVoided(draft, "2026-05-04");
    assert.equal(voided.status, "Void");
    assert.equal(voided.paymentStatus, "Voided");
    assert.equal(voided.invoiceNumber, draft.invoiceNumber);
    assert.equal(voided.issueDate, draft.issueDate);
    assert.equal(voided.activity.at(-1)?.action, "Voided the invoice");
  });
});
