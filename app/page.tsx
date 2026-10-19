import Image from "next/image";

import { AddToCart } from "@/components/cart";
import { CartTray } from "@/components/cart-tray";
import { DealBanner } from "@/components/deal-banner";
import { NotifyForm } from "@/components/notify-form";
import { TrackView } from "@/lib/analytics/track";
import { Message } from "@/components/ui/message";
import { PhotoPlaceholder } from "@/components/ui/photo-placeholder";
import { currentAccount } from "@/lib/auth";
import { getMenu, type MenuItem } from "@/lib/inventory";
import { formatCents } from "@/lib/money";
import { isWaiting } from "@/lib/notify";
import { allergenLine, mayContainLine } from "@/lib/recipe";
import { formatClosesAt, formatPickupWeekend, getOrderableWeek } from "@/lib/weeks";

// Stock changes with every checkout, so the menu is never prerendered.
export const dynamic = "force-dynamic";

const LOW_STOCK = 10;

function Stock({ remaining }: { remaining: number | null }) {
  if (remaining === null) return null;
  return (
    <span className={`text-sm ${remaining <= LOW_STOCK ? "text-urgent" : "text-secondary"}`}>
      {remaining} left
    </span>
  );
}

// Stated, not hidden behind a press. Closed, the row said "Allergens" on every card and
// nothing else, so it cost the same height as the sentence it was holding back.
function Allergens({ flavor }: { flavor: MenuItem }) {
  const mayContain = mayContainLine(flavor.mayContain);

  return (
    <div className="border-t border-default pt-3 text-sm text-tertiary">
      <p>{allergenLine(flavor.allergens)}</p>
      {mayContain && <p className="mt-1">{mayContain}</p>}
    </div>
  );
}

function FlavorCard({ flavor, priority }: { flavor: MenuItem; priority: boolean }) {
  return (
    <article className="flex flex-col gap-3 rounded-card bg-surface p-4">
      {/* A phone puts the cookie beside the name, because stacked it is a screenful per
          flavor and the bake stops being something you can take in at once. */}
      <div className="flex items-stretch gap-4 sm:flex-1 sm:flex-col sm:gap-3">
        {/* Beside the cookie this is a column of its own, so the button sits under the name
            rather than across the card. Wider, it dissolves and its two halves become rows
            of the card, which is why they carry their own order there. */}
        {/* Shut, the name is all this column holds, so it sits against the middle of the
            cookie rather than at the top of a column of nothing. */}
        <div
          className={`flex min-w-0 flex-1 flex-col gap-3 sm:contents ${
            flavor.remaining === null ? "justify-center" : "justify-between"
          }`}
        >
          <div className="sm:order-1">
            <h2 className="font-sans text-lg font-semibold">{flavor.name}</h2>
            {/* The price moved into the button, which is the thing that acts on it. What is
                left under the name is the one number that changes while you look at it. */}
            <Stock remaining={flavor.remaining} />
          </div>
          {/* Nothing is for sale while the week is shut, and an empty row still holds its
              height. Fixed height when it does show, so a card never grows on a press. */}
          {flavor.remaining !== null && (
            <div className="flex min-h-control items-center justify-end sm:order-3">
              <AddToCart
                flavorId={flavor.id}
                name={flavor.name}
                priceCents={flavor.priceCents}
                remaining={flavor.remaining}
              />
            </div>
          )}
        </div>
        {/* The heading stays first in the markup and the cookie moves ahead of it only on
            screen, so the card still reads name-then-photo however it is laid out.
            Wider, it takes what the rest of the card leaves, so a name that wraps to two
            lines costs the cookie its height instead of making the card taller. */}
        <div className="order-first flex w-thumb shrink-0 items-center justify-center sm:order-2 sm:w-full sm:flex-1 sm:px-4">
          {flavor.imageUrl ? (
            <Image
              src={flavor.imageUrl}
              alt={flavor.name}
              width={1000}
              height={1000}
              // Only the first row is above the fold, and a preload for every flavor on the
              // menu competes with the ones that are, which costs the page its own LCP.
              priority={priority}
              sizes="(min-width: 640px) 24rem, 8.75rem"
              className="cookie-cutout aspect-square w-full object-contain"
            />
          ) : (
            <PhotoPlaceholder className="aspect-square w-full" />
          )}
        </div>
      </div>
      <Allergens flavor={flavor} />
    </article>
  );
}

