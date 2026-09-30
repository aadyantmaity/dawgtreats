"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { useCart } from "@/components/cart";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import type { MenuItem } from "@/lib/inventory";
import { formatCents } from "@/lib/money";
import { LIMITS } from "@/lib/validation";

export type SlotChoice = { id: string; label: string; spotsLeft: number };

type Reserved = { orderCode: string; totalCents: number; reservedUntil: string; pickupStartsAt: string };

function isReserved(data: unknown): data is Reserved {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as Reserved).orderCode === "string" &&
    typeof (data as Reserved).totalCents === "number"
  );
}

export function CheckoutForm({ menu, slots }: { menu: MenuItem[]; slots: SlotChoice[] }) {
  const { lines, count, clear } = useCart();
  const [slotId, setSlotId] = useState(slots[0]?.id ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [reserved, setReserved] = useState<Reserved | null>(null);

  const onMenu = new Map(menu.map((item) => [item.id, item]));
  const rows = lines.flatMap((line) => {
    const item = onMenu.get(line.flavorId);
    return item ? [{ ...item, quantity: line.quantity }] : [];
  });
  const total = rows.reduce((sum, row) => sum + row.priceCents * row.quantity, 0);
  const shortfalls = rows.flatMap((row) =>
    row.remaining !== null && row.quantity > row.remaining
      ? [`${row.name}: only ${row.remaining} left. Lower it in your cart to continue.`]
      : [],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          pickupSlotId: slotId,
          items: rows.map((row) => ({ flavorId: row.id, quantity: row.quantity })),
        }),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : `Checkout failed (${response.status})`;
        setError(message);
        return;
      }
      if (isReserved(data)) {
        clear();
        setReserved(data);
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (reserved) {
    return (
      <Card title="Your cookies are held" className="mt-8">
        <div className="flex flex-col gap-3">
          <p className="text-secondary">
            Order code <span className="font-semibold text-primary tabular-nums">{reserved.orderCode}</span>
          </p>
          <p className="text-secondary">
            Total {formatCents(reserved.totalCents)} · held until{" "}
            {new Date(reserved.reservedUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </p>
          <p className="text-sm text-tertiary">
            Card payment arrives in the next step of the build. Until then this order stays unpaid and its
            cookies are released when the hold expires.
          </p>
          <Link href="/" className="underline">
            Back to the menu
          </Link>
        </div>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <>
        <p className="mt-8 text-secondary">Your cart is empty.</p>
        <Link href="/" className="mt-6 inline-block underline">
          Back to the menu
        </Link>
      </>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="mt-8 flex flex-col gap-6">
      <Card title="Your order">
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.id} className="flex justify-between gap-4">
              <span>
                {row.quantity} × {row.name}
              </span>
              <span className="tabular-nums">{formatCents(row.priceCents * row.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-default pt-3 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatCents(total)}</span>
        </div>
      </Card>

      <Card title="Pickup time">
        {slots.length === 0 ? (
          <p className="text-secondary">Every pickup time is full. Try again later.</p>
        ) : (
          <Select
            label="Pickup slot"
            value={slotId}
            options={slots.map<SelectOption<string>>((slot) => ({
              value: slot.id,
              label: `${slot.label} · ${slot.spotsLeft} left`,
            }))}
            onChange={setSlotId}
          />
        )}
      </Card>

      <Card title="Where to find you">
        <div className="flex flex-col gap-4">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            hint="Your order code goes here."
          />
          <Input
            label="Phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />
        </div>
      </Card>

      {shortfalls.length > 0 && (
        <div className="flex flex-col gap-2" role="status">
          {shortfalls.map((note) => (
            <p key={note} className="text-urgent">
              {note}
            </p>
          ))}
          <Link href="/cart" className="underline">
            Back to the cart
          </Link>
        </div>
      )}

      {error && <p className="text-error">{error}</p>}

      <Button
        type="submit"
        size="md"
        disabled={pending || slots.length === 0 || shortfalls.length > 0}
      >
        {pending ? "Holding your cookies…" : `Reserve ${count} cookies`}
      </Button>

      <p className="text-sm text-tertiary">
        Cookies are held for 30 minutes. Pickup only, Saturday or Sunday. All sales are final — no refunds
        or cancellations. {LIMITS.perOrderMax} cookies per order.
      </p>
    </form>
  );
}
