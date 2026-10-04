import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { COUNTING_SINCE, funnelForWeek } from "@/lib/analytics";
import { currentAdmin } from "@/lib/auth";
import { formatPickupWeekend, formatPt, listWeeks } from "@/lib/weeks";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stats" };

const ORDER_WORDS: Record<string, string> = {
  paid: "Paid",
  pending: "Started paying, not finished",
  expired: "Reached payment, never paid",
  ready: "Bagged",
  picked_up: "Picked up",
};

export default async function StatsPage() {
  if (!(await currentAdmin())) notFound();

  const weeks = await listWeeks();
  const week = weeks.find((w) => w.status === "open") ?? weeks[0];
  if (!week) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-4xl font-semibold">Stats</h1>
        <p className="mt-3 text-secondary">No weeks yet.</p>
      </main>
    );
  }

  const { steps, byFlavor, byWanted, orders } = await funnelForWeek(week.id);
  const top = steps[0].people;
  const bought = orders
    .filter((row) => row.status !== "pending" && row.status !== "expired")
    .reduce((sum, row) => sum + row.count, 0);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6">
      <h1 className="text-4xl font-semibold">Stats</h1>
      <p className="mt-3 text-secondary">{formatPickupWeekend(week.pickupWeekendStart)}</p>

      <Card title="How far people got" className="mt-8">
        {top === 0 ? (
          <p className="text-secondary">Nobody has visited since counting started.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {[...steps, { step: "Paid", people: bought }].map((row) => {
              const share = top > 0 ? Math.round((row.people / top) * 100) : 0;
              // Orders placed before counting began have no visit to be a share of.
              const comparable = share <= 100;
              return (
                <li key={row.step} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm">{row.step}</span>
                    <span className="text-sm tabular-nums text-secondary">
                      {row.people}
                      {comparable && top > 0 && ` · ${share}%`}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-pill bg-subtle">
                    <div
                      className="h-2 rounded-pill bg-action"
                      style={{ width: `${Math.min(100, share)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="What they added" className="mt-6">
        {byFlavor.length === 0 ? (
          <p className="text-secondary">Nobody has added a cookie yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {byFlavor.map((row) => (
              <li key={row.flavor} className="flex justify-between gap-4 text-sm">
                <span>{row.flavor}</span>
                <span className="tabular-nums text-secondary">{row.adds}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Wanted while sold out" className="mt-6">
        {byWanted.length === 0 ? (
          <p className="text-secondary">Nobody has asked for a sold-out flavor yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {byWanted.map((row) => (
              <li key={row.flavor} className="flex justify-between gap-4 text-sm">
                <span>{row.flavor}</span>
                <span className="tabular-nums text-secondary">{row.wanted}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Orders" className="mt-6">
        {orders.length === 0 ? (
          <p className="text-secondary">No orders this week.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {orders.map((row) => (
              <li key={row.status} className="flex justify-between gap-4 text-sm">
                <span>{ORDER_WORDS[row.status] ?? row.status}</span>
                <span className="tabular-nums text-secondary">{row.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="mt-6 text-sm text-tertiary">
        Counts are people, not clicks: someone who opens the menu twice counts once. Everything
        here starts {formatPt(COUNTING_SINCE, { month: "long", day: "numeric" })}, when counting
        began, so earlier orders are left out.
      </p>

      <Link href="/pickup" className="mt-6 inline-block py-2 underline">
        Pickup day
      </Link>
    </main>
  );
}
