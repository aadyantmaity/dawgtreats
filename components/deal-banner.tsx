"use client";

import { useEffect, useRef } from "react";

import { useCart } from "@/components/cart";
import type { MenuItem } from "@/lib/inventory";
import { bump } from "@/lib/motion";
import { DEAL_CENTS, DEAL_SIZE, formatCents, priceOrder } from "@/lib/money";

// The deal is priced on the whole cart, so this collects nothing: it says the offer exists
// and counts what is already chosen. A card with its own pickers asked for a decision that
// changes nothing, which is why it always looked empty.
export function DealBanner({ menu }: { menu: MenuItem[] }) {
  const { lines } = useCart();
  const priceOf = new Map(menu.map((item) => [item.id, item]));

  const priced = lines.flatMap((line) => {
    const item = priceOf.get(line.flavorId);
    return item ? [{ name: item.name, quantity: line.quantity, unitPriceCents: item.priceCents }] : [];
  });
  const deal = priceOrder(priced);
  const cookies = priced.reduce((sum, line) => sum + line.quantity, 0);
  const intoTheNext = cookies % DEAL_SIZE;
  const toGo = intoTheNext === 0 ? DEAL_SIZE : DEAL_SIZE - intoTheNext;

  const saving = deal.savedCents > 0 && intoTheNext === 0;
  const said = saving
    ? `Saving ${formatCents(deal.savedCents)}`
    : cookies === 0
      ? "Pick any three"
      : `${toGo} more ${toGo === 1 ? "cookie" : "cookies"}`;

  // The set just closed, so the figure marks itself. Only a rise is worth a bump: a cookie
  // taken back out lowers the saving, which is not news to celebrate.
  const savedRef = useRef<HTMLSpanElement>(null);
  const wasSaved = useRef(deal.savedCents);
  useEffect(() => {
    if (deal.savedCents > wasSaved.current) bump(savedRef.current, 1.14);
    wasSaved.current = deal.savedCents;
  }, [deal.savedCents]);

  return (
    <section className="mt-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-card border border-default bg-surface p-5">
      <div>
        <p className="font-sans text-lg font-semibold">
          {DEAL_SIZE} for {formatCents(DEAL_CENTS)}
        </p>
        <p className="mt-1 text-sm text-secondary">Any three cookies, any combo you like!</p>
      </div>
      <div className="flex items-center gap-3">
        <span
          ref={savedRef}
          className={`text-sm ${saving ? "font-semibold text-success" : "text-secondary"}`}
        >
          {said}
        </span>
        <span aria-hidden className="flex gap-1">
          {Array.from({ length: DEAL_SIZE }, (_, slot) => (
            <span
              key={slot}
              className={`size-3 rounded-pill ${
                slot < (intoTheNext === 0 && cookies > 0 ? DEAL_SIZE : intoTheNext)
                  ? "bg-action"
                  : "bg-subtle"
              }`}
            />
          ))}
        </span>
      </div>
    </section>
  );
}
