import Image from "next/image";

import { AddToCart } from "@/components/cart";
import { CartTray } from "@/components/cart-tray";
import { NotifyForm } from "@/components/notify-form";
import { TrackView } from "@/lib/analytics/track";
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
  if (remaining === 0) return <span className="text-sm text-tertiary">Sold out</span>;
  return (
    <span className={`text-sm ${remaining <= LOW_STOCK ? "text-urgent" : "text-secondary"}`}>
      {remaining} left
    </span>
  );
}

function FlavorCard({ flavor }: { flavor: MenuItem }) {
  const soldOut = flavor.remaining === 0;

  return (
    <article className="flex flex-col gap-4 rounded-card border border-default bg-surface p-4">
      {/* A phone puts the photo beside the name. Full width, three cookies are five
          screenfuls, and the menu stops being a list you can read at a glance. */}
      <div className="flex items-center gap-4 sm:flex-col sm:items-stretch">
        {flavor.imageUrl ? (
          <Image
            src={flavor.imageUrl}
            alt={flavor.name}
            width={600}
            height={450}
            // Both cards are above the fold on a laptop, so neither should wait for lazy loading.
            priority
            sizes="(min-width: 640px) 24rem, 6rem"
            className={`size-24 shrink-0 rounded-card object-cover sm:aspect-photo sm:size-auto sm:w-full ${soldOut ? "opacity-60" : ""}`}
          />
        ) : (
          <PhotoPlaceholder
            className={`size-24 shrink-0 sm:aspect-photo sm:size-auto sm:w-full ${soldOut ? "opacity-60" : ""}`}
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {/* Beside a thumbnail there is room for about twenty characters, and every name
              here is longer. The price drops below so the name keeps the width. */}
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
            <h2 className={`font-sans text-lg font-semibold ${soldOut ? "text-tertiary" : ""}`}>
              {flavor.name}
            </h2>
            <span className={`tabular-nums ${soldOut ? "text-secondary sm:text-primary" : ""}`}>
              {formatCents(flavor.priceCents)}
            </span>
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
      <details className="group border-t border-default pt-3">
        <summary className="disclosure text-sm text-secondary transition-colors ease-spring hover:text-primary">
          Allergens
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden
            className="size-4 shrink-0 transition-transform ease-spring group-open:rotate-180"
          >
            <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <p className="mt-2 text-sm text-tertiary">{allergenLine(flavor.allergens)}</p>
        {mayContainLine(flavor.mayContain) && (
          <p className="mt-1 text-sm text-tertiary">{mayContainLine(flavor.mayContain)}</p>
        )}
      </details>
    </article>
  );
}

export default async function MenuPage() {
  const week = await getOrderableWeek();
  const menu = await getMenu(week?.id ?? null);
  const account = week ? null : await currentAccount();
  const onList = account ? await isWaiting(account.email) : false;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 animate-fade px-4 sm:px-6 py-12">
      <TrackView name="menu_viewed" />
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
        <div className="mt-10 grid items-start gap-5 sm:grid-cols-2">
          {menu.map((flavor) => (
            <FlavorCard key={flavor.id} flavor={flavor} />
          ))}
        </div>
      )}

      <p className="mt-12 text-sm text-tertiary">
        Pickup only, Saturday or Sunday. No refunds or cancellations.
      </p>
      <CartTray menu={menu} />
    </main>
  );
}
