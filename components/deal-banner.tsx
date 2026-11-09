"use client";

import { useEffect, useRef } from "react";

import { useCart } from "@/components/cart";
import type { MenuItem } from "@/lib/inventory";
import { bump } from "@/lib/motion";
import { DEAL_SIZE, priceOrder } from "@/lib/money";

// The offer is earned on the size of the cart, so this collects nothing: it says what is
// on offer and counts what is already chosen. A card with its own pickers asked for a
// decision that changes nothing, which is why it always looked empty.
export function DealBanner({ menu }: { menu: MenuItem[] }) {
  const { lines } = useCart();
  const priceOf = new Map(menu.map((item) => [item.id, item]));

  const priced = lines.flatMap((line) => {
    const item = priceOf.get(line.flavorId);
    return item ? [{ name: item.name, quantity: line.quantity, unitPriceCents: item.priceCents }] : [];
  });
  const { freeCookies } = priceOrder(priced);
  const cookies = priced.reduce((sum, line) => sum + line.quantity, 0);
  const intoTheNext = cookies % DEAL_SIZE;
  const toGo = intoTheNext === 0 ? DEAL_SIZE : DEAL_SIZE - intoTheNext;

  const earned = freeCookies > 0 && intoTheNext === 0;
  const said = earned
    ? freeCookies === 1
      ? "1 free cookie"
      : `${freeCookies} free cookies`
    : cookies === 0
      ? "Pick any three"
      : `${toGo} more ${toGo === 1 ? "cookie" : "cookies"}`;

  // The set just closed, so the count marks itself. Only a rise is worth a bump: a cookie
  // taken back out lowers the count, which is not news to celebrate.
  const earnedRef = useRef<HTMLSpanElement>(null);
  const wasEarned = useRef(freeCookies);
  useEffect(() => {
    if (freeCookies > wasEarned.current) bump(earnedRef.current, 1.14);
    wasEarned.current = freeCookies;
  }, [freeCookies]);

  return (
    <section className="mt-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-card bg-ground p-5 text-on-ground">
      <div>
        <p className="font-sans text-lg font-semibold">
          Choose any three cookies, get a free surprise flavor
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span
          ref={earnedRef}
          className={`text-sm ${earned ? "font-semibold text-success-on-ground" : "text-on-ground-quiet"}`}
        >
          {said}
        </span>
        <span aria-hidden className="flex gap-1">
          {Array.from({ length: DEAL_SIZE }, (_, slot) => (
            <span
              key={slot}
              className={`size-3 rounded-pill ${
                slot < (intoTheNext === 0 && cookies > 0 ? DEAL_SIZE : intoTheNext)
                  ? "bg-surface"
                  : "bg-on-ground-faint"
              }`}
            />
          ))}
        </span>
      </div>
    </section>
  );
}
