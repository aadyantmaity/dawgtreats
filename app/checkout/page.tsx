import Link from "next/link";

import { CheckoutForm, type SlotChoice } from "@/app/checkout/checkout-form";
import { currentAccount } from "@/lib/auth";
import { SLOT_MINUTES, getMenu, listSlots } from "@/lib/inventory";
import { PICKUP_PLACE, formatClosesAt, formatPickupWeekend, formatPt, getOrderableWeek } from "@/lib/weeks";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const week = await getOrderableWeek();

  if (!week) {
    return (
      <main className="animate-fade w-full max-w-2xl flex-1 py-12 lg:max-w-none">
        <h1 className="text-4xl font-semibold">Checkout</h1>
        <p className="mt-3 text-secondary">Orders are closed right now.</p>
        <Link href="/" className="mt-4 inline-flex min-h-control items-center underline">
          Back to the menu
        </Link>
      </main>
    );
  }

  const [menu, slots, account] = await Promise.all([getMenu(week.id), listSlots(week.id), currentAccount()]);
  const choices: SlotChoice[] = slots.map((slot) => ({
    id: slot.id,
    day: formatPt(slot.startsAt, { weekday: "long" }),
    startsAt: formatPt(slot.startsAt, { hour: "numeric", minute: "2-digit" }),
    spotsLeft: slot.capacity - slot.bookedCount,
  }));

  return (
    <main className="animate-fade w-full max-w-2xl flex-1 py-12 lg:max-w-none">
      <h1 className="text-4xl font-semibold">Checkout</h1>
      <div className="mt-3 flex flex-col gap-1 text-secondary">
        <p>Pickup {formatPickupWeekend(week.pickupWeekendStart)}</p>
        <p>{PICKUP_PLACE}</p>
        <p>Orders close {formatClosesAt(week.ordersCloseAt)}</p>
      </div>
      <CheckoutForm
        menu={menu}
        slots={choices}
        slotMinutes={SLOT_MINUTES}
        contact={{ name: account?.name ?? "", email: account?.email ?? "", phone: account?.phone ?? "" }}
      />
    </main>
  );
}
