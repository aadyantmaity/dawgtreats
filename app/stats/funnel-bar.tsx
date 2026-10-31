"use client";

import { useLayoutEffect, useRef } from "react";

import { prefersReducedMotion } from "@/lib/motion";

// The bar renders at its real width. If the fill never runs, for any reason, the reader
// still sees the true figure instead of an empty track.
// It grows by transform, not by width: a width tween relays out the page every frame.
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
    // The frame between the two scales is what makes the transition run: one style pass
    // sees only the final scale and nothing animates.
    bar.style.transform = "scaleX(0)";
    const frame = requestAnimationFrame(() => {
      bar.style.transform = `scaleX(${share / 100})`;
    });
    return () => cancelAnimationFrame(frame);
  }, [share]);

  return (
    <div className="h-2 w-full overflow-hidden rounded-pill bg-subtle">
      <div
        ref={fill}
        className="h-2 w-full origin-left rounded-pill bg-action transition-transform ease-out"
        style={{ transform: `scaleX(${share / 100})` }}
      />
    </div>
  );
}
