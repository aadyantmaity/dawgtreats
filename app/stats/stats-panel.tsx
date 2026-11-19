
import { FunnelBar } from "@/app/stats/funnel-bar";
import { Card } from "@/components/ui/card";
import { COUNTING_SINCE, funnel } from "@/lib/analytics";
import { listFeedback } from "@/lib/feedback";
import { LIMITS } from "@/lib/validation";
import { formatPt } from "@/lib/weeks";

const DEVICE_WORDS: Record<string, string> = {
  phone: "Phone or tablet",
  desktop: "Laptop or desktop",
  unknown: "Counted before this was recorded",
};

const STARS = Array.from({ length: LIMITS.ratingMax }, (_, index) => index + 1);

const ORDER_WORDS: Record<string, string> = {
  paid: "Paid",
  pending: "Started paying, not finished",
  expired: "Reached payment, never paid",
  ready: "Bagged",
  picked_up: "Picked up",
};

// Every star below is hidden, so the label is the whole rating. It needs the role: ARIA
// ignores a label on a plain span, and the rating reached a screen reader as nothing.
function Stars({ rating }: { rating: number }) {
  return (
    <span role="img" aria-label={`${rating} out of ${LIMITS.ratingMax}`} className="text-base leading-none">
      {STARS.map((star) => (
        <span key={star} aria-hidden className={star <= rating ? "text-rating" : "text-tertiary"}>
          ★
        </span>
      ))}
    </span>
  );
}

// The counts, as a section rather than a page: the owner reaches them inside their
// account, beside the pickup day.
export async function StatsPanel() {
  const { steps, byFlavor, byWanted, byDevice, orders } = await funnel();
  // The 1-star rows are tests left during the build. They stay in the table, and
  // `npm run admin -- feedback` still prints them, so nothing is lost.
  const said = (await listFeedback()).filter((note) => note.rating !== 1);
  const rated = said.filter((note) => note.rating !== null);
  const average = rated.reduce((sum, note) => sum + (note.rating ?? 0), 0) / (rated.length || 1);
  const top = steps[0].people;
  const bought = orders
    .filter((row) => row.status !== "pending" && row.status !== "expired")
    .reduce((sum, row) => sum + row.count, 0);

  return (
    <div>
      <p className="text-secondary">
        Everything since {formatPt(COUNTING_SINCE, { month: "long", day: "numeric" })}
      </p>

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
                    <span className="text-sm text-secondary">
                      {row.people}
                      {comparable && top > 0 && ` · ${share}%`}
                    </span>
                  </div>
                  <FunnelBar share={Math.min(100, share)} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="Phone or laptop" className="mt-6">
        {byDevice.length === 0 ? (
          <p className="text-secondary">Nothing counted yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {byDevice.map((row) => (
              <li key={row.device} className="flex justify-between gap-4 text-sm">
                <span className="capitalize">{DEVICE_WORDS[row.device] ?? row.device}</span>
                <span className="text-secondary">{row.people}</span>
              </li>
            ))}
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
                <span className="text-secondary">{row.adds}</span>
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
                <span className="text-secondary">{row.wanted}</span>
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
                <span className="text-secondary">{row.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="What people said" className="mt-6">
        {said.length === 0 ? (
          <p className="text-secondary">Nobody has written yet.</p>
        ) : (
          <>
            {rated.length > 0 && (
              <p className="mb-3 text-sm text-secondary">
                {average.toFixed(1)} average from {rated.length}
              </p>
            )}
            <ul className="flex flex-col gap-4">
              {said.map((note) => (
                <li
                  key={note.id}
                  className="flex flex-col gap-1 border-b border-default pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    {note.rating === null ? (
                      <span className="text-sm text-tertiary">No rating</span>
                    ) : (
                      <Stars rating={note.rating} />
                    )}
                    <span className="text-sm text-tertiary">
                      {formatPt(note.createdAt, { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-line">{note.message}</p>
                  <p className="text-sm text-tertiary">{note.name ?? "anonymous"}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <p className="mt-6 text-sm text-tertiary">
        Counts are people, not clicks: someone who opens the menu twice counts once. Visits made
        while ordering was shut count too, so a quiet week still shows who came by.
      </p>

    </div>
  );
}
