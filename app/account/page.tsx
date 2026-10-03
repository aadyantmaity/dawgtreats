import Link from "next/link";

import { ContactDetails } from "@/app/account/contact-details";
import { SignInWithGoogle } from "@/components/sign-in";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { currentAccount } from "@/lib/auth";
import { ORDER_STATUS_TONE } from "@/lib/orders/status";
import { formatCents } from "@/lib/money";
import { listOrdersForAccount } from "@/lib/orders";
import { formatPt } from "@/lib/weeks";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const account = await currentAccount();

  if (!account) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-6 py-12">
        <h1 className="text-4xl font-semibold">Your account</h1>
        <p className="mt-3 mb-8 text-secondary">
          Sign in to see past orders and save your details. You never need an account to order.
        </p>
        <SignInWithGoogle />
      </main>
    );
  }

  const orders = await listOrdersForAccount(account.id);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <h1 className="text-4xl font-semibold">Your account</h1>
      <p className="mt-3 text-secondary">{account.email}</p>

      <ContactDetails name={account.name} phone={account.phone} className="mt-8" />

      <h2 className="mt-10 mb-4 text-2xl font-semibold">Past orders</h2>
      {orders.length === 0 ? (
        <Card>
          <p className="text-secondary">
            No orders yet. Anything you order with {account.email} shows up here.
          </p>
        </Card>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-default">
            {orders.map((order) => (
              <li key={order.orderCode}>
                <Link
                  href={`/order/${order.orderCode}`}
                  className="flex flex-wrap items-center gap-3 p-5 hover:bg-hover"
                >
                  <div className="min-w-0 flex-1 basis-48">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold tabular-nums">{order.orderCode}</span>
                      <Badge tone={ORDER_STATUS_TONE[order.status]} className="capitalize">
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
            ))}
          </ul>
        </Card>
      )}

      <form action="/auth/signout" method="post" className="mt-10">
        <button type="submit" className="text-sm text-secondary underline hover:text-primary">
          Sign out
        </button>
      </form>
    </main>
  );
}
