"use client";

import type { ReactNode } from "react";
import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { twMerge } from "tailwind-merge";

type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  children: ReactNode;
};

export function Switch({ checked, onCheckedChange, className, children }: SwitchProps) {
  return (
    <label
      className={twMerge(
        "group/switch flex cursor-pointer items-center gap-2 text-[13px] text-secondary select-none",
        className,
      )}
    >
      <BaseSwitch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        className={twMerge(
          "relative h-4.5 w-7.5 shrink-0",
          "rounded-full",
          // Solid tints of the surface rather than translucent ones, so toggling fades between solid colors
          // instead of through half-transparent grays.
          "bg-[color-mix(in_oklab,var(--color-stone-900)_12%,var(--color-surface))]",
          "group-hover/switch:bg-[color-mix(in_oklab,var(--color-stone-900)_15%,var(--color-surface))]",
          "transition-colors duration-150",
          "data-[checked]:bg-stone-900 data-[checked]:group-hover/switch:bg-stone-800",
        )}
      >
        <BaseSwitch.Thumb
          className={twMerge(
            "absolute top-0.5 left-0.5 size-3.5",
            "rounded-full bg-white",
            "transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
            "data-[checked]:translate-x-3",
          )}
        />
      </BaseSwitch.Root>
      {children}
    </label>
  );
}
