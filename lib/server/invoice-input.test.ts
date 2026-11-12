import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { invoiceLimits } from "@/lib/invoices";
import { parseInvoiceInput } from "@/lib/server/invoice-store";

function input(overrides: Record<string, unknown> = {}) {
  return {
    customerName: "Acme Labs",
    billingEmail: "ap@acme.example",
    billingAddress: "",
    memo: "",
    currency: "USD",
    issueDate: "2026-05-04",
    dueDate: "2026-06-03",
    taxRate: 0,
    discount: 0,
    lineItems: [{ id: "l1", description: "Platform subscription", quantity: 1, unitPrice: 10, accountCode: "" }],
    ...overrides,
  };
}

function rejected(body: unknown, error: string) {
  assert.deepEqual(parseInvoiceInput(body), { ok: false, status: 422, error });
}

describe("parseInvoiceInput", () => {
  it("accepts a complete invoice and drops anything the schema doesn't store", () => {
    const parsed = parseInvoiceInput({ ...input(), id: "ignored", status: "Sent" });
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.value.customerName, "Acme Labs");
      assert.equal(parsed.value.lineItems.length, 1);
      assert.equal("id" in parsed.value, false);
    }
  });

  it("rejects a body that isn't a usable invoice", () => {
    rejected(input({ customerName: 12 }), "customerName must be a string");
    rejected(
      input({ memo: "x".repeat(invoiceLimits.memo + 1) }),
      `memo can be at most ${invoiceLimits.memo} characters`,
    );
    rejected(input({ currency: "JPY" }), "Unsupported currency");
    rejected(input({ dueDate: "May 4" }), "dueDate must be a YYYY-MM-DD date");
    rejected(input({ discount: -1 }), "discount must be a non-negative number");
    rejected(input({ taxRate: 1.5 }), "taxRate can be at most 1");
    rejected(input({ lineItems: null }), "lineItems must be a list");
    rejected(
      input({ lineItems: [{ id: "l1", description: "Platform", accountCode: "", quantity: 1 }] }),
      "Every line item needs an id, description, account code, quantity and price",
    );
    rejected(
      input({
        lineItems: [
          { id: "l1", description: "Platform", accountCode: "", quantity: 1, unitPrice: invoiceLimits.unitPrice + 1 },
        ],
      }),
      `Line item descriptions can be at most ${invoiceLimits.description} characters, quantities between 0 and ` +
        `${invoiceLimits.quantity}, and unit prices within ±${invoiceLimits.unitPrice}`,
    );
  });
});
