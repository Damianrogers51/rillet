import { twMerge } from "tailwind-merge";
import type { PaymentStatus } from "@/lib/invoices";

const statusLabels: Partial<Record<PaymentStatus, string>> = {
  Unsent: "Draft",
  Voided: "Void",
};

const statusTones: Record<PaymentStatus, string> = {
  Unsent: "bg-stone-900/[7%] text-stone-600/80",
  Open: "bg-blue-200/45 text-blue-700/80",
  Overdue: "bg-red-200/45 text-red-700/80",
  Paid: "bg-green-200/45 text-green-700/80",
  Voided: "bg-stone-200/45 text-stone-600/80",
};

export function StatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={twMerge("rounded-[4px] px-1.5 py-0.5 text-[12px] font-[450]", statusTones[status])}>
      {statusLabels[status] ?? status}
    </span>
  );
}
