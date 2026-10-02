"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { RequestForm } from "@/app/requests/request-form";

export function FeedbackFab() {
  const [open, setOpen] = useState(false);
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
    <div className="fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-3 sm:inset-x-auto sm:right-6 sm:bottom-6">
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Request a flavour"
          className="max-h-panel-max-h w-panel max-w-full overflow-y-auto rounded-card border border-default bg-surface p-5 shadow-lg"
        >
          <h2 className="font-serif text-xl font-semibold">What should I bake?</h2>
          <p className="mt-1 text-sm text-secondary">
            I read every one of these when planning the week.
          </p>
          <RequestForm className="mt-4 border-0 p-0" onDone={() => setOpen(false)} />
          <p className="mt-4 border-t border-default pt-4 text-sm text-secondary">
            Picked up an order?{" "}
            <Link href="/order/lookup" className="underline hover:text-primary">
              Leave a review
            </Link>
          </p>
        </div>
      )}

      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-label={open ? "Close" : "Request a flavour"}
        className="h-control-sm w-control-sm rounded-pill bg-action text-xl text-on-action shadow-lg transition-colors hover:bg-action/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:h-control sm:w-auto sm:px-5 sm:text-base"
      >
        <span className="sm:hidden">{open ? "×" : "+"}</span>
        <span className="hidden sm:inline">{open ? "Close" : "Request a flavour"}</span>
      </button>
    </div>
  );
}
