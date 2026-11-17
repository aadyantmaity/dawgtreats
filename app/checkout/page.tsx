import Link from "next/link";

import { CheckoutForm, type SlotChoice } from "@/app/checkout/checkout-form";
import { currentAccount } from "@/lib/auth";
import { getMenu, listSlots } from "@/lib/inventory";
import {
  PICKUP_PLACE,
  formatClosesAt,
  formatPt,
  formatSlotRange,
  getOrderableWeek,
  isPickupBookable,
  isWeekdayPickup,
  ptZone,
} from "@/lib/weeks";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const week = await getOrderableWeek();

  if (!week) {
    return (
      <main className="mx-auto animate-fade w-full max-w-2xl flex-1 py-12 lg:max-w-none">
        <h1 className="text-4xl font-semibold">Checkout</h1>
        <p className="mt-3 text-secondary">Orders are closed right now.</p>
        <Link href="/" className="mt-4 inline-flex min-h-control items-center underline">
          Back to the menu
        </Link>
      </main>
    );
  }

  const [menu, slots, account] = await Promise.all([getMenu(week.id), listSlots(week.id, true), currentAccount()]);
  const choices: SlotChoice[] = slots.map((slot) => ({
    id: slot.id,
    day: formatPt(slot.startsAt, { weekday: "long" }),
    window: formatSlotRange(slot.startsAt, slot.endsAt),
    spotsLeft: slot.capacity - slot.bookedCount,
    weekday: isWeekdayPickup(slot.startsAt),
    // Shown but not choosable once today's window is within the hour: taking it off the list
    // would read as "we never offered that", when the truth is it closed a moment ago.
    closing: !isPickupBookable(slot.startsAt, slot.endsAt),
  }));

  return (
    <main className="mx-auto animate-fade w-full max-w-2xl flex-1 py-12 lg:max-w-none">
      <h1 className="text-4xl font-semibold">Checkout</h1>
      <div className="mt-3 flex flex-col gap-1 text-secondary">
        <p>{PICKUP_PLACE}</p>
        <p>Orders close {formatClosesAt(week.ordersCloseAt)}</p>
      </div>
      <CheckoutForm
        menu={menu}
        slots={choices}
        zone={ptZone(slots[0]?.startsAt ?? week.ordersCloseAt)}
        contact={{ name: account?.name ?? "", email: account?.email ?? "", phone: account?.phone ?? "" }}
        signedIn={Boolean(account)}
        freeCookieToSpend={Boolean(account) && account?.freeCookieUsedAt === null}
      />
    </main>
  );
}
