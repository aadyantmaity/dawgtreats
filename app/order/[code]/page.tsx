import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderStatus } from "@/app/order/[code]/order-status";
import { Card } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { getOrderByCode } from "@/lib/orders";
import { PICKUP_PLACE, formatPt } from "@/lib/weeks";

export const dynamic = "force-dynamic";

// The code in the tab title, so several open orders stay tellable apart.
export async function generateMetadata({ params }: PageProps<"/order/[code]">) {
  const { code } = await params;
  return { title: `Order ${code.toUpperCase()}` };
}

export default async function OrderPage({ params }: PageProps<"/order/[code]">) {
  const { code } = await params;
  const found = await getOrderByCode(code.toUpperCase());
  if (!found) notFound();

  const { order, lines, slot } = found;
  const pickup = `${formatPt(slot.startsAt, { weekday: "long", month: "short", day: "numeric" })}, ${formatPt(slot.startsAt, { hour: "numeric", minute: "2-digit" })}–${formatPt(slot.endsAt, { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}`;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 sm:px-6 py-12">
      <OrderStatus orderCode={order.orderCode} initial={order.status} />

      <Card title="Pickup" className="mt-8">
        <p>{pickup}</p>
        <p className="mt-1">{PICKUP_PLACE}</p>
        <p className="mt-2 text-sm text-secondary">Bring this code.</p>
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

      <Link href="/" className="mt-8 inline-block underline">
        Back to the menu
      </Link>
    </main>
  );
}
