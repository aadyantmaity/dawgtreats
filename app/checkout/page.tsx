import Link from "next/link";

import { CheckoutForm, type SlotChoice } from "@/app/checkout/checkout-form";
import { currentAccount } from "@/lib/auth";
import { getMenu, listSlots } from "@/lib/inventory";
import { PICKUP_PLACE, formatClosesAt, formatPickupWeekend, formatPt, getOrderableWeek } from "@/lib/weeks";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const week = await getOrderableWeek();

  if (!week) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <h1 className="text-4xl font-semibold">Checkout</h1>
        <p className="mt-3 text-secondary">Orders are closed right now.</p>
        <Link href="/" className="mt-6 inline-block underline">
          Back to the menu
        </Link>
      </main>
    );
  }

  const [menu, slots, account] = await Promise.all([getMenu(week.id), listSlots(week.id), currentAccount()]);
  const choices: SlotChoice[] = slots
    .filter((slot) => slot.bookedCount < slot.capacity)
    .map((slot) => ({
      id: slot.id,
      label: `${formatPt(slot.startsAt, { weekday: "short" })} ${formatPt(slot.startsAt, { hour: "numeric", minute: "2-digit" })}–${formatPt(slot.endsAt, { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}`,
      spotsLeft: slot.capacity - slot.bookedCount,
    }));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <h1 className="text-4xl font-semibold">Checkout</h1>
      <div className="mt-3 flex flex-col gap-1 text-secondary">
        <p>Pickup {formatPickupWeekend(week.pickupWeekendStart)}</p>
        <p>{PICKUP_PLACE}</p>
        <p>Orders close {formatClosesAt(week.ordersCloseAt)}</p>
      </div>
      <CheckoutForm
        menu={menu}
        slots={choices}
        contact={{ name: account?.name ?? "", email: account?.email ?? "", phone: account?.phone ?? "" }}
      />
    </main>
  );
}
