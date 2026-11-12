import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { InvoicePreview } from "@/components/InvoicePreview";
import { PreviewPage } from "@/components/PreviewPage";
import { splitViewQuery } from "@/components/InvoiceSheetLayout";
import type { Company, Invoice } from "@/lib/invoices";

/** `centered` moves the invoice to the middle of the screen before it flies, for when the drawer closes behind it. */
export type Flight = { id: string; invoice: Invoice; rect: DOMRect; centered: boolean };

// Without the preview on screen the invoice has nothing to start from, so it grows in before the ring starts.
const enterDuration = 320;
const overlayDuration = 150;
// Stands in for the request to send or save the invoice; a ring over the invoice fills until it resolves.
const mockSendDuration = 500;
const checkDuration = 200;
// Long enough to register the check before the drawer closes and the invoice shrinks away.
const shrinkAt = mockSendDuration + checkDuration + 100;
const shrinkDuration = 280;
// Lifts off while the shrink is still settling so the two read as one motion.
const flyAt = shrinkAt + 120;
const flyDuration = 420;

/**
 * Covers a copy of the invoice with a progress ring while it "sends" and draws a check once it has. Then it calls
 * `onClose` so the drawer leaves while the invoice shrinks and then flies off the top of the screen, or the bottom for
 * a draft.
 */
