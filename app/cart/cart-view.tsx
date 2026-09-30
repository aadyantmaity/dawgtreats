"use client";

import Link from "next/link";
import { useEffect } from "react";

import { reconcile, useCart } from "@/components/cart";
import { Card } from "@/components/ui/card";
import { PhotoPlaceholder } from "@/components/ui/photo-placeholder";
import { Stepper } from "@/components/ui/stepper";
import type { MenuItem } from "@/lib/inventory";
import { formatCents } from "@/lib/money";
import { LIMITS } from "@/lib/validation";

export function CartView({ menu, ordersOpen }: { menu: MenuItem[]; ordersOpen: boolean }) {
  const { lines, notices, count, setQuantity } = useCart();

  useEffect(() => reconcile(menu), [menu]);

  const onMenu = new Map(menu.map((item) => [item.id, item]));
  const rows = lines.flatMap((line) => {
    const item = onMenu.get(line.flavorId);
    return item ? [{ ...item, quantity: line.quantity }] : [];
  });

  const total = rows.reduce((sum, row) => sum + row.priceCents * row.quantity, 0);

  if (rows.length === 0) {
    return (
      <>
        <p className="mt-3 text-secondary">Your cart is empty.</p>
        <Link href="/" className="mt-6 inline-block underline">
          Back to the menu
        </Link>
      </>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-6">
      {notices.length > 0 && (
        <div className="flex flex-col gap-1" role="status">
          {notices.map((note) => (
            <p key={note} className="text-urgent">
              {note}
            </p>
          ))}
        </div>
      )}
      <Card className="p-0">
        <ul className="divide-y divide-default">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-4 p-5">
              <PhotoPlaceholder className="size-12" />
              <div className="min-w-0 flex-1 basis-40">
                <p className="font-semibold">{row.name}</p>
                <p className="text-sm text-secondary">{formatCents(row.priceCents)} each</p>
              </div>
              <Stepper
                label={row.name}
                value={String(row.quantity)}
                min={0}
                max={Math.min(
                  row.remaining ?? LIMITS.perFlavorMax,
                  LIMITS.perFlavorMax,
                  row.quantity + Math.max(0, LIMITS.perOrderMax - count),
                )}
                onChange={(next) => setQuantity(row.id, Number(next || "0"))}
              />
              <span className="w-20 text-right tabular-nums">
                {formatCents(row.priceCents * row.quantity)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex items-center justify-between">
        <span className="text-secondary">
          <span className="font-semibold text-primary tabular-nums">{count}</span> cookies
        </span>
        <span className="text-lg font-semibold tabular-nums">{formatCents(total)}</span>
      </div>

      {ordersOpen ? (
        <Link
          href="/checkout"
          className="inline-flex h-control items-center justify-center rounded-control bg-action px-5 font-medium text-on-action hover:bg-action/90"
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
