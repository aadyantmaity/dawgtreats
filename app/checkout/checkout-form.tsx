"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { CartNotices, reconcile, useCart } from "@/components/cart";
import { track } from "@/lib/analytics/track";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/loading";
import { Select, type SelectOption } from "@/components/ui/select";
import { messageFromBody } from "@/lib/errors";
import type { MenuItem } from "@/lib/inventory";
import { formatCents } from "@/lib/money";
import { LIMITS, emailError, formatPhoneInput, nameError, phoneError } from "@/lib/validation";

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

export function CheckoutForm({
  menu,
  slots,
  contact,
}: {
  menu: MenuItem[];
  slots: SlotChoice[];
  contact: { name: string; email: string; phone: string };
}) {
  const { lines, count, clear } = useCart();
  const submitting = useRef(false);
  const leaving = useRef(false);

  useEffect(() => reconcile(menu), [menu]);

  useEffect(() => {
    // "No slot worked for me" and "I changed my mind" look identical without this.
    track("checkout_reached", slots.length === 0 ? "no slots" : undefined);
    // Once per visit to the page, not on every edit to the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [slotId, setSlotId] = useState(slots[0]?.id ?? "");
  const [name, setName] = useState(contact.name);
  const [email, setEmail] = useState(contact.email);
  const [phone, setPhone] = useState(formatPhoneInput(contact.phone));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [reserved, setReserved] = useState<Reserved | null>(null);
  const [touched, setTouched] = useState({ name: false, email: false, phone: false });
  const [attempt, setAttempt] = useState(0);

  const fieldErrors = {
    name: nameError(name),
    email: emailError(email),
    phone: phoneError(phone),
  };
  const incomplete = Object.values(fieldErrors).some(Boolean);
  // A field stays quiet until it is left or the form is submitted, then tracks every keystroke.
  const shown = (field: keyof typeof fieldErrors) =>
    touched[field] ? (fieldErrors[field] ?? undefined) : undefined;
  const touch = (field: keyof typeof fieldErrors) => () =>
    setTouched((was) => ({ ...was, [field]: true }));

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
    // React state updates aren't synchronous, so a second click can fire before the
    // disabled button re-renders. `submitting` is a ref, so it blocks that click right away.
    if (submitting.current) return;
    submitting.current = true;
    // Cleared before the validation return, so a refused submit also drops the last message.
    setError(null);
    setAttempt((was) => was + 1);
    setTouched({ name: true, email: true, phone: true });
    if (incomplete) {
      submitting.current = false;
      return;
    }
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
        setError(messageFromBody(data, `Checkout failed (${response.status})`));
        return;
      }
      if (data && typeof data === "object" && "url" in data && typeof data.url === "string") {
        clear();
        // Stay locked: assigning location does not stop this component, so clearing the
        // lock now would re-enable the button while Stripe's page is still loading.
        leaving.current = true;
        window.location.assign(data.url);
        return;
      }
      if (isReserved(data)) {
        clear();
        setReserved(data);
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      if (!leaving.current) {
        setPending(false);
        submitting.current = false;
      }
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
          <Link href="/" className="inline-flex min-h-control items-center underline">
            Back to the menu
          </Link>
        </div>
      </Card>
    );
  }

  // Rendered in both states: an emptied cart is exactly when someone needs telling why.

  if (rows.length === 0) {
    return (
      <>
        <CartNotices className="mt-8" />
        <p className="mt-3 text-secondary">Your cart is empty.</p>
        <Link href="/" className="mt-4 inline-flex min-h-control items-center underline">
          Back to the menu
        </Link>
      </>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="mt-8 flex flex-col gap-6">
      <CartNotices className="mt-8" />
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
              label: `${slot.label} · ${slot.spotsLeft} ${slot.spotsLeft === 1 ? "spot" : "spots"} left`,
            }))}
            onChange={setSlotId}
          />
        )}
        {slots.length > 0 && <p className="mt-2 text-sm text-tertiary">All times Pacific.</p>}
      </Card>

      <Card title="Where to find you">
        <div className="flex flex-col gap-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={touch("name")}
            error={shown("name")}
            attempt={attempt}
            placeholder="Alex Rivera"
            autoComplete="name"
            maxLength={LIMITS.nameMax}
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={touch("email")}
            error={shown("email")}
            attempt={attempt}
            autoComplete="email"
            maxLength={120}
            hint="We&apos;ll send your order code here."
          />
          <Input
            label="Phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
            onBlur={touch("phone")}
            error={shown("phone")}
            attempt={attempt}
            autoComplete="tel"
            inputMode="tel"
            placeholder="(425) 555-0142"
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
          <Link href="/cart" className="inline-flex min-h-control items-center underline">
            Back to the cart
          </Link>
        </div>
      )}

      {/* A role="alert" already on the page can go unannounced, so the paragraph mounts with the refusal. */}
      {error && (
        <p role="alert" className="animate-rise text-error">
          {error}
        </p>
      )}

      <Button
        type="submit"
        size="md"
        disabled={pending || slots.length === 0 || shortfalls.length > 0}
      >
        {pending ? (
          <span className="inline-flex items-center gap-2">
            <Spinner className="size-4" />
            Taking you to payment…
          </span>
        ) : (
          `Pay for ${count} cookies`
        )}
      </Button>

      <p className="text-sm text-tertiary">
        Your cookies are held for 30 minutes once you press Pay. Max {LIMITS.perOrderMax} per order. No
        refunds or cancellations.
      </p>
    </form>
  );
}
