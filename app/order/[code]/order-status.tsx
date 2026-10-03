"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";

type Status = "pending" | "paid" | "ready" | "picked_up" | "expired";

const tone = {
  pending: "neutral",
  paid: "success",
  ready: "success",
  picked_up: "success",
  expired: "warning",
} as const;

const headline = {
  pending: "Waiting on payment",
  paid: "You're all set",
  ready: "Ready for pickup",
  picked_up: "Picked up",
  expired: "This order expired",
} as const;

const EVERY_MS = 3_000;
const GIVE_UP_AFTER = 40; // about two minutes

// Stripe's webhook lands a moment after the customer gets here, so the page waits for it.
export function OrderStatus({ orderCode, initial }: { orderCode: string; initial: Status }) {
  const [status, setStatus] = useState<Status>(initial);
  const [waiting, setWaiting] = useState(initial === "pending");

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
          clearInterval(timer);
        }
      } catch {
        // A dropped request is fine; the next tick tries again.
      }
    }, EVERY_MS);

    return () => clearInterval(timer);
  }, [status, orderCode]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-4xl font-semibold">{headline[status]}</h1>
        <Badge tone={tone[status]} className="capitalize">
          {status.replace("_", " ")}
        </Badge>
      </div>
      <p className="mt-3 text-secondary">
        Order <span className="font-semibold text-primary tabular-nums">{orderCode}</span>
      </p>

      {status === "pending" && waiting && (
        <p className="mt-6 text-secondary" role="status">
          Waiting for Stripe. If you didn&apos;t finish paying, the cookies go back on the menu.
        </p>
      )}
      {status === "pending" && !waiting && (
        <p className="mt-6 text-secondary" role="status">
          Still not confirmed. If you paid, refresh in a minute. If you didn&apos;t, the cookies go back
          on the menu.
        </p>
      )}
      {(status === "paid" || status === "ready") && (
        <p className="mt-6 text-secondary">
          Check your email for this code. Look in spam if it&apos;s not there.
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
