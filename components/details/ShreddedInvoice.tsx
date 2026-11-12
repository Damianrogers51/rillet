import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { InvoicePreview } from "@/components/InvoicePreview";
import { PreviewPage } from "@/components/PreviewPage";
import type { Company, Invoice } from "@/lib/invoices";

export type Shred = { id: string; invoice: Invoice; rect: DOMRect };

const stripCount = 14;
const centerDuration = 320;
const centeredScale = 0.7;
const cutAt = centerDuration + 60;
const cutDuration = 220;
const fallAt = cutAt + cutDuration + 60;
const fallDuration = 700;
// Each strip waits up to this long before falling, so they tumble away one by one rather than as a block.
const fallStagger = 160;

/**
 * Moves a copy of the invoice to the middle of the screen, cuts it into vertical strips that pull apart, then drops
 * the strips off the bottom of the screen.
 */
export function ShreddedInvoice({ shred, company, onDone }: { shred: Shred; company: Company; onDone: () => void }) {
  const positionRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const stripRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { rect, invoice } = shred;

  useEffect(() => {
    const position = positionRef.current;
    const page = pageRef.current;
    const strips = stripRefs.current.filter((strip) => strip !== null);
    if (!position || !page) return;

    const centerX = window.innerWidth / 2 - (rect.left + rect.width / 2);
    const centerY = window.innerHeight / 2 - (rect.top + rect.height / 2);
    const centering = position.animate([{ translate: "0 0" }, { translate: `${centerX}px ${centerY}px` }], {
      duration: centerDuration,
      easing: "cubic-bezier(0.32, 0.72, 0, 1)",
      fill: "forwards",
    });
    const shrinking = page.animate([{ scale: 1 }, { scale: centeredScale }], {
      duration: centerDuration,
      easing: "cubic-bezier(0.32, 0.72, 0, 1)",
      fill: "forwards",
    });

    // Strips sit inside the scaled page, so distances are divided by its scale to land in screen pixels.
    const fallDistance = (window.innerHeight / 2 + (rect.height * centeredScale) / 2 + 60) / centeredScale;
    const middle = (strips.length - 1) / 2;
    const stripAnimations = strips.flatMap((strip, index) => {
      const spread = (index - middle) * 3;
      const jolt = (Math.random() - 0.5) * 10;
      const cutting = strip.animate([{ translate: "0 0" }, { translate: `${spread}px ${jolt}px` }], {
        duration: cutDuration,
        delay: cutAt + Math.random() * 60,
        easing: "cubic-bezier(0.2, 0.7, 0.3, 1)",
        fill: "forwards",
      });
      const tilt = (Math.random() - 0.5) * 16;
      const sway = (Math.random() - 0.5) * 40;
      const falling = strip.animate(
        [
          { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
          { opacity: 1, offset: 0.7 },
          { transform: `translate(${sway}px, ${fallDistance}px) rotate(${tilt}deg)`, opacity: 0 },
        ],
        {
          duration: fallDuration * (0.85 + Math.random() * 0.3),
          delay: fallAt + Math.random() * fallStagger,
          easing: "cubic-bezier(0.45, 0, 0.8, 0.4)",
          fill: "forwards",
        },
      );
      return [cutting, falling];
    });

    const animations = [centering, shrinking, ...stripAnimations];
    Promise.all(animations.map((animation) => animation.finished)).then(onDone, () => {});
    return () => animations.forEach((animation) => animation.cancel());
  }, [rect, onDone]);

  const stripWidth = 100 / stripCount;
  return createPortal(
    <>
      <span role="status" className="sr-only">
        Invoice deleted
      </span>
      <div
        ref={positionRef}
        aria-hidden
        className="pointer-events-none fixed z-[100] will-change-transform"
        style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
      >
        {/* The shadow lives on the container because each strip's clip-path would cut off its own. */}
        <div
          ref={pageRef}
          className="absolute inset-0 drop-shadow-[0_10px_20px_rgb(28_25_23/0.18)] will-change-transform"
        >
          {Array.from({ length: stripCount }, (_, index) => (
            <div
              key={index}
              ref={(strip) => {
                stripRefs.current[index] = strip;
              }}
              className="absolute inset-0 flex will-change-transform"
              style={{ clipPath: `inset(0 ${100 - (index + 1) * stripWidth}% 0 ${index * stripWidth}%)` }}
            >
              <PreviewPage className="w-full shadow-none">
                <InvoicePreview invoice={invoice} company={company} />
              </PreviewPage>
            </div>
          ))}
        </div>
      </div>
    </>,
    document.body,
  );
}
