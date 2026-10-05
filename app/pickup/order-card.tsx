"use client";

import { useState, useTransition } from "react";

import { pickedUpAction, readyAction, undoAction } from "@/app/pickup/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/loading";
import { formatPhone } from "@/lib/validation";

type Order = {
  id: string;
  orderCode: string;
  status: "paid" | "ready" | "picked_up";
  name: string;
  phone: string | null;
  cookieCount: number;
  lines: { name: string; quantity: number }[];
};

const tone = { paid: "neutral", ready: "warning", picked_up: "success" } as const;
const label = { paid: "to bag", ready: "ready", picked_up: "picked up" } as const;

export function OrderCard({ order }: { order: Order }) {
  const [pending, startTransition] = useTransition();
  // Remembers which button was pressed, so only that one shows the wait.
  const [running, setRunning] = useState<string | null>(null);
  const run = (name: string, action: (id: string) => Promise<void>) => () => {
    setRunning(name);
    startTransition(async () => {
      await action(order.id);
      setRunning(null);
    });
  };

  return (
    <li
      className={`flex flex-col gap-3 p-5 transition-opacity sm:flex-row sm:items-center sm:gap-5 ${
        order.status === "picked_up" ? "opacity-60" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold tabular-nums">{order.orderCode}</span>
          <Badge tone={tone[order.status]}>{label[order.status]}</Badge>
        </div>
        <p className="mt-1 font-medium">{order.name}</p>
        <p className="text-sm text-secondary">
          {order.lines.map((line) => `${line.quantity} × ${line.name}`).join(", ")}
        </p>
        {order.phone && (
          <a href={`tel:${order.phone}`} className="text-sm text-secondary underline">
            {formatPhone(order.phone)}
          </a>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        {order.status === "paid" && (
          <Button variant="secondary" onClick={run("ready", readyAction)} disabled={pending}>
            {running === "ready" ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="size-4" />
                Bagged
              </span>
            ) : (
              "Bagged"
            )}
          </Button>
        )}
        {order.status !== "picked_up" && (
          <Button onClick={run("pickedUp", pickedUpAction)} disabled={pending}>
            {running === "pickedUp" ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="size-4" />
                Picked up
              </span>
            ) : (
              "Picked up"
            )}
          </Button>
        )}
        {order.status !== "paid" && (
          <Button variant="secondary" onClick={run("undo", undoAction)} disabled={pending}>
            {running === "undo" ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="size-4" />
                Undo
              </span>
            ) : (
              "Undo"
            )}
          </Button>
        )}
      </div>
    </li>
  );
}
