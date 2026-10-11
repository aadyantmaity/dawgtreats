"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { CartNotices, EmptyCart, reconcile, useCart } from "@/components/cart";
import { track } from "@/lib/analytics/track";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/loading";
import { messageFromBody } from "@/lib/errors";
import type { MenuItem } from "@/lib/inventory";
import { formatCents } from "@/lib/money";
import { LIMITS, MESSAGES, emailError, formatPhoneInput, nameError, phoneError } from "@/lib/validation";

export type SlotChoice = {
  id: string;
  day: string;
  startsAt: string;
  spotsLeft: number;
};

const LOW_SPOTS = 2;

type Row = MenuItem & { quantity: number };

type Reserved = { orderCode: string; totalCents: number; reservedUntil: string; pickupStartsAt: string };

function isReserved(data: unknown): data is Reserved {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as Reserved).orderCode === "string" &&
    typeof (data as Reserved).totalCents === "number"
  );
}

// A dropdown hides most pickup times behind a tap. It also arrives with one already chosen.
function SlotPicker({
  slots,
  value,
  onChange,
  invalid,
}: {
  slots: SlotChoice[];
  value: string;
  onChange: (id: string) => void;
  invalid: boolean;
}) {
  const days = [...new Set(slots.map((slot) => slot.day))];

  return (
    <fieldset aria-invalid={invalid || undefined}>
      <legend className="sr-only">Pickup time</legend>
      {days.map((day) => (
        <div key={day} className="mt-4 first:mt-0">
          <p className="mb-2 text-sm text-secondary">{day}</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots
              .filter((slot) => slot.day === day)
              .map((slot) => {
                const full = slot.spotsLeft <= 0;
                return (
                  <label
                    key={slot.id}
                    className={`flex min-h-control cursor-pointer flex-col items-center justify-center rounded-control-sm border px-2 py-2 transition ease-spring has-checked:border-transparent has-checked:bg-action has-checked:text-on-action has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus ${
                      full
                        ? "cursor-default border-default bg-disabled text-disabled"
                        : "border-default bg-surface hover:bg-hover"
                    }`}
                  >
                    <input
                      type="radio"
                      name="pickup-slot"
                      value={slot.id}
                      checked={slot.id === value}
                      disabled={full}
                      onChange={() => onChange(slot.id)}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium whitespace-nowrap">{slot.startsAt}</span>
                    <span
                      className={`text-xs ${
                        full || slot.spotsLeft > LOW_SPOTS ? "text-tertiary" : "text-urgent"
                      }`}
                    >
                      {full ? "full" : `${slot.spotsLeft} ${slot.spotsLeft === 1 ? "spot" : "spots"}`}
                    </span>
                  </label>
                );
              })}
          </div>
        </div>
      ))}
    </fieldset>
  );
}

function OrderSummary({
  rows,
  total,
  className,
}: {
  rows: Row[];
  total: number;
  className: string;
}) {
  return (
    <Card title="Your order" className={className}>
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
  );
}

// On a phone the Pay button sits two screens below the last field. The bar goes flat
// until the form is ready, and the button in the form is the one that names the gaps.
function PayBar({
  count,
  total,
  ready,
  pending,
}: {
  count: number;
  total: number;
  ready: boolean;
  pending: boolean;
}) {
  return (
    <div className="fixed inset-x-6 bottom-6 z-40 sm:hidden">
      <div
        className={`flex h-fab items-center justify-between gap-3 rounded-pill pl-5 transition-colors ${
          ready ? "bg-action text-on-action shadow-lg" : "bg-disabled text-disabled"
        }`}
      >
        <span className="text-sm whitespace-nowrap">
          <span className="tabular-nums">{count}</span> {count === 1 ? "cookie" : "cookies"} ·{" "}
          {formatCents(total)}
        </span>
        <button
          type="submit"
          disabled={!ready}
          className={`inline-flex h-control shrink-0 items-center rounded-pill px-5 text-sm font-medium transition-colors ${
            ready ? "bg-page text-primary" : "bg-disabled text-disabled"
          }`}
        >
          {pending ? <Spinner className="size-4" /> : "Pay"}
        </button>
      </div>
    </div>
  );
}

