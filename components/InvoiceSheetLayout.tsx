"use client";

import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { flushSync } from "react-dom";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/Button";
import { PreviewPage } from "@/components/PreviewPage";
import { prefersReducedMotion } from "@/lib/motion";
import { twMerge } from "tailwind-merge";

const {
  Root: DialogRoot,
  Trigger: DialogTrigger,
  Portal: DialogPortal,
  Backdrop: DialogBackdrop,
  Popup: DialogPopup,
  Title: DialogTitle,
} = Dialog;

/** Full-screen popup holding a side panel on the left and, on wide screens, the invoice preview on the right. */
export function InvoiceSheetPopup({
  keepMounted,
  focusPopup,
  children,
}: {
  keepMounted?: boolean;
  /** Focuses the popup itself on open instead of its first button, for sheets that open on a read-only view. */
  focusPopup?: boolean;
  children: ReactNode;
}) {
  const popup = useRef<HTMLDivElement>(null);
  return (
    <DialogPortal keepMounted={keepMounted}>
      <DialogBackdrop
        className={twMerge(
          "fixed inset-0 z-20",
          "bg-stone-900/30",
          "transition-opacity duration-300",
          "data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
        )}
      />

      <DialogPopup
        ref={popup}
        initialFocus={focusPopup ? popup : undefined}
        className={twMerge(
          // Above the table's scroll shadows, which sit on their own layer.
          "group fixed inset-0 z-20 flex",
          "text-[13px]",
          "text-secondary outline-none",
          "transition-opacity duration-300",
          "data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
        )}
      >
        {children}
      </DialogPopup>
    </DialogPortal>
  );
}

export const sidePanelClassName = twMerge(
  "relative z-10 flex shrink-0 flex-col",
  "h-full w-full preview:w-[clamp(520px,45vw,620px)]",
  // Keeps content near the side-by-side width when the panel fills a wide screen.
  "[--form-px:max(2rem,calc((100%-40rem)/2))]",
  "bg-surface ring-[0.5px] ring-stone-900/10",
  "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
  "group-data-[ending-style]:-translate-x-full",
  "group-data-[starting-style]:-translate-x-full",
);

const dismissIcons = {
  back: <path d="M12.5 8h-9M7.5 4L3.5 8l4 4" />,
  close: <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />,
};

function DismissIcon({ kind }: { kind: keyof typeof dismissIcons }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="size-3.5"
    >
      {dismissIcons[kind]}
    </svg>
  );
}

export function PanelBackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="tertiary"
      aria-label="Back"
      className="flex size-8.5 items-center justify-center px-0"
      onClick={onClick}
    >
      <DismissIcon kind="back" />
    </Button>
  );
}

export function PanelCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="tertiary"
      aria-label="Close"
      className="flex size-8.5 items-center justify-center px-0"
      onClick={onClick}
    >
      <DismissIcon kind="close" />
    </Button>
  );
}

export const sidePanelBodyClassName =
  "scrollbar-subtle flex flex-1 flex-col gap-13 overflow-y-auto bg-background px-(--form-px) pt-8 pb-8";

export const sidePanelFooterClassName = twMerge(
  "relative z-10 flex items-center gap-2",
  "px-(--form-px) py-6",
  "border-t-[0.5px] border-stone-200 shadow-edge-t",
);

type SidePanelHeaderProps = { title: ReactNode; subtitle?: ReactNode; actions: ReactNode };

