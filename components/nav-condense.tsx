"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Reading is scrolling down, so the bar steps back; reaching for a tab starts with
// scrolling up, so it comes forward again. Nothing moves near the top of a page, where
// the bar is not in anyone's way.
const AWAY_FROM_TOP = 24;
// A phone's rubber band and a trackpad's drift both report tiny moves in both directions.
const ENOUGH = 5;

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

    // Read and decide in the event itself. A frame callback looks like the careful way to
    // do this, but iOS defers them while a finger is moving, which arrives as the bar
    // changing late or not at all. The work here is two reads and an attribute.
    const onScroll = () => {
      const now = window.scrollY;
      const moved = now - last;
      if (Math.abs(moved) < ENOUGH) return;
      last = now;
      header.toggleAttribute("data-condensed", moved > 0 && now > AWAY_FROM_TOP);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return null;
}
