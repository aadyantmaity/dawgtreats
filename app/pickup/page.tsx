import { IconChevronRight } from "@tabler/icons-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderCard } from "@/app/pickup/order-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { currentAdmin } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { listPickupDay, type PickupOrder } from "@/lib/orders";
import { formatPt, formatPickupWeekend, listWeeks } from "@/lib/weeks";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pickup day" };

// What a shut slot has to answer: how much to bake for it, and how much money it is.
function summarise(orders: PickupOrder[]) {
  const byFlavor = new Map<string, number>();
  for (const order of orders) {
    for (const line of order.lines) {
      byFlavor.set(line.name, (byFlavor.get(line.name) ?? 0) + line.quantity);
    }
  }
  return {
    cookies: orders.reduce((sum, order) => sum + order.cookieCount, 0),
    money: orders.reduce((sum, order) => sum + order.totalCents, 0),
    left: orders.filter((order) => order.status !== "picked_up").length,
    flavors: [...byFlavor].map(([name, quantity]) => ({ name, quantity })),
  };
}

function Breakdown({
  flavors,
  className = "",
}: {
  flavors: { name: string; quantity: number }[];
  className?: string;
}) {
  return (
    <div className={`flex flex-col text-sm ${className}`}>
      {flavors.map((flavor) => (
        <span key={flavor.name} className="flex gap-1">
          <span className="w-4 shrink-0 text-right tabular-nums">{flavor.quantity}</span>
          <span>× {flavor.name}</span>
        </span>
      ))}
    </div>
  );
}

export default async function PickupPage() {
  if (!(await currentAdmin())) notFound();

  const weeks = await listWeeks();
  const week = weeks.find((w) => w.status === "open") ?? weeks[0];
  if (!week) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 animate-fade py-12">
        <h1 className="text-4xl font-semibold">Pickup day</h1>
        <p className="mt-3 text-secondary">No weeks yet.</p>
      </main>
    );
  }

  const groups = await listPickupDay(week.id);
  // An empty slot needs nothing done to it, so it only costs the reader a scroll. The
  // count of them stays, because "did I miss a slot" is a real question on the day.
  const booked = groups.filter((group) => group.orders.length > 0);
  const quiet = groups.length - booked.length;
  const all = groups.flatMap((group) => group.orders);
  const left = all.filter((order) => order.status !== "picked_up").length;
  const waiting = all.filter((order) => order.status !== "picked_up");
  const cookies = waiting.reduce((sum, order) => sum + order.cookieCount, 0);
  const toBag = summarise(waiting).flavors;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 animate-fade py-12">
      <h1 className="text-4xl font-semibold">Pickup day</h1>
      <p className="mt-3 text-secondary">
        {formatPickupWeekend(week.pickupWeekendStart)} · {week.status}
      </p>
      <p className="mt-1 text-secondary">
        {all.length === 0
          ? "No orders yet."
          : `${left} of ${all.length} still to hand over · ${cookies} cookies to bag`}
      </p>
      {toBag.length > 0 && <Breakdown flavors={toBag} className="mt-2 text-secondary" />}

      <div className="mt-8 flex flex-col gap-6">
        {booked.map((group) => {
          const { cookies, money, left, flavors } = summarise(group.orders);
          return (
            <Card key={group.slotId} className="p-0">
              <details className="group">
                <summary className="flex cursor-pointer items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h2 className="font-semibold">
                        {formatPt(group.startsAt, { weekday: "short", hour: "numeric", minute: "2-digit" })}–
                        {formatPt(group.endsAt, { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}
                      </h2>
                      {left > 0 ? (
                        <Badge tone="warning">
                          {left} {left === 1 ? "order" : "orders"} to hand over
                        </Badge>
                      ) : (
                        <Badge tone="success">all orders handed over</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-secondary">
                      <span className="tabular-nums">{group.orders.length}</span>{" "}
                      {group.orders.length === 1 ? "order" : "orders"} ·{" "}
                      <span className="tabular-nums">{cookies}</span>{" "}
                      {cookies === 1 ? "cookie" : "cookies"} ·{" "}
                      <span className="tabular-nums">{formatCents(money)}</span>
                    </p>
                  </div>
                  <IconChevronRight
                    aria-hidden
                    className="slot-chevron size-5 shrink-0 self-center text-secondary transition-transform ease-spring"
                  />
                </summary>
                <Breakdown
                  flavors={flavors}
                  className="border-t border-default px-4 py-3 text-tertiary"
                />
                <ul className="divide-y divide-default border-t border-default">
                  {group.orders.map((order) => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                </ul>
              </details>
            </Card>
          );
        })}
      </div>

      {quiet > 0 && (
        <p className="mt-6 text-sm text-tertiary">
          {quiet === 1 ? "One other slot has" : `${quiet} other slots have`} nobody booked.
        </p>
      )}

      <Link href="/" className="mt-8 inline-flex min-h-control items-center underline">
        Back to the menu
      </Link>
    </main>
  );
}
