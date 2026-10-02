import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { getOrderByCode } from "@/lib/orders";
import { formatPt } from "@/lib/weeks";

export const dynamic = "force-dynamic";

const tone = { pending: "neutral", paid: "success", ready: "success", picked_up: "success", expired: "warning" } as const;

const headline = {
  pending: "Waiting on payment",
  paid: "You're all set",
  ready: "Ready for pickup",
  picked_up: "Picked up",
  expired: "This order expired",
} as const;

export default async function OrderPage({ params }: PageProps<"/order/[code]">) {
  const { code } = await params;
  const found = await getOrderByCode(code.toUpperCase());
  if (!found) notFound();

  const { order, lines, slot } = found;
  const pickup = `${formatPt(slot.startsAt, { weekday: "long", month: "short", day: "numeric" })}, ${formatPt(slot.startsAt, { hour: "numeric", minute: "2-digit" })}–${formatPt(slot.endsAt, { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}`;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-4xl font-semibold">{headline[order.status]}</h1>
        <Badge tone={tone[order.status]} className="capitalize">
          {order.status.replace("_", " ")}
        </Badge>
      </div>
      <p className="mt-3 text-secondary">
        Order <span className="font-semibold text-primary tabular-nums">{order.orderCode}</span>
      </p>

      <Card title="Pickup" className="mt-8">
        <p>{pickup}</p>
        <p className="mt-1 text-sm text-secondary">Bring your order code.</p>
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

      {order.status === "pending" && (
        <p className="mt-6 text-secondary">
          If you just paid, this page updates once Stripe confirms it. Refresh in a moment.
        </p>
      )}
      {order.status === "expired" && (
        <p className="mt-6 text-secondary">
          The hold ran out before payment arrived, so the cookies went back on the menu.
        </p>
      )}

      <Link href="/" className="mt-8 inline-block underline">
        Back to the menu
      </Link>
    </main>
  );
}
