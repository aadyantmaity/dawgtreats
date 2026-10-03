import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderCard } from "@/app/pickup/order-card";
import { Card } from "@/components/ui/card";
import { currentAdmin } from "@/lib/auth";
import { listPickupDay } from "@/lib/orders";
import { formatPt, formatPickupWeekend, listWeeks } from "@/lib/weeks";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pickup day" };

export default async function PickupPage() {
  if (!(await currentAdmin())) notFound();

  const weeks = await listWeeks();
  const week = weeks.find((w) => w.status === "open") ?? weeks[0];
  if (!week) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <h1 className="text-4xl font-semibold">Pickup day</h1>
        <p className="mt-3 text-secondary">No weeks yet.</p>
      </main>
    );
  }

  const groups = await listPickupDay(week.id);
  const all = groups.flatMap((group) => group.orders);
  const left = all.filter((order) => order.status !== "picked_up").length;
  const cookies = all
    .filter((order) => order.status !== "picked_up")
    .reduce((sum, order) => sum + order.cookieCount, 0);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <h1 className="text-4xl font-semibold">Pickup day</h1>
      <p className="mt-3 text-secondary">
        {formatPickupWeekend(week.pickupWeekendStart)} · {week.status}
      </p>
      <p className="mt-1 text-secondary">
        {all.length === 0
          ? "No orders yet."
          : `${left} of ${all.length} still to hand over · ${cookies} cookies to bag`}
      </p>

      <div className="mt-8 flex flex-col gap-6">
        {groups.map((group) => (
          <Card
            key={group.slotId}
            title={`${formatPt(group.startsAt, { weekday: "short", hour: "numeric", minute: "2-digit" })}–${formatPt(group.endsAt, { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}`}
            className="p-0"
          >
            {group.orders.length === 0 ? (
              <p className="px-5 pb-5 text-secondary">Nobody booked this slot.</p>
            ) : (
              <ul className="divide-y divide-default">
                {group.orders.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>

      <Link href="/" className="mt-10 inline-block underline">
        Back to the menu
      </Link>
    </main>
  );
}
