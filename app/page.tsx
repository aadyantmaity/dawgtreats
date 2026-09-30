import { PhotoPlaceholder } from "@/components/ui/photo-placeholder";
import { getMenu, type MenuItem } from "@/lib/inventory";
import { formatCents } from "@/lib/money";
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
      <PhotoPlaceholder className={`aspect-photo w-full ${soldOut ? "opacity-60" : ""}`} />
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className={`font-sans text-lg font-semibold ${soldOut ? "text-tertiary" : ""}`}>
            {flavor.name}
          </h2>
          <span className={`tabular-nums ${soldOut ? "text-tertiary" : ""}`}>
            {formatCents(flavor.priceCents)}
          </span>
        </div>
        {flavor.description && <p className="text-sm text-secondary">{flavor.description}</p>}
      </div>
      <Stock remaining={flavor.remaining} />
    </article>
  );
}

export default async function MenuPage() {
  const week = await getOrderableWeek();
  const menu = await getMenu(week?.id ?? null);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <h1 className="text-4xl font-semibold sm:text-5xl">
        {week ? "This week's bake" : "The menu"}
      </h1>
      {week ? (
        <div className="mt-3 flex flex-col gap-1 text-secondary">
          <p>Orders close {formatClosesAt(week.ordersCloseAt)}</p>
          <p>Pickup {formatPickupWeekend(week.pickupWeekendStart)}</p>
        </div>
      ) : (
        <p className="mt-3 text-secondary">Orders are closed right now. A new batch goes up most weeks.</p>
      )}

      {menu.length === 0 ? (
        <p className="mt-10 text-secondary">Nothing on the menu yet. Check back soon.</p>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {menu.map((flavor) => (
            <FlavorCard key={flavor.id} flavor={flavor} />
          ))}
        </div>
      )}

      <p className="mt-12 text-sm text-tertiary">
        Pickup only, Saturday and Sunday. All sales are final — no refunds or cancellations.
      </p>
    </main>
  );
}
