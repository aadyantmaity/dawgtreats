"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useCart } from "@/components/cart";
import { FeedbackForm } from "@/components/feedback-form";

export function FeedbackFab() {
  const [open, setOpen] = useState(false);
  const { count } = useCart();
  const pathname = usePathname();
  // The cart tray sits in this corner, and only on the menu. Rise above it rather than
  // behind it: a button nobody can press is worse than one slightly out of place.
  const trayUp = count > 0 && pathname === "/";
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className={`fixed inset-x-6 bottom-6 z-40 flex flex-col items-end gap-3 transition-transform ease-out sm:inset-x-auto sm:right-6 sm:bottom-6 sm:translate-y-0 ${
        trayUp ? "-translate-y-16" : ""
      }`}>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Send feedback"
          className="max-h-panel-max-h w-panel max-w-full animate-rise overflow-y-auto rounded-card border border-default bg-surface p-5 shadow-lg"
        >
          <h2 className="font-display text-xl font-semibold">Tell me what you think</h2>
          <p className="mt-1 text-sm text-secondary">
            How they were, or what to bake next.
          </p>
          <FeedbackForm className="mt-4" onDone={() => setOpen(false)} />
        </div>
      )}

      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-label={open ? "Close" : "Send feedback"}
        className="grid size-fab place-items-center rounded-pill bg-action text-on-action shadow-lg transition-colors hover:bg-action/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:h-control sm:w-auto sm:px-5 sm:text-base"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="size-6 sm:hidden"
        >
          {open ? (
            <path d="m6 6 12 12M18 6 6 18" />
          ) : (
            <path d="M20 11.8a7.4 7.4 0 0 1-10.9 6.5L4.5 19.5l1.2-4.4A7.4 7.4 0 1 1 20 11.8Z" />
          )}
        </svg>
        <span className="hidden sm:inline">{open ? "Close" : "Feedback"}</span>
      </button>
    </div>
  );
}
