import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { twMerge } from "tailwind-merge";

const previewPageWidth = 680;

export function PreviewPage({ className, children }: { className?: string; children: ReactNode }) {
  const [scale, setScale] = useState(1);
  const pageRef = useRef<HTMLDivElement>(null);

  // Measures before the first paint so a page that mounts mid-animation never shows a frame at full size.
  useLayoutEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    setScale(page.clientWidth / previewPageWidth);
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / previewPageWidth));
    observer.observe(page);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={pageRef}
      className={twMerge(
        "m-auto aspect-[8.5/11] shrink-0",
        "bg-surface shadow-[0_40px_100px_-20px_rgb(28_25_23/0.35)] ring-[0.5px] ring-stone-900/10",
        "transition-[translate,scale] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
        className,
      )}
    >
      {/* Lays out at full page width, then zooms to fit so narrow panes shrink the page instead of reflowing it. */}
      <div
        className="flex flex-col"
        style={{ width: previewPageWidth, minHeight: (previewPageWidth * 11) / 8.5, zoom: scale }}
      >
        {children}
      </div>
    </div>
  );
}
