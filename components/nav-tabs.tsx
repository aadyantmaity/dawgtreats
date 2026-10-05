"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { prefersReducedMotion } from "@/lib/motion";

export type NavTab = { href: string; label: string; hideOnPhone?: boolean };

type Box = { left: number; width: number };

// The pill stretches across both tabs on the way and draws back in, so it reads as
// one thing moving rather than a box being repositioned.
export function NavTabs({ tabs }: { tabs: NavTab[] }) {
  const pathname = usePathname();
  const links = useRef(new Map<string, HTMLAnchorElement | null>());
  const pillRef = useRef<HTMLSpanElement>(null);
  const previous = useRef<Box | null>(null);
  const [pill, setPill] = useState<Box | null>(null);

  const here = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const active = tabs.find((tab) => here(tab.href))?.href ?? null;

  const measure = useCallback(() => {
    const el = active ? links.current.get(active) : null;
    // A tab hidden at this width measures zero, and no pill beats a flat one.
    const next = el && el.offsetWidth > 0 ? { left: el.offsetLeft, width: el.offsetWidth } : null;
    // Same numbers must mean no change, or every measurement restarts the animation
    // from where it is going and the pill never gets to travel.
    setPill((current) =>
      current?.left === next?.left && current?.width === next?.width ? current : next,
    );
  }, [active]);

  useLayoutEffect(measure, [measure]);

  useLayoutEffect(() => {
    const el = pillRef.current;
    const from = previous.current;
    previous.current = pill;
    if (!el || !from || !pill) return;
    if (from.left === pill.left && from.width === pill.width) return;
    if (prefersReducedMotion()) return;

    // One journey at a time: a second would start from where the first is headed.
    for (const running of el.getAnimations()) running.cancel();

    const left = Math.min(from.left, pill.left);
    const right = Math.max(from.left + from.width, pill.left + pill.width);

    el.animate(
      [
        { left: `${from.left}px`, width: `${from.width}px` },
        { left: `${left}px`, width: `${right - left}px`, offset: 0.45 },
        { left: `${pill.left}px`, width: `${pill.width}px` },
      ],
      { duration: 420, easing: "cubic-bezier(0.32, 0.72, 0.3, 1)" },
    );
  }, [pill]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    // Text shifts when the display font finishes loading, and so must the pill.
    void document.fonts?.ready.then(measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return (
    <div className="relative flex min-w-0 items-center gap-1 overflow-x-auto sm:gap-2">
      {pill && (
        <span
          ref={pillRef}
          aria-hidden
          className="absolute inset-y-0 rounded-pill bg-action"
          style={{ left: pill.left, width: pill.width }}
        />
      )}
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          ref={(el) => {
            links.current.set(tab.href, el);
          }}
          aria-current={here(tab.href) ? "page" : undefined}
          className={`relative shrink-0 rounded-pill px-3 py-1.5 text-sm whitespace-nowrap transition-colors ease-spring ${
            here(tab.href) ? "text-on-action" : "text-secondary hover:text-primary"
          } ${tab.hideOnPhone ? "hidden sm:block" : ""}`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
