"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { CartNotices, EmptyCart, reconcile, useCart } from "@/components/cart";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { track } from "@/lib/analytics/track";
import Image from "next/image";

import { PhotoPlaceholder } from "@/components/ui/photo-placeholder";
import { Stepper } from "@/components/ui/stepper";
import type { MenuItem } from "@/lib/inventory";
import { bump } from "@/lib/motion";
import { DEAL_CENTS, DEAL_SIZE, formatCents, priceOrder } from "@/lib/money";
import { LIMITS, cartLimit } from "@/lib/validation";
import { IconClock } from "@tabler/icons-react";

type Row = MenuItem & { quantity: number };

// How long a leaving row's animation takes to finish; must cover animate-leave.
const LEAVE_MS = 400;

export function CartView({ menu, ordersOpen }: { menu: MenuItem[]; ordersOpen: boolean }) {
  const { lines, count, setQuantity } = useCart();

  useEffect(() => reconcile(menu), [menu]);

  // Once per visit to the page, not once per quantity change.
  useEffect(() => track("cart_viewed"), []);

  // Rows the cart no longer holds but whose leave animation hasn't finished. Snapshotted so
  // they keep rendering with their last known data after the real line is already gone.
  const [leaving, setLeaving] = useState<Map<string, Row>>(new Map());
  const timeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  function finishLeaving(id: string) {
    const timeout = timeouts.current.get(id);
    if (timeout) clearTimeout(timeout);
    timeouts.current.delete(id);
    setLeaving((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }

  useEffect(() => {
    // Clear every pending timeout on unmount so a navigated-away cart can't finish removing later.
    const pending = timeouts.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const totalRef = useRef<HTMLSpanElement>(null);

  function handleQuantityChange(row: Row, next: number, from: "step" | "type") {
    setQuantity(row.id, next); // totals and stock update immediately; the row just lingers visually
    // Typing reports a change per digit. A total that bumps per digit claims to have
    // settled once per keystroke, so only a step bumps it.
    // Lower than the stepper's peak: this figure is wider, so it travels further.
    if (from === "step" && next !== row.quantity) bump(totalRef.current, 1.08);
    if (next === 0) {
      setLeaving((prev) => new Map(prev).set(row.id, row));
      const existing = timeouts.current.get(row.id);
      if (existing) clearTimeout(existing);
      timeouts.current.set(row.id, setTimeout(() => finishLeaving(row.id), LEAVE_MS));
    } else {
      finishLeaving(row.id);
    }
  }

  const onMenu = new Map(menu.map((item) => [item.id, item]));
  const rows: Row[] = lines.flatMap((line) => {
    const item = onMenu.get(line.flavorId);
    return item ? [{ ...item, quantity: line.quantity }] : [];
  });
  const rowIds = new Set(rows.map((row) => row.id));
  const displayRows = [...rows, ...[...leaving.values()].filter((row) => !rowIds.has(row.id))];

  // The last row leaving takes the summary and the button with it, so the block leaves as
  // one thing. Collapsing the row inside a card that then disappears in a single frame is
  // what made this read as a glitch rather than a transition.
  const emptying = rows.length === 0 && displayRows.length > 0;

  // Priced from what is on screen while it leaves. Priced from the cart, the figures would
  // drop to "0 cookies  $0.00" under a row that is still visibly there.
  const priced = emptying ? displayRows : rows;
  const shownCount = priced.reduce((sum, row) => sum + row.quantity, 0);
  const deal = priceOrder(
    priced.map((row) => ({ name: row.name, quantity: row.quantity, unitPriceCents: row.priceCents })),
  );

  // Rendered in both states: an emptied cart is exactly when someone needs telling why.

  if (displayRows.length === 0) {
    return (
      <>
        <CartNotices className="mt-6 empty:mt-0" />
        <EmptyCart ordersOpen={ordersOpen} />
      </>
    );
  }

  return (
    <div
      onAnimationEnd={(event) => {
        if (!emptying || event.target !== event.currentTarget) return;
        for (const id of leaving.keys()) finishLeaving(id);
      }}
      className={`mt-8 flex flex-col gap-6 ${emptying ? "overflow-hidden animate-leave" : ""}`}
    >
      <CartNotices className="mt-6 empty:mt-0" />
      <Card className="p-0">
        <ul className="divide-y divide-default">
          {displayRows.map((row) => {
            const isLeaving = leaving.has(row.id) && !rowIds.has(row.id);
            const limit = cartLimit(row, count);
            return (
              <li
                key={row.id}
                onAnimationEnd={(e) => {
                  if (isLeaving && !emptying && e.target === e.currentTarget) finishLeaving(row.id);
                }}
                className={`flex flex-col gap-4 p-5 sm:flex-row sm:flex-wrap sm:items-center ${
                  isLeaving && !emptying ? "overflow-hidden animate-leave" : ""
                }`}
              >
                {/* A phone gives the name its own line. Sharing one with the stepper and the
                    total left it about a hundred pixels, and every name here wrapped to three. */}
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  {row.imageUrl ? (
                    <Image
                      src={row.imageUrl}
                      alt={row.name}
                      width={48}
                      height={48}
                      className="size-12 shrink-0 rounded-control-sm object-cover"
                    />
                  ) : (
                    <PhotoPlaceholder className="size-12 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{row.name}</p>
                    <p className="text-sm text-secondary">{formatCents(row.priceCents)} each</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <Stepper
                    label={row.name}
                    value={String(row.quantity)}
                    min={0}
                    max={limit.max}
                    onChange={(next, from) => handleQuantityChange(row, Number(next || "0"), from)}
                  />
                  <span className="w-20 text-right tabular-nums">
                    {formatCents(row.priceCents * row.quantity)}
                  </span>
                </div>
                {limit.reached && (
                  <p className="basis-full text-sm text-tertiary">{limit.reached}</p>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {deal.savedCents > 0 && (
        <div className="flex items-center justify-between text-sm text-success">
          <span>
            {DEAL_SIZE} for {formatCents(DEAL_CENTS)}
            {deal.sets > 1 ? ` × ${deal.sets}` : ""}
          </span>
          <span className="tabular-nums">−{formatCents(deal.savedCents)}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-secondary">
          <span className="font-semibold text-primary">{shownCount}</span>{" "}
          {shownCount === 1 ? "cookie" : "cookies"}
        </span>
        <span ref={totalRef} className="text-lg font-semibold tabular-nums">
          {formatCents(deal.totalCents)}
        </span>
      </div>

      {ordersOpen ? (
        <Link
          href="/checkout"
          className={buttonClass({ size: "md" })}
        >
          <IconClock aria-hidden className="size-4" />
          Pick a pickup time
        </Link>
      ) : (
        <p className="text-secondary">Orders are closed right now, so this cart can&apos;t be checked out.</p>
      )}

      <p className="text-sm text-tertiary">
        {LIMITS.perOrderMax} cookies per order. Pickup only. No refunds or cancellations.
      </p>
    </div>
  );
}
