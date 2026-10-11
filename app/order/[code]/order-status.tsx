"use client";

import { useEffect, useState } from "react";

import { Spinner } from "@/components/ui/loading";

type Status = "pending" | "paid" | "ready" | "picked_up" | "expired";

const headline = {
  pending: "Waiting on payment",
  paid: "You're all set",
  ready: "Ready for pickup",
  picked_up: "Picked up",
  expired: "This order expired",
} as const;

// "Ready" names what the customer can do. The cookies are baked hours earlier.
const STEPS = ["Ordered", "Paid", "Ready", "Picked up"] as const;

// An expired order left the track, so it has no step.
const REACHED: Record<Status, number | null> = {
  pending: 0,
  paid: 1,
  ready: 2,
  picked_up: 3,
  expired: null,
};

const EVERY_MS = 3_000;
const GIVE_UP_AFTER = 40; // about two minutes

function Progress({ status }: { status: Status }) {
  const reached = REACHED[status];
  if (reached === null) return null;

  return (
    <ol className="mt-6 flex items-start">
      {STEPS.map((step, index) => {
        const done = index <= reached;
        const next = index === reached + 1;
        return (
          <li
            key={step}
            aria-current={index === reached ? "step" : undefined}
            className={`relative flex flex-1 flex-col items-center gap-1.5 px-1 text-center text-xs ${
              index === reached
                ? "font-semibold text-primary"
                : done
                  ? "text-secondary"
                  : "text-tertiary"
            }`}
          >
            {/* The dots sit on top of the track, so a line never crosses a dot. */}
            {index > 0 && (
              <span aria-hidden className="absolute top-3 left-0 right-1/2 border-t border-default" />
            )}
            {index < STEPS.length - 1 && (
              <span aria-hidden className="absolute top-3 left-1/2 right-0 border-t border-default" />
            )}
            <span
              className={`relative flex size-6 items-center justify-center rounded-pill border ${
                done
                  ? "border-transparent bg-action text-on-action"
                  : next
                    ? "border-focus bg-surface"
                    : "border-default bg-surface"
              }`}
            >
              {done && (
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.2}
                  aria-hidden
                  className="size-3"
                >
                  <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            {step}
          </li>
        );
      })}
    </ol>
  );
}

// Stripe's webhook lands a moment after the customer gets here, so the page waits for it.
export function OrderStatus({ orderCode, initial }: { orderCode: string; initial: Status }) {
  const [status, setStatus] = useState<Status>(initial);
  const [waiting, setWaiting] = useState(initial === "pending");
  // Payment landing is only news to someone who watched it land. An order that was already
  // paid when the page opened gets the page fade and nothing more.
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    if (status !== "pending") return;

    let tries = 0;
    const timer = setInterval(async () => {
      tries++;
      if (tries > GIVE_UP_AFTER) {
        clearInterval(timer);
        setWaiting(false);
        return;
      }
      try {
        const response = await fetch(`/api/orders/${orderCode}`, { cache: "no-store" });
        if (!response.ok) return;
        const data: unknown = await response.json();
        const next =
          data && typeof data === "object" && "status" in data ? (data.status as Status) : null;
        if (next && next !== "pending") {
          setStatus(next);
          setWaiting(false);
          setLanded(true);
          clearInterval(timer);
        }
      } catch {
        // A dropped request is fine; the next tick tries again.
      }
    }, EVERY_MS);

    return () => clearInterval(timer);
  }, [status, orderCode]);

  // A collected or expired order has nothing left to show at the table.
  const holdUp = status === "paid" || status === "ready";

  return (
    <>
      <div className={landed ? "animate-rise" : ""}>
        <h1 className="text-3xl font-semibold">{headline[status]}</h1>
      </div>
      <Progress status={status} />

      {holdUp ? (
        <div
          className={`mt-6 rounded-card border border-default bg-surface p-5 text-center ${landed ? "animate-rise" : ""}`}
        >
          <p className="text-xs uppercase tracking-widest text-tertiary">Show this at pickup</p>
          <p className="mt-1 font-display text-5xl font-bold tracking-wider tabular-nums">
            {orderCode}
          </p>
          <p className="mt-2 text-sm text-tertiary">
            It&apos;s in your email too. Look in spam if it isn&apos;t there.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-secondary">
          Order <span className="font-semibold text-primary tabular-nums">{orderCode}</span>
        </p>
      )}

      {status === "pending" && waiting && (
        <p className="mt-6 flex items-start gap-3 text-secondary" role="status">
          <Spinner className="mt-1 size-4 shrink-0" />
          <span>
            Waiting for Stripe. If you didn&apos;t finish paying, the cookies go back on the menu.
          </span>
        </p>
      )}
      {status === "pending" && !waiting && (
        <p className="mt-6 text-secondary" role="status">
          Still not confirmed. If you paid, refresh in a minute. If you didn&apos;t, the cookies go back
          on the menu.
        </p>
      )}
      {status === "expired" && (
        <p className="mt-6 text-secondary">
          The hold ran out. Those cookies are back on the menu.
        </p>
      )}
    </>
  );
}
