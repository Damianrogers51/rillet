import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";

type ButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "tertiary";
  /** Whether pressing squishes the button. */
  squish?: boolean;
};

const variantClassNames = {
  primary: twMerge("bg-stone-900 text-stone-100", "hover:bg-stone-800"),
  secondary: twMerge("bg-stone-900/[7%] text-primary", "hover:bg-stone-900/[9%]"),
  tertiary: twMerge("text-secondary", "hover:bg-stone-900/5 hover:text-primary"),
};

const pressedScale = 0.97;
const pressDuration = 110;
const releaseDuration = 180;
const presses = new WeakMap<HTMLElement, Animation>();

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// The squish runs in script rather than on :active so a quick click still plays it in full, and so nothing that
// changes under the button mid-click (the form going inert on send, a dialog opening) can cut it short.
// Buttons inside a `data-press-group` element, like the halves of a split button, squish the whole group together.
function pressTarget(button: HTMLButtonElement) {
  return button.closest<HTMLElement>("[data-press-group]") ?? button;
}

function press(button: HTMLButtonElement) {
  if (reducedMotion()) return;
  const target = pressTarget(button);
  presses.get(target)?.cancel();
  presses.set(
    target,
    target.animate([{ scale: 1 }, { scale: pressedScale }], {
      duration: pressDuration,
      easing: "cubic-bezier(0.3, 0, 0.5, 1)",
      fill: "forwards",
    }),
  );
}

function release(button: HTMLButtonElement) {
  const target = pressTarget(button);
  const pressing = presses.get(target);
  if (!pressing) return;
  presses.delete(target);
  pressing.finished.then(
    () => {
      target.animate([{ scale: pressedScale }, { scale: 1 }], {
        duration: releaseDuration,
        easing: "cubic-bezier(0.2, 0.7, 0.3, 1)",
      });
      pressing.cancel();
    },
    () => {},
  );
}

export function Button({
  className,
  type = "button",
  variant = "primary",
  squish = true,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
  onClick,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={twMerge(
        "h-8.5 cursor-pointer px-4 font-[450]",
        "rounded-full",
        "transition-[background-color,color,opacity] duration-150 ease-out",
        "disabled:pointer-events-none disabled:opacity-50",
        variantClassNames[variant],
        className,
      )}
      onPointerDown={(event) => {
        if (squish && event.button === 0) press(event.currentTarget);
        onPointerDown?.(event);
      }}
      onPointerUp={(event) => {
        release(event.currentTarget);
        onPointerUp?.(event);
      }}
      onPointerLeave={(event) => {
        release(event.currentTarget);
        onPointerLeave?.(event);
      }}
      onPointerCancel={(event) => {
        release(event.currentTarget);
        onPointerCancel?.(event);
      }}
      onClick={(event) => {
        // Keyboard presses click without any pointer events.
        if (squish && event.detail === 0) {
          press(event.currentTarget);
          release(event.currentTarget);
        }
        onClick?.(event);
      }}
      {...props}
    />
  );
}
