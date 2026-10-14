"use client";

import Link from "next/link";

import { useCart } from "@/components/cart";
import type { MenuItem } from "@/lib/inventory";
import { priceOrder, formatCents } from "@/lib/money";

// A phone only: a laptop already shows the cart in the bar with room to spare. The total
// comes from the menu because the cart itself holds quantities, never prices.
export function CartTray({ menu }: { menu: MenuItem[] }) {
  const { lines } = useCart();
  const priceOf = new Map(menu.map((item) => [item.id, item.priceCents]));
  // A line the menu no longer prices cannot be totalled, so it is not counted either:
  // "1 cookie · $0.00" is worse than saying nothing.
  const priced = lines.filter((line) => priceOf.has(line.flavorId));
  const count = priced.reduce((sum, line) => sum + line.quantity, 0);
  const { totalCents: total } = priceOrder(
    priced.map((line) => ({ name: line.flavorId, quantity: line.quantity, unitPriceCents: priceOf.get(line.flavorId)! })),
  );
  const waiting = count > 0;

  return (
    <div
      inert={!waiting}
      className={`fixed inset-x-6 bottom-6 z-40 transition-transform ease-out sm:hidden ${
        waiting ? "translate-y-0" : "translate-y-24"
      }`}
    >
      {/* Only as wide as what it says. Edge to edge it read as a second bar rather than
          something floating over the page. */}
      <div className="mx-auto flex h-control w-fit max-w-full items-center gap-3 rounded-pill bg-action pr-1 pl-5 text-on-action shadow-lg">
        <span className="text-sm whitespace-nowrap">
          <span className="tabular-nums">{count}</span>{" "}
          {count === 1 ? "cookie" : "cookies"} · {formatCents(total)}
        </span>
        <Link
          href="/checkout"
          className="inline-flex h-control-sm shrink-0 items-center rounded-pill bg-page px-5 text-sm font-medium text-primary"
        >
          Checkout
        </Link>
      </div>
    </div>
  );
}
