import { Check, CircleSlash, Hourglass, PackageCheck, ShoppingBag } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import type { listOrdersForAccount } from "@/lib/orders";
import { ORDER_STATUS_TONE } from "@/lib/orders/status";
import { formatPt } from "@/lib/weeks";

type AccountOrder = Awaited<ReturnType<typeof listOrdersForAccount>>[number];

// Three of the five statuses share the success tone, so the icon is what tells them apart.
const STATUS_ICON = {
  pending: Hourglass,
  paid: Check,
  ready: ShoppingBag,
  picked_up: PackageCheck,
  expired: CircleSlash,
} as const;

export function OrderList({ orders }: { orders: AccountOrder[] }) {
  return (
    <Card className="p-0">
      <ul className="divide-y divide-default">
        {orders.map((order) => {
          const StatusIcon = STATUS_ICON[order.status];
          return (
            <li key={order.orderCode}>
              <Link
                href={`/order/${order.orderCode}`}
                className="flex flex-wrap items-center gap-3 p-5 hover:bg-hover"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold tabular-nums">{order.orderCode}</span>
                    <Badge tone={ORDER_STATUS_TONE[order.status]} className="gap-1 capitalize">
                      <StatusIcon className="size-3" aria-hidden />
                      {order.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-sm text-secondary">
                    Pickup {formatPt(order.pickupStartsAt, { month: "short", day: "numeric" })},{" "}
                    {formatPt(order.pickupStartsAt, { hour: "numeric", minute: "2-digit" })}–
                    {formatPt(order.pickupEndsAt, {
                      hour: "numeric",
                      minute: "2-digit",
                      timeZoneName: "short",
                    })}
                  </p>
                </div>
                <span className="tabular-nums">{formatCents(order.totalCents)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
