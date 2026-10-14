"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { CartNotices, EmptyCart, reconcile, useCart } from "@/components/cart";
import { track } from "@/lib/analytics/track";
import { Button } from "@/components/ui/button";
import { SignInWithGoogle } from "@/components/sign-in";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/loading";
import { Message } from "@/components/ui/message";
import { messageFromBody } from "@/lib/errors";
import type { MenuItem } from "@/lib/inventory";
import { DEAL_CENTS, DEAL_SIZE, formatCents, priceOrder } from "@/lib/money";
import { LIMITS, MESSAGES, emailError, formatPhoneInput, nameError, phoneError } from "@/lib/validation";
import { IconCalendarX, IconLock } from "@tabler/icons-react";

export type SlotChoice = {
  id: string;
  day: string;
  /** The whole window, both ends, as "12:00\u201312:30 PM". */
  window: string;
  spotsLeft: number;
};

const LOW_SPOTS = 2;

type Row = MenuItem & { quantity: number };

// A dropdown hides most pickup times behind a tap. It also arrives with one already chosen.
function SlotPicker({
  slots,
  value,
  onChange,
  invalid,
  errorId,
}: {
  slots: SlotChoice[];
  value: string;
  onChange: (id: string) => void;
  invalid: boolean;
  errorId: string;
}) {
  const days = [...new Set(slots.map((slot) => slot.day))];

  return (
    // The refusal is a sibling of this group, so the group has to point at it: otherwise
    // someone who moves back to the times never hears why they were refused.
    <fieldset aria-invalid={invalid || undefined} aria-describedby={invalid ? errorId : undefined}>
      <legend className="sr-only">Pickup time</legend>
      {days.map((day) => (
        <div key={day} className="mt-4 first:mt-0">
          <p className="mb-2 text-sm text-secondary">{day}</p>
          {/* A window needs both its ends and a meridiem, which measures 102px. Three across
              on a phone leaves 61px for it and four on a laptop leaves 107px, and a chip
              that wraps is a chip taller than the one beside it. */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {slots
              .filter((slot) => slot.day === day)
              .map((slot) => {
                const full = slot.spotsLeft <= 0;
                return (
                  <label
                    key={slot.id}
                    className={`group flex min-h-control cursor-pointer flex-col items-center justify-center rounded-control-sm border px-1 py-2 transition ease-spring sm:px-2 has-checked:border-transparent has-checked:bg-action has-checked:text-on-action has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus ${
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
                    <span className="text-xs font-medium min-[360px]:text-sm">{slot.window}</span>
                    {/* The count sets its own colour, so on the chosen chip it would stay
                        grey on ink. Chosen wins. */}
                    <span
                      className={`text-xs group-has-checked:text-on-action ${
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
  saved,
  sets,
  className,
}: {
  rows: Row[];
  total: number;
  saved: number;
  sets: number;
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
      {saved > 0 && (
        <div className="mt-2 flex justify-between gap-4 text-sm text-success">
          <span>
            {DEAL_SIZE} for {formatCents(DEAL_CENTS)}
            {sets > 1 ? ` × ${sets}` : ""}
          </span>
          <span className="tabular-nums">−{formatCents(saved)}</span>
        </div>
      )}
      <div className="mt-3 flex justify-between border-t border-default pt-3 font-semibold">
        <span>Total</span>
        <span className="tabular-nums">{formatCents(total)}</span>
      </div>
    </Card>
  );
}

// On a phone this is the only Pay there is. It goes flat until the form is ready, but it
// still presses: a dead button is a dead end, and submitting is what names the gaps.
function PayBar({
  count,
  total,
  ready,
  blocked,
  pending,
}: {
  count: number;
  total: number;
  ready: boolean;
  blocked: boolean;
  pending: boolean;
}) {
  return (
    <div className="fixed inset-x-6 bottom-6 z-40 sm:hidden">
      {/* The inner pill is 12px shorter than the bar, so the padding that keeps it off the
          right edge is half that: any less and it rides over the bar's own curve. */}
      <div
        className={`flex h-fab items-center justify-between gap-3 rounded-pill pr-1.5 pl-5 transition-colors ${
          ready ? "bg-action text-on-action shadow-lg" : "bg-disabled text-disabled"
        }`}
      >
        {/* The count moved into the button beside it, so this says the money and nothing else. */}
        <span className="text-sm tabular-nums whitespace-nowrap">{formatCents(total)}</span>
        <button
          type="submit"
          disabled={blocked}
          className={`inline-flex h-control shrink-0 items-center gap-2 rounded-pill px-4 text-sm font-medium whitespace-nowrap transition-colors ${
            ready ? "bg-page text-primary" : "bg-disabled text-disabled"
          }`}
        >
          {pending ? (
            <Spinner className="size-4" />
          ) : (
            <>
              <IconLock aria-hidden className="size-4" />
              Pay for {count} {count === 1 ? "cookie" : "cookies"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export function CheckoutForm({
  menu,
  slots,
  zone,
  contact,
  signedIn,
}: {
  menu: MenuItem[];
  slots: SlotChoice[];
  zone: string;
  contact: { name: string; email: string; phone: string };
  signedIn: boolean;
}) {
  const { lines, count, clear } = useCart();
  const router = useRouter();
  const submitting = useRef(false);
  const slotErrorId = useId();
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
  const empty = { name: !name.trim(), email: !email.trim(), phone: !phone.trim() };
  // An empty field says it is required from the start, the same as the pickup times do.
  // A half-typed one is a different matter: it waits to be left before it complains about
  // the shape of what is there.
  const shown = (field: keyof typeof fieldErrors) =>
    touched[field] || empty[field] ? (fieldErrors[field] ?? undefined) : undefined;
  const touch = (field: keyof typeof fieldErrors) => () =>
    setTouched((was) => ({ ...was, [field]: true }));

  const open = slots.filter((slot) => slot.spotsLeft > 0);
  const slotRefused = attempt > 0 && !slotId;

  const onMenu = new Map(menu.map((item) => [item.id, item]));
  const rows = lines.flatMap((line) => {
    const item = onMenu.get(line.flavorId);
    return item ? [{ ...item, quantity: line.quantity }] : [];
  });
  const deal = priceOrder(
    rows.map((row) => ({ name: row.name, quantity: row.quantity, unitPriceCents: row.priceCents })),
  );
  const total = deal.totalCents;
  const shortfalls = rows.flatMap((row) =>
    row.remaining !== null && row.quantity > row.remaining
      ? [`${row.name}: only ${row.remaining} left. Lower it in your cart to continue.`]
      : [],
  );
  // The server refuses a cart over the per-order cap, so the page must refuse it first and
  // say by how much. Otherwise Pay is pressable and answers with a 400 and no way forward.
  const overCap = count > LIMITS.perOrderMax;
  if (overCap) {
    shortfalls.push(
      `${count} cookies is over the ${LIMITS.perOrderMax} per order. Remove ${count - LIMITS.perOrderMax} in your cart to continue.`,
    );
  }

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
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      if (!leaving.current) {
        setPending(false);
        submitting.current = false;
      }
    }
  }

  // Rendered in both states: an emptied cart is exactly when someone needs telling why.
  if (rows.length === 0) {
    return (
      <>
        <CartNotices className="mt-8 empty:mt-0" />
        <EmptyCart ordersOpen />
      </>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="mt-8 grid gap-6 pb-24 sm:pb-0 lg:grid-cols-3 lg:items-start"
    >
      <CartNotices className="order-1 mt-8 empty:mt-0 lg:col-span-2" />
      {/* Rendered twice: above the fields on a phone, beside them on a laptop. */}
      <OrderSummary rows={rows} total={total} saved={deal.savedCents} sets={deal.sets} className="order-2 lg:hidden" />

      <Card title="Pickup time" className="order-3 lg:col-span-2">
        {open.length === 0 ? (
          <p className="flex items-start gap-2 text-secondary">
            <IconCalendarX aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>Every pickup time is full. Try again later.</span>
          </p>
        ) : (
          <>
            <p className="mb-4 text-sm text-tertiary">
              All times are {zone}.
            </p>
            <SlotPicker
              slots={slots}
              value={slotId}
              onChange={setSlotId}
              invalid={Boolean(slotRefused)}
              errorId={slotErrorId}
            />
            {/* A group of radios is never left, so a blur cannot bring this on the way the
                contact fields get theirs. It stands from the start, quiet, and turns into
                a refusal once Pay has been pressed. */}
            {!slotId && (
              <p
                id={slotErrorId}
                className="mt-3 text-sm text-error"
                // Only a refusal interrupts a screen reader. On arrival this is a label.
                role={slotRefused ? "alert" : undefined}
              >
                {MESSAGES.slotRequired}
              </p>
            )}
          </>
        )}
      </Card>

      <Card title="Where to find you" className="order-4 lg:order-5 lg:col-span-2">
        <div className="flex flex-col gap-4">
          <Input
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={touch("name")}
            error={shown("name")}
            invalid={Boolean(fieldErrors.name) && (touched.name || attempt > 0)}
            attempt={attempt}
            placeholder="Alex Rivera"
            autoComplete="name"
            maxLength={LIMITS.nameMax}
          />
          <Input
            label="Email"
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={touch("email")}
            error={shown("email")}
            invalid={Boolean(fieldErrors.email) && (touched.email || attempt > 0)}
            attempt={attempt}
            autoComplete="email"
            maxLength={LIMITS.emailMax}
            placeholder="alex@uw.edu"
            hint="I&apos;ll send your order code here."
          />
          <Input
            label="Phone"
            required
            type="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
            onBlur={touch("phone")}
            error={shown("phone")}
            invalid={Boolean(fieldErrors.phone) && (touched.phone || attempt > 0)}
            attempt={attempt}
            autoComplete="tel"
            inputMode="tel"
            placeholder="(425) 555-0142"
          />
        </div>
      </Card>

      {/* Last on a phone, where the sticky bar already carries Pay, and beside the pickup
          card on a laptop. */}
      <div className="order-6 flex flex-col gap-6 lg:order-4">
      <OrderSummary rows={rows} total={total} saved={deal.savedCents} sets={deal.sets} className="max-lg:hidden" />
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
        <Message tone="error" className="animate-rise">
          {error}
        </Message>
      )}

      <Button
        type="submit"
        size="md"
        variant={!blocked && !incomplete ? "primary" : "muted"}
        disabled={blocked}
        className="max-sm:hidden"
      >
        {pending ? (
          <span className="inline-flex items-center gap-2">
            <Spinner className="size-4" />
            Taking you to payment…
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <IconLock aria-hidden className="size-4" />
            Pay for {count} {count === 1 ? "cookie" : "cookies"}
          </span>
        )}
      </Button>

      <p className="text-sm text-tertiary">No refunds or cancellations.</p>

      </div>

      {/* An aside to the checkout, never a step in it: beside the fields it would fill on a
          laptop, and before Pay on a phone. Signing in leaves the page, so the cart lives in
          storage and comes back. */}
      {!signedIn && (
        <div className="order-5 rounded-card border border-default bg-surface p-5 lg:order-6">
          <p className="font-medium">Make an account</p>
          <p className="mt-1 text-sm text-secondary">
            Then every order you place is listed on the orders page.
          </p>
          <div className="mt-4">
            <SignInWithGoogle next="/checkout" />
          </div>
        </div>
      )}

      <PayBar count={count} total={total} ready={!blocked && !incomplete} blocked={blocked} pending={pending} />
    </form>
  );
}
