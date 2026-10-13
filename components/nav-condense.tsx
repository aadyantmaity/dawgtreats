"use client";

import { useEffect } from "react";

// Reading is scrolling down, so the bar steps back; reaching for a tab starts with
// scrolling up, so it comes forward again. Nothing moves near the top of a page, where
// the bar is not in anyone's way.
const AWAY_FROM_TOP = 24;
// A phone's rubber band and a trackpad's drift both report tiny moves in both directions.
const ENOUGH = 6;
// Reflow settles over several frames, and every step of it arrives as a scroll.
const AFTER_RESIZE_MS = 400;
// The bar's own height is part of the page, so a change here moves the page under the
// reader. Without a floor, that move reads as a scroll and turns into a loop.
const BETWEEN_FLIPS_MS = 250;

export function NavCondense() {
  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;

    const pageHeight = () => document.documentElement.scrollHeight;
    let last = window.scrollY;
    let height = pageHeight();
    let flippedAt = 0;
    let quietUntil = 0;
    let queued = false;

    const settle = () => {
      queued = false;
      const now = window.scrollY;
      const tall = pageHeight();

      // The page changed shape rather than the reader moving: take the new position as
      // the resting one and decide nothing from it.
      if (tall !== height || performance.now() < quietUntil) {
        height = tall;
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
      height = pageHeight();
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
