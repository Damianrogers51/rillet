import type { ReactNode, RefObject } from "react";
import { Popover } from "@base-ui/react/popover";
import { twMerge } from "tailwind-merge";
import { Button } from "@/components/Button";

type ConfirmPopoverPopupProps = {
  title: ReactNode;
  description: ReactNode;
  confirmLabel: ReactNode;
  onConfirm: () => void;
  /** Positions against this element instead of the popover's trigger, for popovers opened from elsewhere. */
  anchor?: RefObject<HTMLElement | null>;
  finalFocus?: RefObject<HTMLElement | null>;
};

/**
 * A destructive confirmation that opens below and right-aligned to its anchor, with Keep and a red confirm button.
 * Goes inside a `Popover.Root`; use `ConfirmPopover` when a plain button should open it.
 */
export function ConfirmPopoverPopup({
  title,
  description,
  confirmLabel,
  onConfirm,
  anchor,
  finalFocus,
}: ConfirmPopoverPopupProps) {
  return (
    <Popover.Portal>
      <Popover.Positioner anchor={anchor} side="bottom" align="end" sideOffset={8} className="z-50">
        <Popover.Popup
          finalFocus={finalFocus}
          className={twMerge(
            "flex w-[20rem] origin-top-right flex-col gap-5 pt-3.5 pr-3 pb-3 pl-5",
            "rounded-[20px] bg-surface text-[13px] text-secondary shadow-lg ring-[0.5px] ring-stone-900/10 outline-none",
            "transition-[scale,opacity] duration-150 ease-out",
            "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
            "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
          )}
        >
          <div className="flex flex-col gap-1 pr-2">
            <Popover.Title className="font-[450] text-primary">{title}</Popover.Title>
            <Popover.Description className="leading-relaxed text-pretty">{description}</Popover.Description>
          </div>
          <div className="flex justify-end gap-2">
            <Popover.Close render={<Button variant="secondary" className="h-7.5 px-3" />}>Keep</Popover.Close>
            <Popover.Close
              render={<Button className="h-7.5 bg-red-600 px-3 text-white hover:bg-red-700" onClick={onConfirm} />}
            >
              {confirmLabel}
            </Popover.Close>
          </div>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  );
}

export function ConfirmPopover({
  triggerLabel,
  ...popup
}: Omit<ConfirmPopoverPopupProps, "anchor" | "finalFocus"> & { triggerLabel: ReactNode }) {
  return (
    <Popover.Root>
      <Popover.Trigger render={<Button variant="secondary" />}>{triggerLabel}</Popover.Trigger>
      <ConfirmPopoverPopup {...popup} />
    </Popover.Root>
  );
}
