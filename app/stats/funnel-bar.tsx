"use client";

import { useLayoutEffect, useRef } from "react";

import { prefersReducedMotion } from "@/lib/motion";

// The bar renders at its real width. If the fill never runs, for any reason, the reader
// still sees the true figure instead of an empty track.
export function FunnelBar({ share }: { share: number }) {
  const fill = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const bar = fill.current;
    if (!bar) return;
    // Motion off: skip the reset to 0% so the bar is never momentarily empty.
    if (prefersReducedMotion()) return;
    // A hidden tab never runs a frame callback, so the bar would sit at 0% until it is
    // opened. Leave it at its real width instead.
    if (document.visibilityState === "hidden") return;
    // The frame between the two widths is what makes the transition run: one style pass
    // sees only the final width and nothing animates.
    bar.style.width = "0%";
    const frame = requestAnimationFrame(() => {
      bar.style.width = `${share}%`;
    });
    return () => cancelAnimationFrame(frame);
  }, [share]);

  return (
    <div className="h-2 w-full overflow-hidden rounded-pill bg-subtle">
      <div
        ref={fill}
        className="h-2 rounded-pill bg-action transition-all ease-out"
        style={{ width: `${share}%` }}
      />
    </div>
  );
}
