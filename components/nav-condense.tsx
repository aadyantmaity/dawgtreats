"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// The bar scales rather than resizes, so it never moves the page and no feedback loop is
// possible. iOS resizes the window whenever its address bar hides, which a page-height
// guard used to mistake for a reflow and swallow the gesture with it.
// Reading is scrolling down, so the bar steps back; reaching for a tab starts with
// scrolling up, so it comes forward again. Nothing moves near the top of a page, where
// the bar is not in anyone's way.
const AWAY_FROM_TOP = 24;
// A phone's rubber band and a trackpad's drift both report tiny moves in both directions.
const ENOUGH = 6;
// Reflow settles over several frames, and every step of it arrives as a scroll.
const AFTER_RESIZE_MS = 400;
// Two flips cannot land on top of each other, whatever else moves the page.
const BETWEEN_FLIPS_MS = 250;

export function NavCondense() {
  const pathname = usePathname();

  // A new page starts at the top, where the bar is never in the way, so it arrives open
  // however it was left. Keyed on the path, so it also runs on a tab pressed twice.
  useEffect(() => {
    document.querySelector("header")?.removeAttribute("data-condensed");
  }, [pathname]);

  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;

    let last = window.scrollY;
    let flippedAt = 0;
    let quietUntil = 0;
    let queued = false;

    const settle = () => {
      queued = false;
      const now = window.scrollY;

      // Something moved the page rather than the reader: take the new position as the
      // resting one and decide nothing from it.
      if (performance.now() < quietUntil) {
        last = now;
        return;
      }

      const moved = now - last;
      if (Math.abs(moved) < ENOUGH) return;
      last = now;

      const wanted = moved > 0 && now > AWAY_FROM_TOP;
      if (wanted === header.hasAttribute("data-condensed")) return;
      if (performance.now() - flippedAt < BETWEEN_FLIPS_MS) return;
      flippedAt = performance.now();
      header.toggleAttribute("data-condensed", wanted);
    };

    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(settle);
    };

    const onResize = () => {
      quietUntil = performance.now() + AFTER_RESIZE_MS;
      last = window.scrollY;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return null;
}
