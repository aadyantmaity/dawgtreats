"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import type { NavTab } from "@/components/nav-tabs";

// The phone's whole navigation. The bar keeps the cart, because the one thing someone is
// part way through must never be behind a menu they have to open first.
export function NavMenu({ tabs, adminTabs }: { tabs: NavTab[]; adminTabs: NavTab[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [seenPath, setSeenPath] = useState(pathname);
  const panel = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  // Closed during render, not in an effect: an effect leaves the menu covering the page
  // it just moved to for a frame.
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const opener = toggle.current;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    // The page behind must not scroll away under the menu.
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector("a")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = scroll;
      // Focus goes back to the button that opened it, never to the top of the page.
      opener?.focus();
    };
  }, [open]);

  // Tab must not reach the page behind, which is covered and cannot be read.
  function keepFocusIn(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || !panel.current) return;
    const stops = panel.current.querySelectorAll<HTMLElement>("a, button");
    const first = stops[0];
    const last = stops[stops.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const here = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const link = (tab: NavTab) => (
    <Link
      key={tab.href}
      href={tab.href}
      aria-current={here(tab.href) ? "page" : undefined}
      className={`flex h-control items-center rounded-pill px-4 text-base transition-colors ease-spring ${
        here(tab.href) ? "bg-action text-on-action" : "text-secondary hover:bg-subtle hover:text-primary"
      }`}
    >
      {tab.label}
    </Link>
  );

  return (
    <>
      <button
        ref={toggle}
        type="button"
        aria-expanded={open}
        aria-controls="nav-menu"
        aria-label="Menu"
        onClick={() => setOpen((was) => !was)}
        className="relative z-50 grid size-control shrink-0 place-items-center rounded-pill border border-default bg-surface text-primary transition-colors ease-spring hover:bg-hover aria-expanded:border-transparent aria-expanded:bg-action aria-expanded:text-on-action sm:hidden"
      >
        <span aria-hidden className="relative block size-4">
          <span className="nav-toggle-line" />
          <span className="nav-toggle-line" />
        </span>
      </button>

      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={`fixed inset-x-0 top-16 bottom-0 z-50 bg-scrim transition-opacity sm:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <div
        id="nav-menu"
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        inert={!open}
        onKeyDown={keepFocusIn}
        className={`fixed top-16 right-0 bottom-0 z-50 flex w-menu max-w-full flex-col gap-1 overflow-y-auto border-l border-default bg-surface p-3 transition-transform ease-out sm:hidden ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {tabs.map(link)}
        {adminTabs.length > 0 && (
          <>
            <p className="mt-2 border-t border-default px-4 pt-3 pb-1 text-xs tracking-wider text-tertiary uppercase">
              Yours only
            </p>
            {adminTabs.map(link)}
          </>
        )}
      </div>
    </>
  );
}
