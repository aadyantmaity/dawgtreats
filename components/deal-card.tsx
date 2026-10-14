"use client";

import { IconPlus } from "@tabler/icons-react";
import Image from "next/image";
import { useState } from "react";

import { useCart } from "@/components/cart";
import { Button } from "@/components/ui/button";
import { PhotoPlaceholder } from "@/components/ui/photo-placeholder";
import { Stepper } from "@/components/ui/stepper";
import { DEAL_CENTS, DEAL_SIZE, formatCents } from "@/lib/money";
import type { MenuItem } from "@/lib/inventory";

type Pick = { flavorId: string; quantity: number };

// The deal is priced on the whole cart, so this card sells nothing of its own: it is a
// quicker way to put three cookies in, and what it adds is ordinary cart lines that the
// cart page edits like any other.
export function DealCard({ menu }: { menu: MenuItem[] }) {
  const { lines, addMany } = useCart();
  const forSale = menu.filter((item) => item.remaining !== 0);
  const [picks, setPicks] = useState<Pick[]>([]);

  const chosen = picks.reduce((sum, pick) => sum + pick.quantity, 0);
  const left = DEAL_SIZE - chosen;

  const take = (flavorId: string, quantity: number) =>
    setPicks((held) => {
      const rest = held.filter((pick) => pick.flavorId !== flavorId);
      return quantity > 0 ? [...rest, { flavorId, quantity }] : rest;
    });

  const add = () => {
    addMany(picks);
    setPicks([]);
  };

  // Fewer than three cookies on the menu cannot make a set.
  if (forSale.length === 0) return null;

  return (
    <article className="flex h-full flex-col gap-4 rounded-card border border-default bg-surface p-5">
      <div>
        <h2 className="font-sans text-lg font-semibold">
          {DEAL_SIZE} for {formatCents(DEAL_CENTS)}
        </h2>
        <p className="mt-1 text-sm text-secondary">
          Any three cookies, any combo you like!
        </p>
      </div>

      <div className="flex flex-1 flex-col justify-around gap-3">
        {forSale.map((item) => {
          const taken = picks.find((pick) => pick.flavorId === item.id)?.quantity ?? 0;
          // Never more than the batch holds, and never past the three this set is.
          const ceiling = Math.min(taken + left, item.remaining ?? taken + left);
          return (
            <div key={item.id} className="flex flex-wrap items-center gap-3">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt=""
                  width={160}
                  height={120}
                  sizes="4rem"
                  className="size-12 shrink-0 rounded-card object-cover"
                />
              ) : (
                <PhotoPlaceholder className="size-12 shrink-0" />
              )}
              <span className="min-w-0 flex-1 text-sm">{item.name}</span>
              <Stepper
                label={item.name}
                value={String(taken)}
                min={0}
                max={Math.max(taken, ceiling)}
                onChange={(next) => take(item.id, Number(next || 0))}
              />
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-secondary">{left > 0 ? `${left} more to go` : ""}</span>
        <Button onClick={add} disabled={left !== 0}>
          <IconPlus aria-hidden className="size-4" />
          Add the set
        </Button>
      </div>

      {lines.length > 0 && (
        <p className="text-sm text-tertiary">
          Already in your cart counts too: every three cookies is {formatCents(DEAL_CENTS)}.
        </p>
      )}
    </article>
  );
}