export function SentInvoiceFlight({
  flight,
  company,
  onSent,
  onClose,
  onDone,
}: {
  flight: Flight;
  company: Company;
  onSent: (invoice: Invoice) => void;
  onClose: () => void;
  onDone: () => void;
}) {
  const callbacks = useRef({ onSent, onClose });
  useEffect(() => {
    callbacks.current = { onSent, onClose };
  });
  const statusRef = useRef<HTMLSpanElement>(null);
  const positionRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const checkRef = useRef<SVGPathElement>(null);
  const { rect, invoice, centered } = flight;
  const draft = invoice.status === "Draft";

  useEffect(() => {
    const position = positionRef.current;
    const page = pageRef.current;
    const content = contentRef.current;
    const overlay = overlayRef.current;
    const ring = ringRef.current;
    const check = checkRef.current;
    if (!position || !page || !content || !overlay || !ring || !check) return;
    const entering = !splitViewQuery().matches;
    const start = entering ? enterDuration : 0;

    const sent = setTimeout(() => {
      callbacks.current.onSent(invoice);
      if (statusRef.current) {
        statusRef.current.textContent = draft ? "Draft saved" : `Invoice sent to ${invoice.customerName}`;
      }
    }, start + mockSendDuration);
    const closing = setTimeout(() => callbacks.current.onClose(), start + shrinkAt);

    const appearing = position.animate(
      [
        { opacity: 0, scale: 0.92 },
        { opacity: 1, scale: 1 },
      ],
      { duration: entering ? enterDuration : 0, easing: "cubic-bezier(0.32, 0.72, 0, 1)", fill: "backwards" },
    );

    // When it grows in, it arrives already covered and blurred, ready for the ring.
    const covering = overlay.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: entering ? 0 : overlayDuration,
      easing: "ease-out",
      fill: "both",
    });
    // Blurring the page itself rather than using a backdrop filter keeps it cheap to move once it flies.
    const blurring = content.animate([{ filter: "blur(0)" }, { filter: "blur(2px)" }], {
      duration: entering ? 0 : overlayDuration,
      easing: "ease-out",
      fill: "both",
    });
    const filling = ring.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
      duration: mockSendDuration,
      delay: start,
      easing: "cubic-bezier(0.3, 0.5, 0.5, 1)",
      fill: "both",
    });
    const succeeding = ring.animate([{ stroke: "rgb(28 25 23 / 0.45)" }, { stroke: "var(--color-emerald-600)" }], {
      duration: checkDuration,
      delay: start + mockSendDuration,
      fill: "both",
    });
    const checking = check.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
      duration: checkDuration,
      delay: start + mockSendDuration,
      easing: "cubic-bezier(0.65, 0, 0.35, 1)",
      fill: "both",
    });
    const centerX = centered ? window.innerWidth / 2 - (rect.left + rect.width / 2) : 0;
    const centerY = centered ? window.innerHeight / 2 - (rect.top + rect.height / 2) : 0;
    const centering = position.animate([{ translate: "0 0" }, { translate: `${centerX}px ${centerY}px` }], {
      duration: shrinkDuration,
      delay: start + shrinkAt,
      easing: "cubic-bezier(0.32, 0.72, 0, 1)",
      fill: "forwards",
    });
    const shrinking = page.animate([{ scale: 1 }, { scale: 0.6 }], {
      duration: shrinkDuration,
      delay: start + shrinkAt,
      easing: "cubic-bezier(0.32, 0.72, 0, 1)",
      fill: "forwards",
    });
    // Sent invoices fly off the top; drafts drop off the bottom, staying behind.
    const exitY = draft ? window.innerHeight - (rect.top + centerY) + 40 : -(rect.bottom + centerY + 40);
    const rising = page.animate([{ translate: "0 0" }, { translate: `0 ${exitY}px` }], {
      duration: flyDuration,
      delay: start + flyAt,
      easing: "cubic-bezier(0.5, 0, 0.75, 0)",
      fill: "forwards",
    });
    // Every part of the flight starts from rest. The drift eases in and out while the rise keeps accelerating, which
    // bends the path into a slight arc toward a random side. The page leans with its direction of travel: against the
    // drift on the way up, into it on the way down.
    const side = Math.random() < 0.5 ? -1 : 1;
    const drift = side * (3 + Math.random() * 5);
    const tilt = (draft ? side : -side) * (4 + Math.random() * 6);
    const drifting = page.animate([{ transform: "translateX(0)" }, { transform: `translateX(${drift}rem)` }], {
      duration: flyDuration,
      delay: start + flyAt,
      easing: "cubic-bezier(0.45, 0, 0.55, 1)",
      fill: "forwards",
    });
    const tilting = page.animate([{ rotate: "0deg" }, { rotate: `${tilt}deg` }], {
      duration: flyDuration,
      delay: start + flyAt,
      easing: "cubic-bezier(0.45, 0, 0.55, 1)",
      fill: "forwards",
    });
    rising.finished.then(onDone, () => {});

    const animations = [
      appearing,
      covering,
      blurring,
      filling,
      succeeding,
      checking,
      centering,
      shrinking,
      rising,
      drifting,
      tilting,
    ];
    return () => {
      clearTimeout(sent);
      clearTimeout(closing);
      animations.forEach((animation) => animation.cancel());
    };
  }, [rect, invoice, centered, draft, onDone]);

  return createPortal(
    <>
      <span ref={statusRef} role="status" className="sr-only">
        {draft ? "Saving draft" : "Sending invoice"}
      </span>
      <div
        ref={positionRef}
        aria-hidden
        className="pointer-events-none fixed z-[100] will-change-transform"
        style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
      >
        <div ref={pageRef} className="absolute inset-0 will-change-transform">
          <PreviewPage className="w-full">
            <div ref={contentRef} className="flex grow flex-col">
              <InvoicePreview invoice={invoice} company={company} />
            </div>
          </PreviewPage>
          <div ref={overlayRef} className="absolute inset-0 flex items-center justify-center bg-surface/70">
            {/* pathLength={1} lets the ring and check animate their dash offset from 1 to 0 regardless of size. */}
            <svg viewBox="0 0 48 48" fill="none" className="size-14">
              <circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="2.5" className="text-stone-900/[8%]" />
              <circle
                ref={ringRef}
                cx="24"
                cy="24"
                r="21"
                stroke="rgb(28 25 23 / 0.45)"
                strokeWidth="2.5"
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray="1 1"
                strokeDashoffset={1}
                transform="rotate(-90 24 24)"
              />
              <path
                ref={checkRef}
                d="M15.5 24.5l6 6 11-12"
                stroke="var(--color-emerald-600)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                strokeDasharray="1 1"
                strokeDashoffset={1}
              />
            </svg>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
