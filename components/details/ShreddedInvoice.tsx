import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { InvoicePreview } from "@/components/InvoicePreview";
import { PreviewPage } from "@/components/PreviewPage";
import { splitViewQuery } from "@/components/InvoiceSheetLayout";
import type { Company, Invoice } from "@/lib/invoices";

export type Shred = { id: string; invoice: Invoice; rect: DOMRect };

const stripCount = 14;
// Without the preview on screen the invoice has nothing to start from, so it grows in where it's cut instead of moving
// there from the preview.
const enterDuration = 320;
const centerDuration = 320;
const centeredScale = 0.7;
const cutDelay = 60;
const cutDuration = 220;
const fallDelay = 60;
const fallDuration = 700;
// Each strip waits up to this long before falling, so they tumble away one by one rather than as a block.
const fallStagger = 160;
// Strips cycle through this many differently seeded warps, so neighbors don't bend in step.
const warpCount = 4;
const warpScale = 26;

/**
 * Moves a copy of the invoice to the middle of the screen (or grows it in there on narrow screens), cuts it into vertical strips that pull apart and curl, then
 * drops the strips off the bottom of the screen.
 */
export function ShreddedInvoice({ shred, company, onDone }: { shred: Shred; company: Company; onDone: () => void }) {
  const positionRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const stripRefs = useRef<(HTMLDivElement | null)[]>([]);
  const warpRefs = useRef<(SVGFEDisplacementMapElement | null)[]>([]);
  const warpId = useId();
  const { rect, invoice } = shred;

  useEffect(() => {
    const position = positionRef.current;
    const page = pageRef.current;
    const strips = stripRefs.current.filter((strip) => strip !== null);
    const warps = warpRefs.current.filter((warp) => warp !== null);
    if (!position || !page) return;
    const entering = !splitViewQuery().matches;
    const scale = entering ? 1 : centeredScale;
    const cutAt = (entering ? enterDuration : centerDuration) + cutDelay;
    const fallAt = cutAt + cutDuration + fallDelay;

    const placing = entering
      ? [
          position.animate(
            [
              { opacity: 0, scale: 0.92 },
              { opacity: 1, scale: 1 },
            ],
            { duration: enterDuration, easing: "cubic-bezier(0.32, 0.72, 0, 1)", fill: "backwards" },
          ),
        ]
      : [
          position.animate(
            [
              { translate: "0 0" },
              {
                translate: `${window.innerWidth / 2 - (rect.left + rect.width / 2)}px ${window.innerHeight / 2 - (rect.top + rect.height / 2)}px`,
              },
            ],
            { duration: centerDuration, easing: "cubic-bezier(0.32, 0.72, 0, 1)", fill: "forwards" },
          ),
          page.animate([{ scale: 1 }, { scale: centeredScale }], {
            duration: centerDuration,
            easing: "cubic-bezier(0.32, 0.72, 0, 1)",
            fill: "forwards",
          }),
        ];

    // SVG filter attributes can't be animated with the Web Animations API, so the warp grows in frame by frame.
    let warpFrame = 0;
    const warpStart = performance.now() + cutAt;
    const growWarp = (now: number) => {
      const progress = Math.min(Math.max((now - warpStart) / cutDuration, 0), 1);
      const eased = 1 - (1 - progress) ** 3;
      for (const warp of warps) warp.setAttribute("scale", String(eased * warpScale));
      if (progress < 1) warpFrame = requestAnimationFrame(growWarp);
    };
    warpFrame = requestAnimationFrame(growWarp);

    // Strips sit inside the scaled page, so distances are divided by its scale to land in screen pixels.
    const fallDistance = (window.innerHeight / 2 + (rect.height * scale) / 2 + 60) / scale;
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
      const tilt = (Math.random() - 0.5) * 24;
      const sway = (Math.random() - 0.5) * 40;
      // Twisting around the strip's long axis narrows it like paper curling over, and the tip pitches back as it drops.
      const twist = (Math.random() < 0.5 ? -1 : 1) * (35 + Math.random() * 35);
      const pitch = 15 + Math.random() * 25;
      const falling = strip.animate(
        [
          { transform: "perspective(900px) translate(0, 0) rotate(0deg) rotateY(0deg) rotateX(0deg)", opacity: 1 },
          {
            transform: `perspective(900px) translate(${sway * 0.3}px, ${fallDistance * 0.25}px) rotate(${tilt * 0.4}deg) rotateY(${twist * 0.6}deg) rotateX(${pitch * 0.5}deg)`,
            opacity: 1,
            offset: 0.4,
          },
          { opacity: 1, offset: 0.7 },
          {
            transform: `perspective(900px) translate(${sway}px, ${fallDistance}px) rotate(${tilt}deg) rotateY(${twist}deg) rotateX(${pitch}deg)`,
            opacity: 0,
          },
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

    const animations = [...placing, ...stripAnimations];
    Promise.all(animations.map((animation) => animation.finished)).then(onDone, () => {});
    return () => {
      cancelAnimationFrame(warpFrame);
      animations.forEach((animation) => animation.cancel());
    };
  }, [rect, onDone]);

  const stripWidth = 100 / stripCount;
  return createPortal(
    <>
      <span role="status" className="sr-only">
        Invoice deleted
      </span>
      <svg aria-hidden className="absolute size-0">
        <defs>
          {Array.from({ length: warpCount }, (_, index) => (
            <filter key={index} id={`${warpId}-${index}`} x="-10%" y="-5%" width="120%" height="110%">
              {/* Barely varies across a strip's width but rolls along its length, so each strip bends side to side. */}
              <feTurbulence type="fractalNoise" baseFrequency="0.0015 0.006" numOctaves="2" seed={index * 7 + 3} />
              <feDisplacementMap
                ref={(warp) => {
                  warpRefs.current[index] = warp;
                }}
                in="SourceGraphic"
                scale="0"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          ))}
        </defs>
      </svg>
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
              className="absolute inset-0 will-change-transform"
              style={{
                filter: `url(#${CSS.escape(`${warpId}-${index % warpCount}`)})`,
                transformOrigin: `${(index + 0.5) * stripWidth}% 0`,
              }}
            >
              {/* Clipped inside the warped element, so the warp bends the strip's cut edges too. */}
              <div
                className="absolute inset-0 flex"
                style={{ clipPath: `inset(0 ${100 - (index + 1) * stripWidth}% 0 ${index * stripWidth}%)` }}
              >
                <PreviewPage className="w-full shadow-none">
                  <InvoicePreview invoice={invoice} company={company} />
                </PreviewPage>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>,
    document.body,
  );
}
