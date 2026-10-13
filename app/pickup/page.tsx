import Link from "next/link";
import { notFound } from "next/navigation";

import { PickupPanel } from "@/app/pickup/pickup-panel";
import { currentAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pickup day" };

// Kept as its own address for a phone in the lobby, where the account page's other two
// sections are only in the way. The screen itself lives in one place.
export default async function PickupPage() {
  if (!(await currentAdmin())) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 animate-fade py-12">
      <h1 className="text-4xl font-semibold">Pickup day</h1>
      <div className="mt-3">
        <PickupPanel />
      </div>
      <Link href="/account" className="mt-8 inline-flex min-h-control items-center underline">
        Back to your account
      </Link>
    </main>
  );
}
