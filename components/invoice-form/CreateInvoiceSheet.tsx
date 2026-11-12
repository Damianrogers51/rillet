"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/Button";
import { InvoiceForm } from "@/components/invoice-form/InvoiceForm";
import { InvoiceSheetPopup } from "@/components/InvoiceSheetLayout";
import { SentInvoiceFlight, type Flight } from "@/components/SentInvoiceFlight";
import type { Company, Invoice } from "@/lib/invoices";
const { Root: DialogRoot, Trigger: DialogTrigger } = Dialog;

type CreateInvoiceSheetProps = {
  company: Company;
  today: string;
  onCreate: (invoice: Invoice) => void;
};

export function CreateInvoiceSheet({ company, today, onCreate }: CreateInvoiceSheetProps) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [validationKey, setValidationKey] = useState(0);
  const [flight, setFlight] = useState<Flight | null>(null);
  const endFlight = useCallback(() => setFlight(null), []);
  const resetOnClose = useRef(false);
  const sending = useRef(false);
  const [createAnother, setCreateAnother] = useState(false);
  // Focuses the fresh form that replaces a submitted one while the drawer stays open.
  const [continuing, setContinuing] = useState(false);
  const keepOpenAfterSend = useRef(false);

  function startAnother() {
    setContinuing(true);
    setFormKey((key) => key + 1);
  }

  useEffect(() => {
    function openOnShortcut(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "c" || event.repeat || event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      if (document.querySelector("[role=dialog][data-open], [role=alertdialog][data-open]")) return;
      event.preventDefault();
      setOpen(true);
    }
    window.addEventListener("keydown", openOnShortcut);
    return () => window.removeEventListener("keydown", openOnShortcut);
  }, []);

  const closeAfterSend = useCallback(() => {
    sending.current = false;
    if (keepOpenAfterSend.current) {
      setContinuing(true);
      setFormKey((key) => key + 1);
    } else {
      setOpen(false);
    }
  }, []);

  return (
    <DialogRoot
      open={open}
      onOpenChange={(nextOpen) => {
        if (!sending.current) setOpen(nextOpen);
      }}
      onOpenChangeComplete={(isOpen) => {
        if (isOpen) return;
        setContinuing(false);
        setCreateAnother(false);
        if (resetOnClose.current) {
          resetOnClose.current = false;
          setFormKey((key) => key + 1);
        } else {
          setValidationKey((key) => key + 1);
        }
      }}
    >
      <DialogTrigger render={<Button aria-keyshortcuts="c" />}>Create Invoice</DialogTrigger>

      {/* Stays mounted while closed so dismissing keeps what was typed; a successful submit resets it. */}
      <InvoiceSheetPopup keepMounted>
        <InvoiceForm
          key={formKey}
          validationKey={validationKey}
          company={company}
          today={today}
          continuing={continuing}
          createAnother={createAnother}
          onCreateAnotherChange={setCreateAnother}
          onDismiss={() => setOpen(false)}
          onSubmit={(invoice, sentFrom) => {
            // The send animation adds the invoice once its mock send finishes, then closes the drawer or resets it.
            if (sentFrom) {
              sending.current = true;
              keepOpenAfterSend.current = createAnother;
              if (!createAnother) resetOnClose.current = true;
              setFlight({ id: invoice.id, invoice, rect: sentFrom, centered: !createAnother });
              return;
            }
            onCreate(invoice);
            if (createAnother) {
              startAnother();
            } else {
              resetOnClose.current = true;
              setOpen(false);
            }
          }}
        />
      </InvoiceSheetPopup>
      {flight && (
        <SentInvoiceFlight
          key={flight.id}
          flight={flight}
          company={company}
          onSent={onCreate}
          onClose={closeAfterSend}
          onDone={endFlight}
        />
      )}
    </DialogRoot>
  );
}
