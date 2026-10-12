import Link from "next/link";
import { notFound } from "next/navigation";

import { ChangeSlot, type SlotChoice } from "@/app/order/[code]/change-slot";
import { OrderStatus } from "@/app/order/[code]/order-status";
import { Card } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { getPublicOrder, listSlotsForOrder } from "@/lib/orders";
import { PICKUP_PLACE, formatPt } from "@/lib/weeks";
import { cache } from "react";

export const dynamic = "force-dynamic";

// One read per request, shared by the title and the page. Without this the lookup runs
// twice for every order page.
const findOrder = cache((code: string) => getPublicOrder(code.toUpperCase()));

// The code in the tab title, so several open orders stay tellable apart. The miss is
// answered here rather than in the page: by the time the page runs, the response has
// started and the status can no longer become a 404.
export async function generateMetadata({ params }: PageProps<"/order/[code]">) {
  const { code } = await params;
  const order = await findOrder(code);
  if (!order) notFound();
  // This page carries an order code and a pickup time, so it is for the person holding
  // the link, not for a search engine. The code's own loading skeleton also means the
  // response has already begun when a miss is found, so a wrong code answers 200 with
  // "Nothing here" rather than a 404 — another reason not to let it be indexed.
  return { title: `Order ${order.orderCode}`, robots: { index: false, follow: false } };
}

export default async function OrderPage({ params }: PageProps<"/order/[code]">) {
  const { code } = await params;
  // The public shape, so a name or phone number cannot reach this page by accident.
  const order = await findOrder(code);
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
    <main className="mx-auto animate-fade w-full max-w-2xl flex-1 py-12">
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
