"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { CartNotices, reconcile, useCart } from "@/components/cart";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { track } from "@/lib/analytics/track";
import Image from "next/image";

import { PhotoPlaceholder } from "@/components/ui/photo-placeholder";
import { Stepper } from "@/components/ui/stepper";
import type { MenuItem } from "@/lib/inventory";
import { bump } from "@/lib/motion";
import { formatCents } from "@/lib/money";
import { LIMITS, cartLimit } from "@/lib/validation";

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

  const total = rows.reduce((sum, row) => sum + row.priceCents * row.quantity, 0);

  // Rendered in both states: an emptied cart is exactly when someone needs telling why.

  // What is left to buy, not what the week started with: a sold-out flavor is not an
  // invitation back to the menu.
  const buyable = menu.filter((item) => item.remaining !== 0).length;

  if (displayRows.length === 0) {
    return (
      <>
        <CartNotices className="mt-6" />
        <div className="mt-8 flex flex-col items-center rounded-card border border-dashed border-default px-5 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-pill bg-disabled text-secondary">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="size-6"
            >
              <path d="M6 8h12l-1 11.5a1.5 1.5 0 0 1-1.5 1.4h-9A1.5 1.5 0 0 1 5 19.5L4 8Z" />
              <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
            </svg>
          </span>
          <p className="mt-3 text-lg font-semibold">Nothing in here yet</p>
          <p className="mt-1 text-secondary">
            {ordersOpen
              ? `${buyable} ${buyable === 1 ? "flavor is" : "flavors are"} out of the oven this week.`
              : "Orders are closed right now. New batch most weeks."}
          </p>
          <Link href="/" className={`${buttonClass({ size: "md" })} mt-5`}>
            {ordersOpen ? "See this week's bake" : "Back to the menu"}
          </Link>
        </div>
      </>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-6">
      <CartNotices className="mt-6" />
      <Card className="p-0">
        <ul className="divide-y divide-default">
          {displayRows.map((row) => {
            const isLeaving = leaving.has(row.id) && !rowIds.has(row.id);
            const limit = cartLimit(row, count);
            return (
              <li
                key={row.id}
                onAnimationEnd={(e) => {
                  if (isLeaving && e.target === e.currentTarget) finishLeaving(row.id);
                }}
                className={`flex flex-col gap-4 p-5 sm:flex-row sm:flex-wrap sm:items-center ${isLeaving ? "overflow-hidden animate-leave" : ""}`}
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

      <div className="flex items-center justify-between">
        <span className="text-secondary">
          <span className="font-semibold text-primary tabular-nums">{count}</span> cookies
        </span>
        <span ref={totalRef} className="text-lg font-semibold tabular-nums">
          {formatCents(total)}
        </span>
      </div>

      {ordersOpen ? (
        <Link
          href="/checkout"
          className={buttonClass({ size: "md" })}
        >
          Pick a pickup time
        </Link>
      ) : (
        <p className="text-secondary">Orders are closed right now, so this cart can&apos;t be checked out.</p>
      )}

      <p className="text-sm text-tertiary">
        {LIMITS.perOrderMax} cookies per order. Pickup only, Saturday or Sunday. All sales are final.
      </p>
    </div>
  );
}
