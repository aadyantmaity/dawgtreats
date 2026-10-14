import { IconChevronDown } from "@tabler/icons-react";
import Image from "next/image";

import { AddToCart } from "@/components/cart";
import { CartTray } from "@/components/cart-tray";
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

function Allergens({ flavor }: { flavor: MenuItem }) {
  return (
    <details className="group border-t border-default pt-3">
      <summary className="disclosure text-sm text-secondary transition-colors ease-spring hover:text-primary">
        Allergens
        <IconChevronDown
          aria-hidden
          className="size-4 shrink-0 transition-transform ease-spring group-open:rotate-180"
        />
      </summary>
      <p className="mt-2 text-sm text-tertiary">{allergenLine(flavor.allergens)}</p>
      {mayContainLine(flavor.mayContain) && (
        <p className="mt-1 text-sm text-tertiary">{mayContainLine(flavor.mayContain)}</p>
      )}
    </details>
  );
}

function FlavorCard({ flavor, priority }: { flavor: MenuItem; priority: boolean }) {
  return (
    <article className="flex flex-col gap-4 rounded-card border border-default bg-surface p-5">
      {/* A phone puts the photo beside the name. Full width, three cookies are five
          screenfuls, and the menu stops being a list you can read at a glance. */}
      <div className="flex items-center gap-4 sm:flex-col sm:items-stretch">
        {flavor.imageUrl ? (
          <Image
            src={flavor.imageUrl}
            alt={flavor.name}
            width={600}
            height={450}
            // Only the first row is above the fold, and a preload for every flavor on the
            // menu competes with the ones that are, which costs the page its own LCP.
            priority={priority}
            sizes="(min-width: 640px) 24rem, 7rem"
            className="aspect-photo w-24 shrink-0 rounded-card object-cover bigmark:w-thumb sm:size-auto sm:w-full"
          />
        ) : (
          <PhotoPlaceholder className="aspect-photo w-24 shrink-0 bigmark:w-thumb sm:size-auto sm:w-full" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {/* Beside a thumbnail there is room for about twenty characters, and every name
              here is longer. The price drops below so the name keeps the width. */}
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
            <h2 className="font-sans text-lg font-semibold">{flavor.name}</h2>
            <span className="tabular-nums">{formatCents(flavor.priceCents)}</span>
          </div>
          {flavor.description && <p className="text-sm text-secondary">{flavor.description}</p>}
        </div>
      </div>
      {/* Nothing is for sale while the week is shut, and an empty row still holds its
          height. Fixed height when it does show, so a card never grows on a press. */}
      {flavor.remaining !== null && (
        <div className="flex min-h-control items-center justify-between gap-3">
          <Stock remaining={flavor.remaining} />
          <AddToCart flavorId={flavor.id} name={flavor.name} remaining={flavor.remaining} />
        </div>
      )}
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
        {flavor.imageUrl ? (
          <Image
            src={flavor.imageUrl}
            alt={flavor.name}
            width={96}
            height={96}
            sizes="3rem"
            className="size-12 shrink-0 rounded-control-sm object-cover opacity-60"
          />
        ) : (
          <PhotoPlaceholder className="size-12 shrink-0 rounded-control-sm" />
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* An h3, so heading navigation groups these under the one that explains them. */}
          <h3 className="font-sans text-base font-semibold text-tertiary">{flavor.name}</h3>
          <span className="text-sm text-tertiary tabular-nums">
            {formatCents(flavor.priceCents)}
          </span>
        </div>
      </div>
      <AddToCart flavorId={flavor.id} name={flavor.name} remaining={0} />
      <Allergens flavor={flavor} />
    </article>
  );
}

// Two across, whatever the count. The column is 848px wide, so a third card takes each
// one down to about 270px and the photo stops being the point of the card.
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
          {forSale.length > 0 && (
            <div className={`mt-10 grid items-start gap-5 sm:gap-12 ${columns}`}>
              {forSale.map((flavor, index) => (
                <FlavorCard key={flavor.id} flavor={flavor} priority={index < 2} />
              ))}
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
              <div className={`mt-5 grid items-start gap-5 sm:gap-12 ${columns}`}>
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
      <CartTray menu={menu} />
    </main>
  );
}
