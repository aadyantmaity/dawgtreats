"use client";

import { MessageCircle, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useCart } from "@/components/cart";
import { FeedbackForm } from "@/components/feedback-form";

export function FeedbackFab() {
  const [open, setOpen] = useState(false);
  const { count } = useCart();
  const pathname = usePathname();
  // Nobody wants to be asked for feedback in the middle of paying. On /feedback the
  // button would open the form that is already on the page.
  const invited = pathname === "/" || pathname === "/account" || pathname.startsWith("/order");
  // The cart tray sits in this corner, and only on the menu. Rise above it rather than
  // behind it: a button nobody can press is worse than one slightly out of place.
  const trayUp = count > 0 && pathname === "/";
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // The panel is drawn above the button that opens it, so a forward Tab from the button
    // walks straight past the form. Focus goes in instead, and Escape sends it back.
    panelRef.current?.focus();
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

  if (!invited) return null;

  return (
    <div className={`fixed inset-x-6 bottom-6 z-40 flex flex-col items-end gap-3 transition-transform ease-out sm:inset-x-auto sm:right-6 sm:bottom-6 sm:translate-y-0 ${
        trayUp ? "-translate-y-16" : ""
      }`}>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-label="Send feedback"
          // The panel is drawn above the button it belongs to, so a forward Tab from the
          // button leaves the whole thing behind. Focus moves in when it opens instead.
          tabIndex={-1}
          className="max-h-panel-max-h w-panel max-w-full animate-rise overflow-y-auto rounded-card border border-default bg-surface p-5 shadow-lg"
        >
          <h2 className="font-display text-xl font-semibold">Tell me what you think</h2>
          <p className="mt-1 text-sm text-secondary">
            How they were, or what to bake next.
          </p>
          <FeedbackForm compact className="mt-4" onDone={() => setOpen(false)} />
        </div>
      )}

      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-label={open ? "Close" : "Send feedback"}
        className="grid size-fab place-items-center gap-2 rounded-pill bg-action text-on-action shadow-lg transition-colors hover:bg-action/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:flex sm:h-control sm:w-auto sm:items-center sm:px-5 sm:text-base"
      >
        {/* The word arrives beside the icon on a wider screen, never instead of it: every
            other control in the chrome is a picture and a word. */}
        {open ? (
          <X aria-hidden className="size-6 sm:size-4" />
        ) : (
          <MessageCircle aria-hidden className="size-6 sm:size-4" />
        )}
        <span className="hidden sm:inline">{open ? "Close" : "Feedback"}</span>
      </button>
    </div>
  );
}
