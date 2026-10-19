"use client";

import { IconPlus, IconShoppingBag, IconShoppingCart } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Button, buttonClass } from "@/components/ui/button";
import { NAV_DRAWER_ROW, NAV_TAB } from "@/components/nav-chrome";
import { useNavPill } from "@/components/nav-tabs";
import { Stepper } from "@/components/ui/stepper";
import { track } from "@/lib/analytics/track";
import { formatCents } from "@/lib/money";
import { bump } from "@/lib/motion";
import { LIMITS, cartLimit } from "@/lib/validation";

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

  // A cart held in storage from when the cap was higher arrives over it. Left alone the
  // stepper shows a number above its own ceiling and the checkout refuses the whole order.
  let total = lines.reduce((sum, line) => sum + line.quantity, 0);
  if (total > LIMITS.perOrderMax) {
    notices.push(`${LIMITS.perOrderMax} cookies per order, so I lowered your cart.`);
    // The earliest choices were the deliberate ones, so the last flavors added give way first.
    for (let index = lines.length - 1; index >= 0 && total > LIMITS.perOrderMax; index--) {
      const give = Math.min(lines[index].quantity, total - LIMITS.perOrderMax);
      lines[index] = { ...lines[index], quantity: lines[index].quantity - give };
      total -= give;
    }
  }

  const kept = lines.filter((line) => line.quantity > 0);
  if (notices.length > 0 || dropped) write(kept, notices);
}

export function useCart() {
  const { lines, notices } = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_STATE);

  return {
    lines,
    notices,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    quantityOf: (flavorId: string) => lines.find((line) => line.flavorId === flavorId)?.quantity ?? 0,
    // A line keeps its place in the cart. Rewriting it to the end moved the row out from
    // under the finger that had just pressed it, because the cart renders in this order.
    setQuantity: (flavorId: string, quantity: number) => {
      if (quantity <= 0) return write(lines.filter((line) => line.flavorId !== flavorId));
      const held = lines.some((line) => line.flavorId === flavorId);
      write(
        held
          ? lines.map((line) => (line.flavorId === flavorId ? { flavorId, quantity } : line))
          : [...lines, { flavorId, quantity }],
      );
    },
    // Several flavors in one write. Calling setQuantity once per flavor rebuilds the cart
    // from this render's lines every time, so each call undoes the one before it and only
    // the last flavor survives.
    addMany: (picks: { flavorId: string; quantity: number }[]) => {
      const next = lines.map((line) => ({ ...line }));
      for (const pick of picks) {
        if (pick.quantity <= 0) continue;
        const held = next.find((line) => line.flavorId === pick.flavorId);
        if (held) held.quantity += pick.quantity;
        else next.push({ flavorId: pick.flavorId, quantity: pick.quantity });
      }
      write(next);
    },
    clear: () => write(EMPTY),
  };
}

// Shown wherever a cart is rendered, including when reconcile emptied it: that is
// exactly the moment someone needs telling what happened to their cookies.
export function CartNotices({ className = "" }: { className?: string }) {
  const { notices } = useCart();

  return (
    // The region is on the page from the first render, empty. A live region that arrives
    // in the same commit as its text is announced by nothing, and this is the message that
    // has to be heard: it says stock moved and the cart was lowered to match.
    // Placement sits on the region itself, because the grid places this element and a
    // caller's column span has to reach it. Spacing stays on the inner box, so an empty
    // region still takes up no room of its own.
    <div role="status" className={className}>
      {notices.length > 0 && (
        <div className="flex flex-col gap-1">
          {notices.map((note) => (
            <p key={note} className="animate-rise text-urgent">
              {note}
            </p>
          ))}
        </div>
      )}
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
          ? `${NAV_TAB} ${here ? "text-on-action" : "text-secondary hover:text-primary"}`
          : inDrawer
            ? `${NAV_DRAWER_ROW} ${
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
        className={asTab || inDrawer ? "nav-icon size-4 shrink-0 bigmark:size-5 sm:size-4" : "size-5 shrink-0"}
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
  priceCents,
  remaining,
}: {
  flavorId: string;
  name: string;
  priceCents: number;
  remaining: number | null;
}) {
  const { count, quantityOf, setQuantity } = useCart();
  const [note, setNote] = useState<string | null>(null);
  const quantity = quantityOf(flavorId);

  if (remaining === null) return null;
  if (remaining === 0) return <SoldOutInterest name={name} />;

  // Three things can stop another cookie, and the one that binds is the one to name.
  // Deriving the ceiling here instead let the menu blame the per-order cap for a flavor
  // that had simply run low.
  const limit = cartLimit({ quantity, remaining }, count);

  // Beside the cookie on a phone the button has a column of its own, so it takes the
  // width. In a row of its own it does not.
  if (quantity === 0) {
    return (
      <div className="flex w-full flex-col items-stretch gap-1 sm:w-auto sm:items-end">
        <Button
          className="w-full sm:w-auto"
          onClick={() => {
            if (limit.max === 0) return setNote(limit.reached);
            setQuantity(flavorId, 1);
            // The flavor name carries no personal detail; nothing here identifies anyone.
            track("add_to_cart", name);
          }}
        >
          <IconPlus aria-hidden className="size-4" />
          {/* One span, so the button's own gap only separates the mark from the words and
              the price stays attached to what it is the price of. */}
          <span>
            Add <span aria-hidden className="text-on-action/50">&middot;</span>{" "}
            <span className="tabular-nums">{formatCents(priceCents)}</span>
          </span>
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
      max={limit.max}
      onChange={(next) => setQuantity(flavorId, Number(next || "0"))}
    />
  );
}
