"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/stepper";
import { LIMITS } from "@/lib/validation";

export type CartLine = { flavorId: string; quantity: number };

const STORAGE_KEY = "dawgtreats.cart";
const EMPTY: CartLine[] = [];

export type CartState = { lines: CartLine[]; notices: string[] };

// localStorage is the source of truth, so the cart survives reloads and stays in step across tabs.
let state: CartState = { lines: EMPTY, notices: [] };
let loaded = false;
const listeners = new Set<() => void>();

function read(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return EMPTY;
    return parsed.filter(
      (line): line is CartLine =>
        typeof line === "object" &&
        line !== null &&
        typeof (line as CartLine).flavorId === "string" &&
        Number.isInteger((line as CartLine).quantity) &&
        (line as CartLine).quantity > 0,
    );
  } catch {
    return EMPTY;
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    state = { lines: read(), notices: state.notices };
    emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

const SERVER_STATE: CartState = { lines: EMPTY, notices: [] };

function getSnapshot(): CartState {
  if (!loaded) {
    state = { lines: read(), notices: [] };
    loaded = true;
  }
  return state;
}

function write(lines: CartLine[], notices: string[] = []) {
  state = { lines, notices };
  loaded = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // A private window can refuse storage; the cart still works for this visit.
  }
  emit();
}

export type Availability = { id: string; name: string; remaining: number | null };

// Someone else may have bought these while the cart sat here: fix the cart rather than fail at checkout.
export function reconcile(menu: Availability[]) {
  const onMenu = new Map(menu.map((item) => [item.id, item]));
  const notices: string[] = [];
  const lines: CartLine[] = [];

  for (const line of state.lines) {
    const item = onMenu.get(line.flavorId);
    if (!item || item.remaining === 0) {
      if (item) notices.push(`${item.name} just sold out, so we removed it.`);
      continue;
    }
    if (item.remaining !== null && item.remaining < line.quantity) {
      notices.push(`Only ${item.remaining} ${item.name} left, so we lowered your cart.`);
      lines.push({ flavorId: line.flavorId, quantity: item.remaining });
      continue;
    }
    lines.push(line);
  }

  if (notices.length > 0) write(lines, notices);
}

export function useCart() {
  const { lines, notices } = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_STATE);

  return {
    lines,
    notices,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    quantityOf: (flavorId: string) => lines.find((line) => line.flavorId === flavorId)?.quantity ?? 0,
    setQuantity: (flavorId: string, quantity: number) => {
      const without = lines.filter((line) => line.flavorId !== flavorId);
      write(quantity > 0 ? [...without, { flavorId, quantity }] : without);
    },
    clear: () => write(EMPTY),
  };
}

// Shown wherever a cart is rendered, including when reconcile emptied it: that is
// exactly the moment someone needs telling what happened to their cookies.
export function CartNotices({ className = "" }: { className?: string }) {
  const { notices } = useCart();
  if (notices.length === 0) return null;

  return (
    <div className={`flex flex-col gap-1 ${className}`} role="status">
      {notices.map((note) => (
        <p key={note} className="text-urgent">
          {note}
        </p>
      ))}
    </div>
  );
}

export function CartLink() {
  const { count } = useCart();

  return (
    <Link
      href="/cart"
      aria-label={count === 0 ? "Cart, empty" : `Cart, ${count} cookies`}
      className="inline-flex h-control-sm items-center gap-2 rounded-pill border border-default bg-surface px-4 text-sm font-medium hover:bg-hover"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden className="size-4">
        <path d="M3 4h2l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h7.8a1.5 1.5 0 0 0 1.5-1.2L19.5 7H6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9.5" cy="19" r="1.3" />
        <circle cx="16.5" cy="19" r="1.3" />
      </svg>
      Cart
      {count > 0 && <span className="tabular-nums">{count}</span>}
    </Link>
  );
}

export function AddToCart({
  flavorId,
  name,
  remaining,
}: {
  flavorId: string;
  name: string;
  remaining: number | null;
}) {
  const { count, quantityOf, setQuantity } = useCart();
  const [note, setNote] = useState<string | null>(null);
  const quantity = quantityOf(flavorId);

  if (remaining === null) return null;
  if (remaining === 0) return <Button disabled>Sold out</Button>;

  const max = Math.min(
    remaining,
    LIMITS.perFlavorMax,
    quantity + Math.max(0, LIMITS.perOrderMax - count),
  );

  if (quantity === 0) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          onClick={() =>
            max > 0 ? setQuantity(flavorId, 1) : setNote(`${LIMITS.perOrderMax} cookies per order`)
          }
        >
          Add
        </Button>
        {note && <p className="text-sm text-secondary">{note}</p>}
      </div>
    );
  }

  return (
    <Stepper
      label={name}
      value={String(quantity)}
      min={0}
      max={max}
      onChange={(next) => setQuantity(flavorId, Number(next || "0"))}
    />
  );
}