export function SidePanelHeader({ title, subtitle, actions }: SidePanelHeaderProps) {
  return (
    <header
      className={twMerge(
        "relative z-10 flex items-start justify-between gap-4",
        "px-(--form-px) pt-8 pb-8",
        "border-b-[0.5px] border-stone-200 shadow-edge-b",
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <DialogTitle className="text-[24px] leading-none font-[450] text-primary">{title}</DialogTitle>
        {subtitle && <div className="mt-0.5 flex items-center gap-2.5">{subtitle}</div>}
      </div>

      {/* Centers the buttons on the title line: half the difference between their height and the title's. */}
      <div className="-my-[5px] flex shrink-0 items-center gap-2">{actions}</div>
    </header>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-[16px] font-[450] text-primary">{title}</h3>
        {/* Negative margin keeps a button-height action from pushing the header taller than the other sections. */}
        {action && <div className="-my-1">{action}</div>}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

type PreviewPaneProps = {
  ref?: Ref<HTMLDivElement>;
  pageClassName?: string;
  onDismiss: () => void;
  children: ReactNode;
};

/** The preview beside the side panel on wide screens; clicking around the page dismisses the popup. */
export function PreviewPane({ ref, pageClassName, onDismiss, children }: PreviewPaneProps) {
  return (
    <div
      ref={ref}
      className="scrollbar-subtle hidden min-w-0 flex-1 overflow-y-auto p-6 preview:flex xl:p-10"
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      <PreviewPage
        className={twMerge(
          "w-full max-w-[min(680px,calc((100dvh-3rem)*8.5/11))] xl:max-w-[min(680px,calc((100dvh-5rem)*8.5/11))]",
          "group-data-[ending-style]:translate-y-3 group-data-[ending-style]:scale-[0.98]",
          "group-data-[starting-style]:translate-y-3 group-data-[starting-style]:scale-[0.98]",
          pageClassName,
        )}
      >
        {children}
      </PreviewPage>
    </div>
  );
}

/** Matches screens wide enough to show the preview beside the side panel. */
export function splitViewQuery() {
  const breakpoint = getComputedStyle(document.documentElement).getPropertyValue("--breakpoint-preview") || "1024px";
  return window.matchMedia(`(min-width: ${breakpoint})`);
}

/**
 * Where the preview page sits on screen, for the send and delete animations to start from. On narrow screens the pane
 * is hidden, so they start from a page-shaped area in the middle of the screen instead.
 */
export function previewPageRect(pane: HTMLElement | null) {
  const rect = pane?.firstElementChild?.getBoundingClientRect();
  if (rect?.width) return rect;
  const margin = 32;
  const width = Math.min(window.innerWidth - margin * 2, 420, ((window.innerHeight - margin * 2) * 8.5) / 11);
  const height = (width * 11) / 8.5;
  return new DOMRect((window.innerWidth - width) / 2, (window.innerHeight - height) / 2, width, height);
}

// Only one rendered element may carry a view-transition name, so the create sheet's panel doesn't get one.
export const panelTransitionClassName = "[view-transition-name:invoice-panel]";

/**
 * Swaps the side panel with the old one sliding out as the new one slides in, in the given direction. `onSwapped` runs
 * once the new panel is in place, since focus can't move into it while the transition is still running.
 */
export function swapPanel(direction: "forward" | "back", update: () => void, onSwapped?: () => void) {
  if (!document.startViewTransition || prefersReducedMotion()) {
    flushSync(update);
    onSwapped?.();
    return;
  }
  const root = document.documentElement;
  root.dataset.panelSwap = direction;
  const transition = document.startViewTransition(() => flushSync(update));
  transition.finished.finally(() => {
    delete root.dataset.panelSwap;
    onSwapped?.();
  });
}

/** Opens the preview in its own dialog on screens too narrow to show it beside the side panel. */
export function ShowPreviewButton({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [closesInstantly, setClosesInstantly] = useState(false);

  useEffect(() => {
    const splitView = splitViewQuery();
    function closeForSplitView() {
      if (!splitView.matches) return;
      setClosesInstantly(true);
      setOpen(false);
    }
    splitView.addEventListener("change", closeForSplitView);
    return () => splitView.removeEventListener("change", closeForSplitView);
  }, []);

  return (
    <DialogRoot
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setClosesInstantly(false);
        setOpen(nextOpen);
      }}
    >
      <DialogTrigger render={<Button variant="secondary" className="preview:hidden" />}>Show Preview</DialogTrigger>
      <DialogPortal>
        <DialogPopup
          aria-label="Invoice preview"
          className={twMerge(
            "group/preview fixed inset-0 z-20 flex",
            "overflow-y-auto bg-stone-900/30 p-4 outline-none sm:p-8",
            "transition-opacity duration-200",
            "data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
            closesInstantly && "transition-none *:transition-none",
          )}
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <PreviewPage
            className={twMerge(
              "w-full max-w-[min(680px,calc((100dvh-4rem)*8.5/11))]",
              "group-data-[ending-style]/preview:translate-y-3 group-data-[ending-style]/preview:scale-[0.98]",
              "group-data-[starting-style]/preview:translate-y-3 group-data-[starting-style]/preview:scale-[0.98]",
            )}
          >
            {children}
          </PreviewPage>
        </DialogPopup>
      </DialogPortal>
    </DialogRoot>
  );
}
