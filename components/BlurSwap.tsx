"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { prefersReducedMotion } from "@/lib/motion";

const blurOutDuration = 180;
const blurInDuration = 260;
const resizeDuration = 320;

type BlurSwapProps<T extends string> = {
  value: T;
  animate: boolean;
  className?: string;
  children: (value: T) => ReactNode;
};

/** Blurs the old content out, swaps it for the new value's content, then blurs that in. */
export function BlurSwap<T extends string>({ value, animate, className, children }: BlurSwapProps<T>) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);
  const widthBeforeSwap = useRef<number | null>(null);
  if (shown !== value && !animate) setShown(value);

  useEffect(() => {
    const element = ref.current;
    if (shown === value || !animate || !element) return;
    const blurringOut = element.animate(
      [
        { opacity: 1, filter: "blur(0)" },
        { opacity: 0, filter: "blur(4px)" },
      ],
      {
        duration: prefersReducedMotion() ? 0 : blurOutDuration,
        easing: "ease-in",
        fill: "forwards",
      },
    );
    blurringOut.finished.then(
      () => {
        widthBeforeSwap.current = element.getBoundingClientRect().width;
        setShown(value);
      },
      () => {},
    );
    return () => blurringOut.cancel();
  }, [shown, value, animate]);

  useLayoutEffect(() => {
    const element = ref.current;
    const fromWidth = widthBeforeSwap.current;
    if (fromWidth === null || !element) return;
    widthBeforeSwap.current = null;
    element.getAnimations().forEach((animation) => animation.cancel());
    if (prefersReducedMotion()) return;
    element.animate(
      [
        { opacity: 0, filter: "blur(4px)" },
        { opacity: 1, filter: "blur(0)" },
      ],
      {
        duration: blurInDuration,
        easing: "ease-out",
      },
    );
    // Clipped on the right so wider new content doesn't spill over its neighbours while the width catches up.
    const clipPath = "inset(-0.5em 0 -0.5em -0.5em)";
    element.animate(
      [
        { width: `${fromWidth}px`, clipPath },
        { width: `${element.getBoundingClientRect().width}px`, clipPath },
      ],
      {
        duration: resizeDuration,
        easing: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
    );
  }, [shown]);

  return (
    <span ref={ref} className={className}>
      {children(shown)}
    </span>
  );
}
