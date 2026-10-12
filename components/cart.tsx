"use client";

import { IconPlus, IconShoppingBag, IconShoppingCart } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Button, buttonClass } from "@/components/ui/button";
import { useNavPill } from "@/components/nav-tabs";
import { Stepper } from "@/components/ui/stepper";
import { track } from "@/lib/analytics/track";
import { bump } from "@/lib/motion";
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

  // A line the menu no longer carries is dropped, and `dropped` makes sure that is written
  // back. Left in storage it counts towards the badge for ever and can never be paid for.
  let dropped = false;

  for (const line of state.lines) {
    const item = onMenu.get(line.flavorId);
    if (!item || item.remaining === 0) {
      if (item) notices.push(`${item.name} just sold out, so I removed it.`);
      else dropped = true;
      continue;
    }
    if (item.remaining !== null && item.remaining < line.quantity) {
      notices.push(`Only ${item.remaining} ${item.name} left, so I lowered your cart.`);
      lines.push({ flavorId: line.flavorId, quantity: item.remaining });
      continue;
    }
    lines.push(line);
  }

  if (notices.length > 0 || dropped) write(lines, notices);
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
        <p key={note} className="animate-rise text-urgent">
          {note}
        </p>
      ))}
    </div>
  );
}

export function CartLink({ variant = "filled" }: { variant?: "filled" | "tab" | "drawer" }) {
  const { count } = useCart();
  const pathname = usePathname();
  // In the tab row the pill behind says which page this is, the same as every other tab.
  // Standing alone on a phone there is no pill, so the fill has to say it instead.
  const asTab = variant === "tab";
  const inDrawer = variant === "drawer";
  const here = pathname === "/cart";
  const ref = useNavPill("/cart");

  const countRef = useRef<HTMLSpanElement>(null);
  const prevCount = useRef(count);
  useEffect(() => {
    // Only a rise is worth marking: a cookie removed is not news the badge has to announce.
    if (count > prevCount.current) bump(countRef.current, 1.5);
    prevCount.current = count;
  }, [count]);

  return (
    <Link
      ref={asTab ? ref : undefined}
      href="/cart"
      aria-label={count === 0 ? "Cart, empty" : `Cart, ${count} ${count === 1 ? "cookie" : "cookies"}`}
      aria-current={here ? "page" : undefined}
      className={
        asTab
          ? `relative inline-flex shrink-0 items-center gap-2 rounded-pill px-3 py-1.5 text-sm whitespace-nowrap transition-colors ease-spring ${
              here ? "text-on-action" : "text-secondary hover:text-primary"
            }`
          : inDrawer
            ? `flex h-control items-center gap-3 rounded-pill px-4 text-base transition-colors ease-spring ${
                here
                  ? "bg-action text-on-action"
                  : "text-secondary hover:bg-subtle hover:text-primary"
              }`
            : "inline-flex h-control shrink-0 items-center gap-2 rounded-pill bg-action px-4 text-sm font-medium text-on-action transition-colors hover:bg-action/90"
      }
    >
      {/* In the bar every other tab is a picture and a word, and the cart's word is the
          number. The drawer is a list of names, so there it says its own. */}
      <IconShoppingCart
        aria-hidden
        className={asTab || inDrawer ? "nav-icon size-4 shrink-0" : "size-5 shrink-0"}
      />
      {inDrawer && "Cart"}
      {count > 0 && (
        <span ref={countRef} className="tabular-nums">
          {count}
        </span>
      )}
    </Link>
  );
}

// An emptied cart is a dead end without a way back to the menu. The cart and the
// checkout both need one.
export function EmptyCart({ ordersOpen }: { ordersOpen: boolean }) {
  return (
    <div className="mt-8 flex flex-col items-center rounded-card border border-default bg-surface px-5 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-pill bg-disabled text-secondary">
        <IconShoppingBag aria-hidden className="size-6" />
      </span>
      <p className="mt-3 text-lg font-semibold">Nothing in here yet</p>
      {/* Open, the button below already says what to do. Shut is news, and it is the only
          reason an empty cart is not the person's own doing. */}
      {!ordersOpen && (
        <p className="mt-1 text-secondary">Orders are closed right now. New batch most weeks.</p>
      )}
      <Link href="/" className={`${buttonClass({ size: "md" })} mt-5`}>
        {ordersOpen ? "See this week's bake" : "Back to the menu"}
      </Link>
    </div>
  );
}

// Nothing here is for sale, so this is not styled as a buyable button. It only records
// that someone wanted the flavor.
function SoldOutInterest({ name }: { name: string }) {
  const [sent, setSent] = useState(false);

  return (
    <div className="flex flex-col items-end gap-1">
      {/* The reply must stay on one line: a second line makes this card taller than the
          one beside it, and the grid aligns the two at the top. */}
      {sent ? (
        <p className="animate-fade flex min-h-control items-center text-sm text-secondary">
          Noted that you wanted this
        </p>
      ) : (
        <button
          type="button"
          onClick={() => {
            setSent(true);
            track("sold_out_wanted", name);
          }}
          className="inline-flex min-h-control items-center text-sm text-secondary underline hover:text-primary"
        >
          I wanted this
        </button>
      )}
    </div>
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
  if (remaining === 0) return <SoldOutInterest name={name} />;

  const max = Math.min(
    remaining,
    LIMITS.perFlavorMax,
    quantity + Math.max(0, LIMITS.perOrderMax - count),
  );

  if (quantity === 0) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          onClick={() => {
            if (max === 0) return setNote(`${LIMITS.perOrderMax} cookies per order`);
            setQuantity(flavorId, 1);
            // The flavor name carries no personal detail; nothing here identifies anyone.
            track("add_to_cart", name);
          }}
        >
          <IconPlus aria-hidden className="size-4" />
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
