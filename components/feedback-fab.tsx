"use client";

import { useEffect, useRef, useState } from "react";

import { FeedbackForm } from "@/components/feedback-form";

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
          aria-label="Send feedback"
          className="max-h-panel-max-h w-panel max-w-full overflow-y-auto rounded-card border border-default bg-surface p-5 shadow-lg"
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
        className="h-control-sm w-control-sm rounded-pill bg-action text-xl text-on-action shadow-lg transition-colors hover:bg-action/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:h-control sm:w-auto sm:px-5 sm:text-base"
      >
        <span className="sm:hidden">{open ? "×" : "+"}</span>
        <span className="hidden sm:inline">{open ? "Close" : "Feedback"}</span>
      </button>
    </div>
  );
}