export function CheckoutForm({
  menu,
  slots,
  slotMinutes,
  contact,
}: {
  menu: MenuItem[];
  slots: SlotChoice[];
  slotMinutes: number;
  contact: { name: string; email: string; phone: string };
}) {
  const { lines, count, clear } = useCart();
  const router = useRouter();
  const submitting = useRef(false);
  const leaving = useRef(false);

  useEffect(() => reconcile(menu), [menu]);

  useEffect(() => {
    // "No slot worked for me" and "I changed my mind" look identical without this.
    track("checkout_reached", slots.length === 0 ? "no slots" : undefined);
    // Once per visit to the page, not on every edit to the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [slotId, setSlotId] = useState("");
  const [name, setName] = useState(contact.name);
  const [email, setEmail] = useState(contact.email);
  const [phone, setPhone] = useState(formatPhoneInput(contact.phone));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [reserved, setReserved] = useState<Reserved | null>(null);
  const [touched, setTouched] = useState({ name: false, email: false, phone: false });
  const [seenSlots, setSeenSlots] = useState(slots);
  if (seenSlots !== slots) {
    setSeenSlots(slots);
    if (slotId && !slots.some((slot) => slot.id === slotId && slot.spotsLeft > 0)) setSlotId("");
  }
  const [attempt, setAttempt] = useState(0);

  const fieldErrors = {
    name: nameError(name),
    email: emailError(email),
    phone: phoneError(phone),
  };
  const incomplete = Object.values(fieldErrors).some(Boolean) || !slotId;
  // A field stays quiet until it is left or the form is submitted, then tracks every keystroke.
  const shown = (field: keyof typeof fieldErrors) =>
    touched[field] ? (fieldErrors[field] ?? undefined) : undefined;
  const touch = (field: keyof typeof fieldErrors) => () =>
    setTouched((was) => ({ ...was, [field]: true }));

  const open = slots.filter((slot) => slot.spotsLeft > 0);
  const slotRefused = attempt > 0 && !slotId;

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

  // One answer for both submit buttons. This one stays enabled while a field is empty,
  // because pressing it is how someone finds out which field that is.
  const blocked = pending || open.length === 0 || shortfalls.length > 0;

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
        // 409 means something was taken while this page sat open. The counts on screen
        // are now wrong, and the one that was taken may be the chosen one.
        if (response.status === 409) router.refresh();
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
        <EmptyCart buyable={menu.filter((item) => item.remaining !== 0).length} ordersOpen />
      </>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="mt-8 grid gap-6 pb-24 sm:pb-0 lg:grid-cols-3 lg:items-start"
    >
      <CartNotices className="mt-8 lg:col-span-2" />
      {/* Rendered twice: above the fields on a phone, beside them on a laptop. */}
      <OrderSummary rows={rows} total={total} className="lg:hidden" />

      <div className="flex flex-col gap-6 lg:col-span-2">
      <Card title="Pickup time">
        {open.length === 0 ? (
          <p className="text-secondary">Every pickup time is full. Try again later.</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-tertiary">
              Each pickup window is {slotMinutes} minutes long. All times are Pacific.
            </p>
            <SlotPicker slots={slots} value={slotId} onChange={setSlotId} invalid={Boolean(slotRefused)} />
            {slotRefused && (
              <p className="mt-3 text-sm text-error" role="alert">
                {MESSAGES.slotRequired}
              </p>
            )}
          </>
        )}
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

      </div>

      <div className="flex flex-col gap-6 lg:sticky lg:top-6">
      <OrderSummary rows={rows} total={total} className="max-lg:hidden" />
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

      <Button type="submit" size="md" disabled={blocked}>
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
      </div>

      <PayBar count={count} total={total} ready={!blocked && !incomplete} pending={pending} />
    </form>
  );
}
