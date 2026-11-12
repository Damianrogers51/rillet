"use client";

import { useCallback, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { InvoiceForm } from "@/components/invoice-form/InvoiceForm";
import { InvoicePreview } from "@/components/InvoicePreview";
import {
  InvoiceSheetPopup,
  PreviewPane,
  panelTransitionClassName,
  previewPageRect,
  swapPanel,
} from "@/components/InvoiceSheetLayout";
import { SentInvoiceFlight, type Flight } from "@/components/SentInvoiceFlight";
import { InvoiceDetails } from "@/components/details/InvoiceDetails";
import { ShreddedInvoice, type Shred } from "@/components/details/ShreddedInvoice";
import { isReadyToSend, markSent, markVoided, type Company, type Invoice } from "@/lib/invoices";
import { prefersReducedMotion } from "@/lib/motion";

type InvoiceDetailsSheetProps = {
  invoice: Invoice | null;
  company: Company;
  today: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (invoice: Invoice) => void;
  /** Takes the invoice as it looks once sent, including any edits made alongside sending it. */
  onSend: (invoice: Invoice) => void;
  onVoid: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
};

export function InvoiceDetailsSheet({
  invoice,
  company,
  today,
  open,
  onOpenChange,
  onSave,
  onSend,
  onVoid,
  onDelete,
}: InvoiceDetailsSheetProps) {
  const [editing, setEditing] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [flight, setFlight] = useState<Flight | null>(null);
  const endFlight = useCallback(() => setFlight(null), []);
  const [sent, setSent] = useState(false);
  const [shred, setShred] = useState<Shred | null>(null);
  const endShred = useCallback(() => setShred(null), []);
  const previewPane = useRef<HTMLDivElement>(null);
  const editForm = useRef<HTMLFormElement>(null);

  // Without a page to animate from, the invoice is sent and the sheet closes straight away.
  function flyOff(invoice: Invoice, page?: DOMRect) {
    if (!page || prefersReducedMotion()) {
      onSend(invoice);
      onOpenChange(false);
      return;
    }
    setSent(true);
    setFlight({ id: invoice.id, invoice, rect: page, centered: true });
  }

  function deleteInvoice(invoice: Invoice) {
    const page = previewPageRect(previewPane.current);
    onDelete(invoice);
    onOpenChange(false);
    if (!page || prefersReducedMotion()) return;
    setSent(true);
    setShred({ id: invoice.id, invoice, rect: page });
  }

  function sendInvoice(draft: Invoice) {
    if (!isReadyToSend(draft)) {
      startEditing(true);
      return;
    }
    flyOff(markSent(draft, today), previewPageRect(previewPane.current));
  }

  function startEditing(missingFields = false) {
    swapPanel(
      "forward",
      () => {
        setEditing(true);
        setShowMissing(missingFields);
      },
      () => {
        if (missingFields) editForm.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      },
    );
  }

  function stopEditing() {
    swapPanel("back", () => setEditing(false));
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        // Dismissing while editing backs out to the details instead of closing.
        if (sent) return;
        if (!nextOpen && editing) stopEditing();
        else onOpenChange(nextOpen);
      }}
      onOpenChangeComplete={(isOpen) => {
        if (isOpen) return;
        setEditing(false);
        setShowMissing(false);
        setSent(false);
      }}
    >
      <InvoiceSheetPopup focusPopup>
        {invoice && editing && (
          <InvoiceForm
            ref={editForm}
            editing={invoice}
            company={company}
            today={today}
            validateOnMount={showMissing}
            className={panelTransitionClassName}
            onDismiss={stopEditing}
            onSubmit={(updated, sentFrom) => {
              if (updated.status !== "Draft") flyOff(updated, sentFrom);
              else
                swapPanel("back", () => {
                  onSave(updated);
                  setEditing(false);
                });
            }}
          />
        )}
        {invoice && !editing && (
          <>
            <InvoiceDetails
              invoice={invoice}
              className={panelTransitionClassName}
              inert={sent}
              onEdit={() => startEditing()}
              onSend={() => sendInvoice(invoice)}
              onVoid={() => onVoid(markVoided(invoice))}
              onClose={() => onOpenChange(false)}
              onDelete={() => deleteInvoice(invoice)}
            />
            <PreviewPane
              ref={previewPane}
              pageClassName={sent ? "invisible" : undefined}
              onDismiss={() => {
                if (!sent) onOpenChange(false);
              }}
            >
              <InvoicePreview invoice={invoice} company={company} />
            </PreviewPane>
          </>
        )}
      </InvoiceSheetPopup>
      {flight && (
        <SentInvoiceFlight
          key={flight.id}
          flight={flight}
          company={company}
          onSent={onSend}
          onClose={() => onOpenChange(false)}
          onDone={endFlight}
        />
      )}
      {shred && <ShreddedInvoice key={shred.id} shred={shred} company={company} onDone={endShred} />}
    </Dialog.Root>
  );
}
