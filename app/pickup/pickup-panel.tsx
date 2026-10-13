import { IconChevronRight } from "@tabler/icons-react";

import { OrderCard } from "@/app/pickup/order-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { listPickupDay, type PickupOrder } from "@/lib/orders";
import {
  addDays,
  formatPt,
  formatPickupWeekend,
  listWeeks,
  ptToUtc,
  type WeekSummary,
} from "@/lib/weeks";

// The weekend being handed over, not whichever week is open: the owner opens next week's
// orders before this week's pickup, which used to send this screen to an empty list.
function weekBeingPickedUp(weeks: WeekSummary[]): WeekSummary | undefined {
  const now = new Date();
  const earliestFirst = [...weeks].sort((a, b) =>
    a.pickupWeekendStart.localeCompare(b.pickupWeekendStart),
  );
  // A weekend is still being picked up until Sunday night, so the first one that has not
  // ended is today's, tomorrow's, or the next one coming.
  const ended = (week: WeekSummary) =>
    ptToUtc(addDays(week.pickupWeekendStart, 1), "23:59") < now;
  return earliestFirst.find((week) => !ended(week)) ?? earliestFirst.at(-1);
}

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

// The pickup day, as a section rather than a page: the owner reaches it inside their
// account, beside the other two things only they can see.
export async function PickupPanel() {
  const weeks = await listWeeks();
  const week = weekBeingPickedUp(weeks);
  if (!week) {
    return <p className="text-secondary">No weeks yet.</p>;
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
    <div>
      <p className="text-secondary">
        {formatPickupWeekend(week.pickupWeekendStart)} · {week.status}
      </p>
      <p className="mt-1 text-secondary">
        {all.length === 0
          ? "No orders yet."
          : `${left} of ${all.length} still to hand over · ${cookies} ${cookies === 1 ? "cookie" : "cookies"} to bag`}
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

    </div>
  );
}
