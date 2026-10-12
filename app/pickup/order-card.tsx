"use client";

import { IconArrowBackUp, IconCheck, IconPackageExport, IconShoppingBag } from "@tabler/icons-react";
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
const icon = { paid: IconShoppingBag, ready: IconPackageExport, picked_up: IconCheck } as const;

export function OrderCard({ order }: { order: Order }) {
  const StatusIcon = icon[order.status];
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
      className={`flex flex-col gap-3 p-4 transition-opacity sm:flex-row sm:items-center sm:gap-5 ${
        order.status === "picked_up" ? "opacity-60" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold tabular-nums">{order.orderCode}</span>
          <span className="font-medium">{order.name}</span>
          <Badge tone={tone[order.status]} className="gap-1">
            <StatusIcon className="size-3" aria-hidden />
            {label[order.status]}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-secondary">
          {order.lines.map((line) => `${line.quantity} × ${line.name}`).join(", ")}
          {order.phone && (
            <>
              {" · "}
              <a href={`tel:${order.phone}`} className="whitespace-nowrap underline">
                {formatPhone(order.phone)}
              </a>
            </>
          )}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        {order.status === "paid" && (
          <Button variant="secondary" onClick={run("ready", readyAction)} disabled={pending}>
            <span className="inline-flex items-center gap-2">
              {running === "ready" ? (
                <Spinner className="size-4" />
              ) : (
                <IconShoppingBag className="size-4" aria-hidden />
              )}
              Bagged
            </span>
          </Button>
        )}
        {order.status !== "picked_up" && (
          <Button onClick={run("pickedUp", pickedUpAction)} disabled={pending}>
            <span className="inline-flex items-center gap-2">
              {running === "pickedUp" ? (
                <Spinner className="size-4" />
              ) : (
                <IconCheck className="size-4" aria-hidden />
              )}
              Picked up
            </span>
          </Button>
        )}
        {order.status !== "paid" && (
          <Button variant="secondary" onClick={run("undo", undoAction)} disabled={pending}>
            <span className="inline-flex items-center gap-2">
              {running === "undo" ? (
                <Spinner className="size-4" />
              ) : (
                <IconArrowBackUp className="size-4" aria-hidden />
              )}
              Undo
            </span>
          </Button>
        )}
      </div>
    </li>
  );
}
