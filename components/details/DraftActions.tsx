"use client";

import { useRef, useState } from "react";
import { Menu } from "@base-ui/react/menu";
import { Popover } from "@base-ui/react/popover";
import { twMerge } from "tailwind-merge";
import { Button } from "@/components/Button";
import { ConfirmPopoverPopup } from "@/components/ConfirmPopover";
import type { Invoice } from "@/lib/invoices";

export function deleteConfirmation(invoice: Invoice) {
  const noun = invoice.paymentStatus === "Unsent" ? "draft" : "invoice";
  return {
    title: `Delete this ${noun}?`,
    description: `This ${noun} will be removed. This action can’t be undone.`,
    confirmLabel: "Delete",
  };
}

const chevronDownPath = "M4.5 6.5L8 10l3.5-3.5";

/** Edit Draft with a split-off chevron that opens a menu of the draft's other actions. */
export function EditDraftButton({
  invoice,
  onEdit,
  onDelete,
}: {
  invoice: Invoice;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div ref={groupRef} data-press-group className="flex">
      <Button onClick={onEdit} className="rounded-r-none pr-3.5">
        Edit Draft
      </Button>
      <Menu.Root>
        <Menu.Trigger
          ref={menuTriggerRef}
          aria-label="More draft actions"
          render={
            <Button
              squish={false}
              className="flex items-center rounded-l-none border-l-[0.5px] border-stone-100/25 pr-2.5 pl-2"
            />
          }
        >
          <svg viewBox="0 0 16 16" fill="none" aria-hidden className="size-3.5">
            <path
              d={chevronDownPath}
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
            <Menu.Popup
              className={twMerge(
                "flex min-w-40 origin-top-right flex-col p-1",
                "rounded-[20px] bg-surface text-[13px] shadow-lg ring-[0.5px] ring-stone-900/10 outline-none",
                "transition-[scale,opacity] duration-150 ease-out",
                "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
                "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
              )}
            >
              <Menu.Item
                onClick={() => setConfirmingDelete(true)}
                className={twMerge(
                  "flex h-8 cursor-pointer items-center rounded-full px-3.5 text-red-700 outline-none select-none",
                  "data-[highlighted]:bg-red-600/[7%]",
                )}
              >
                Delete Draft
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <Popover.Root open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <ConfirmPopoverPopup
          {...deleteConfirmation(invoice)}
          onConfirm={onDelete}
          anchor={groupRef}
          finalFocus={menuTriggerRef}
        />
      </Popover.Root>
    </div>
  );
}
