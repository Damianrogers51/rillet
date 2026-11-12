"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { twMerge } from "tailwind-merge";

const iconFadeMs = 200;

/** A pill that only shows on hover, padded outward so the value stays aligned with its neighbors. */
export const copyPillClassName = twMerge(
  "-my-1 -mr-2 -ml-2.5 py-1 pr-2 pl-2.5",
  "text-secondary",
  "rounded-full",
  "transition-[scale,background-color,color] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
  "hover:bg-stone-900/[7%] hover:text-primary",
  "active:scale-95 active:bg-stone-900/10 active:duration-100 active:ease-out",
);

export function CopyButton({
  value,
  className = "",
  iconClassName,
  tabIndex,
}: {
  value: string;
  className?: string;
  iconClassName?: string;
  tabIndex?: number;
}) {
  // "leaving" keeps the check while a hover-only icon fades out, so it doesn't swap back to the copy icon mid-fade.
  const [phase, setPhase] = useState<"idle" | "copied" | "leaving">("idle");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const copied = phase !== "idle";

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  async function copy(event: MouseEvent) {
    event.stopPropagation();
    await navigator.clipboard.writeText(value);
    timers.current.forEach(clearTimeout);
    setPhase("copied");
    timers.current = [
      setTimeout(() => setPhase("leaving"), 1500),
      setTimeout(() => setPhase("idle"), 1500 + iconFadeMs),
    ];
  }

  return (
    <button
      type="button"
      onClick={copy}
      tabIndex={tabIndex}
      aria-label={copied ? `Copied ${value}` : `Copy ${value}`}
      className={twMerge("group/copy inline-flex cursor-pointer items-center gap-1", className)}
    >
      {value}
      <span
        className={twMerge(
          "grid -translate-y-[0.5px]",
          "text-stone-500",
          "transition-opacity duration-200 ease-out",
          "*:col-start-1 *:row-start-1 *:transition-[opacity,scale,filter] *:duration-200 *:ease-out",
          iconClassName,
          // Overrides hover-only icons, so the check stays after the pointer leaves the row.
          phase === "copied" && "opacity-100!",
        )}
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          aria-hidden
          className={`size-3.25 -translate-y-[0.5px] ${copied ? "scale-50 opacity-0 blur-[2px]" : "scale-100 opacity-100 blur-0"}`}
        >
          <path d="M6 3.5H5A1.5 1.5 0 0 0 3.5 5v7.5A1.5 1.5 0 0 0 5 14h6a1.5 1.5 0 0 0 1.5-1.5V5A1.5 1.5 0 0 0 11 3.5h-1" />
          <rect x="6" y="2" width="4" height="3" rx="1" />
        </svg>
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          aria-hidden
          className={`size-3.25 ${copied ? "scale-100 opacity-100 blur-0" : "scale-50 opacity-0 blur-[2px]"}`}
        >
          <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}
