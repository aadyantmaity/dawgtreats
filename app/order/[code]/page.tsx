import Link from "next/link";
import { notFound } from "next/navigation";

import { ChangeSlot, type SlotChoice } from "@/app/order/[code]/change-slot";
import { OrderStatus } from "@/app/order/[code]/order-status";
import { Card } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { getPublicOrder, listSlotsForOrder } from "@/lib/orders";
import { PICKUP_PLACE, formatPt } from "@/lib/weeks";

export const dynamic = "force-dynamic";

// The code in the tab title, so several open orders stay tellable apart.
export async function generateMetadata({ params }: PageProps<"/order/[code]">) {
  const { code } = await params;
  return { title: `Order ${code.toUpperCase()}` };
}

export default async function OrderPage({ params }: PageProps<"/order/[code]">) {
  const { code } = await params;
  // The public shape, so a name or phone number cannot reach this page by accident.
  const order = await getPublicOrder(code.toUpperCase());
  if (!order) notFound();

  const choices: SlotChoice[] = (await listSlotsForOrder(order.orderCode)).map((slot) => ({
    id: slot.id,
    label: `${formatPt(slot.startsAt, { weekday: "short" })} ${formatPt(slot.startsAt, { hour: "numeric", minute: "2-digit" })}`,
    spotsLeft: slot.spotsLeft,
    current: slot.current,
  }));

  const { lines } = order;
  const pickup = `${formatPt(order.pickupStartsAt, { weekday: "long", month: "short", day: "numeric" })}, ${formatPt(order.pickupStartsAt, { hour: "numeric", minute: "2-digit" })}–${formatPt(order.pickupEndsAt, { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}`;

  return (
    <main className="animate-fade mx-auto w-full max-w-2xl flex-1 px-4 sm:px-6 py-12">
      <OrderStatus orderCode={order.orderCode} initial={order.status} />

      <Card title="Pickup" className="mt-8">
        <p>{pickup}</p>
        <p className="mt-1">{PICKUP_PLACE}</p>
        <ChangeSlot orderCode={order.orderCode} choices={choices} />
      </Card>

      <Card title="Your cookies" className="mt-6">
        <ul className="flex flex-col gap-2">
          {lines.map((line) => (
            <li key={line.name} className="flex justify-between gap-4">
              <span>
                {line.quantity} × {line.name}
              </span>
              <span className="tabular-nums">{formatCents(line.unitPriceCents * line.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-default pt-3 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatCents(order.totalCents)}</span>
        </div>
      </Card>

      <Link href="/" className="mt-6 inline-flex min-h-control items-center underline">
        Back to the menu
      </Link>
    </main>
  );
}
