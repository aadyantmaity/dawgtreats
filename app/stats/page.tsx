import Link from "next/link";
import { notFound } from "next/navigation";

import { StatsPanel } from "@/app/stats/stats-panel";
import { currentAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stats" };

export default async function StatsPage() {
  if (!(await currentAdmin())) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 animate-fade py-12">
      <h1 className="text-4xl font-semibold">Stats</h1>
      <div className="mt-3">
        <StatsPanel />
      </div>
      <Link href="/account" className="mt-8 inline-flex min-h-control items-center underline">
        Back to your account
      </Link>
    </main>
  );
}