// A sold-out flavor stays on the menu, so the week still reads as a full bake.
function SoldOutCard({ flavor }: { flavor: MenuItem }) {
  return (
    <article className="relative flex flex-col gap-3 rounded-card bg-surface p-4">
      {/* The outline is drawn rather than bordered, so the dashes can have air between
          them. The radius repeats rounded-card: an attribute cannot read a custom property. */}
      <svg
        aria-hidden
        className="dotted-edge pointer-events-none absolute inset-0 size-full overflow-visible"
      >
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          rx="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="9 7"
        />
      </svg>
      <div className="flex items-center gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-control-sm bg-quiet p-1 opacity-60">
          {flavor.imageUrl ? (
            <Image
              src={flavor.imageUrl}
              alt={flavor.name}
              width={96}
              height={96}
              sizes="3rem"
              className="cookie-cutout size-full object-contain"
            />
          ) : (
            <PhotoPlaceholder className="size-full" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          {/* An h3, so heading navigation groups these under the one that explains them. */}
          <h3 className="font-sans text-base font-semibold text-tertiary">{flavor.name}</h3>
          <span className="text-sm text-tertiary tabular-nums">
            {formatCents(flavor.priceCents)}
          </span>
        </div>
      </div>
      <AddToCart flavorId={flavor.id} name={flavor.name} priceCents={flavor.priceCents} remaining={0} />
      <Allergens flavor={flavor} />
    </article>
  );
}

// Two across, whatever the count. The column is 976px wide, so a third card takes each one
// down to about 309px and the cookie stops being the point of the card.
const columns = "sm:grid-cols-2";

export default async function MenuPage({ searchParams }: PageProps<"/">) {
  // The auth callback sends a failed sign-in here. Without this it lands on an ordinary
  // menu and reads as a button that did nothing.
  const signinFailed = (await searchParams).signin === "failed";
  const week = await getOrderableWeek();
  const menu = await getMenu(week?.id ?? null);
  const account = week ? null : await currentAccount();
  const onList = account ? await isWaiting(account.email) : false;

  // A cookie nobody can buy should not sit between two that they can.
  const forSale = menu.filter((flavor) => flavor.remaining !== 0);
  const soldOut = menu.filter((flavor) => flavor.remaining === 0);

  return (
    <main className="w-full flex-1 animate-fade py-12">
      <TrackView name="menu_viewed" />
      {signinFailed && (
        <Message tone="error" className="mb-6">
          Sign-in didn&apos;t go through. Try again.
        </Message>
      )}
      <h1 className="text-4xl font-semibold">
        {week ? "This week's bake" : "The menu"}
      </h1>
      {week ? (
        <div className="mt-3 flex flex-col gap-1 text-secondary">
          <p>Orders close {formatClosesAt(week.ordersCloseAt)}</p>
          <p>Pickup {formatPickupWeekend(week.pickupWeekendStart)}</p>
        </div>
      ) : (
        <>
          <p className="mt-3 text-secondary">Orders are closed. New batch most weeks.</p>
          <div className="mb-8">
            <NotifyForm
              signedInAs={account?.email ?? null}
              alreadyOnList={onList}
            />
          </div>
        </>
      )}
      <p className="mt-3 text-sm text-tertiary">
        Questions about ingredients or allergens? Email{" "}
        <a
          href="mailto:orders@dawgtreats.shop"
          className="underline transition-colors ease-spring hover:text-primary"
        >
          orders@dawgtreats.shop
        </a>
      </p>

      {menu.length === 0 ? (
        <p className="mt-10 text-secondary">Nothing on the menu yet. Check back soon.</p>
      ) : (
        <>
          {/* Nothing can be bought while the week is shut, so an offer on three of them is
              not news. Shut, every flavor reports null stock rather than zero, which is why
              the count alone kept it on the page. */}
          {week && forSale.length > 0 && <DealBanner menu={forSale} />}
          {forSale.length > 0 && (
            <div className="mt-5 rounded-card bg-ground p-4 sm:p-6">
              <div className={`grid gap-4 sm:gap-6 ${columns}`}>
                {forSale.map((flavor, index) => (
                  <FlavorCard key={flavor.id} flavor={flavor} priority={index < 2} />
                ))}
              </div>
            </div>
          )}
          {forSale.length === 0 && (
            <p className="mt-10 text-secondary">
              Everything sold out this week. There&apos;s a new batch most weeks.
            </p>
          )}
          {soldOut.length > 0 && (
            <>
              <h2 className="mt-10 flex items-center gap-3 text-xs uppercase tracking-widest text-tertiary">
                <span aria-hidden className="flex-1 border-t border-default" />
                Sold out this week
                <span aria-hidden className="flex-1 border-t border-default" />
              </h2>
              <div className={`mt-5 grid items-start gap-8 sm:gap-12 ${columns}`}>
                {soldOut.map((flavor) => (
                  <SoldOutCard key={flavor.id} flavor={flavor} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <p className="mt-12 text-sm text-tertiary">
        Pickup only, Saturday or Sunday. No refunds or cancellations.
      </p>
      {week && <CartTray menu={menu} />}
    </main>
  );
}
