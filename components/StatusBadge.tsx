"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { twMerge } from "tailwind-merge";
import type { PaymentStatus } from "@/lib/invoices";

const statusLabels: Partial<Record<PaymentStatus, string>> = {
  Unsent: "Draft",
  Voided: "Void",
};

type StatusTone = { tint: string; ring: string; text: string; dot: string; solid: string; border: string };

const statusTones: Record<PaymentStatus, StatusTone> = {
  Unsent: {
    tint: "bg-stone-900/[7%]",
    ring: "inset-ring-stone-600/10",
    text: "text-stone-600/80",
    dot: "bg-stone-400",
    solid: "bg-stone-500",
    border: "border-stone-400/60",
  },
  Open: {
    tint: "bg-blue-200/45",
    ring: "inset-ring-blue-700/10",
    text: "text-blue-700/80",
    dot: "bg-blue-500",
    solid: "bg-blue-600",
    border: "border-blue-600/40",
  },
  Overdue: {
    tint: "bg-red-200/45",
    ring: "inset-ring-red-700/10",
    text: "text-red-700/80",
    dot: "bg-red-500",
    solid: "bg-red-600",
    border: "border-red-600/40",
  },
  Paid: {
    tint: "bg-green-200/45",
    ring: "inset-ring-green-700/10",
    text: "text-green-700/80",
    dot: "bg-green-500",
    solid: "bg-green-600",
    border: "border-green-600/40",
  },
  Voided: {
    tint: "bg-stone-200/45",
    ring: "inset-ring-stone-600/10",
    text: "text-stone-600/80",
    dot: "bg-stone-300",
    solid: "bg-stone-400",
    border: "border-stone-300",
  },
};

const statusIconPaths: Record<PaymentStatus, ReactNode> = {
  Unsent: <circle cx="8" cy="8" r="5" strokeDasharray="2.2 1.8" />,
  Open: <circle cx="8" cy="8" r="5" />,
  Overdue: (
    <>
      <circle cx="8" cy="8" r="5" />
      <path d="M8 5.5V8l1.5 1.25" />
    </>
  ),
  Paid: (
    <>
      <circle cx="8" cy="8" r="5" />
      <path d="M5.75 8.25l1.5 1.5 3-3.25" />
    </>
  ),
  Voided: (
    <>
      <circle cx="8" cy="8" r="5" />
      <path d="M4.5 11.5l7-7" />
    </>
  ),
};

function StatusIcon({ status }: { status: PaymentStatus }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="size-3.5 shrink-0"
    >
      {statusIconPaths[status]}
    </svg>
  );
}

function Dot({ className }: { className: string }) {
  return <span aria-hidden className={twMerge("size-1.5 shrink-0 rounded-full", className)} />;
}

export const badgeVariants: { name: string; render: (status: PaymentStatus, label: string) => ReactNode }[] = [
  {
    name: "Tinted pill",
    render: (status, label) => {
      const tone = statusTones[status];
      return (
        <span className={twMerge("rounded-lg px-2 py-1 inset-ring-[0.5px]", tone.tint, tone.ring, tone.text)}>
          {label}
        </span>
      );
    },
  },
  {
    name: "Dot and text",
    render: (status, label) => (
      <span className="inline-flex items-center gap-2 text-secondary">
        <Dot className={statusTones[status].dot} />
        {label}
      </span>
    ),
  },
  {
    name: "Neutral pill with dot",
    render: (status, label) => (
      <span
        className={twMerge(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-secondary",
          "bg-surface inset-ring-[0.5px] inset-ring-stone-900/10",
        )}
      >
        <Dot className={statusTones[status].dot} />
        {label}
      </span>
    ),
  },
  {
    name: "Outline",
    render: (status, label) => {
      const tone = statusTones[status];
      return (
        <span className={twMerge("rounded-full border-[0.5px] px-2.5 py-[3px]", tone.border, tone.text)}>{label}</span>
      );
    },
  },
  {
    name: "Solid",
    render: (status, label) => (
      <span className={twMerge("rounded-md px-2 py-1 text-[13px] text-white", statusTones[status].solid)}>{label}</span>
    ),
  },
  {
    name: "Colored text",
    render: (status, label) => <span className={twMerge("font-[450]", statusTones[status].text)}>{label}</span>,
  },
  {
    name: "Soft square",
    render: (status, label) => {
      const tone = statusTones[status];
      return (
        <span className={twMerge("rounded-[4px] px-1.5 py-0.5 text-[12px] font-[450]", tone.tint, tone.text)}>
          {label}
        </span>
      );
    },
  },
  {
    name: "Small caps",
    render: (status, label) => {
      const tone = statusTones[status];
      return (
        <span
          className={twMerge(
            "rounded-md px-1.5 py-1 text-[10.5px] font-medium tracking-[0.06em] uppercase",
            tone.tint,
            tone.text,
          )}
        >
          {label}
        </span>
      );
    },
  },
  {
    name: "Icon and text",
    render: (status, label) => (
      <span className="inline-flex items-center gap-1.5 text-secondary">
        <span className={statusTones[status].text}>
          <StatusIcon status={status} />
        </span>
        {label}
      </span>
    ),
  },
  {
    name: "Side bar",
    render: (status, label) => (
      <span className="inline-flex items-center gap-2 text-secondary">
        <span aria-hidden className={twMerge("h-3.5 w-[3px] shrink-0 rounded-full", statusTones[status].dot)} />
        {label}
      </span>
    ),
  },
];

const defaultVariant = badgeVariants.findIndex((variant) => variant.name === "Soft square");
let currentVariant = defaultVariant;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBadgeVariant() {
  return useSyncExternalStore(
    subscribe,
    () => currentVariant,
    () => defaultVariant,
  );
}

export function setBadgeVariant(index: number) {
  currentVariant = (index + badgeVariants.length) % badgeVariants.length;
  listeners.forEach((listener) => listener());
}

export function StatusBadge({ status }: { status: PaymentStatus }) {
  const variant = useBadgeVariant();
  return badgeVariants[variant].render(status, statusLabels[status] ?? status);
}
