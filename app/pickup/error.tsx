"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

// The owner reads this with a queue in front of them, so it says what to do rather than
// what broke. Nothing here has touched an order: the screen only reads them.
export default function PickupError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("pickup_screen_failed", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 animate-fade py-12">
      <h1 className="text-4xl font-semibold">Pickup day didn&apos;t load</h1>
      <p className="mt-3 text-secondary">
        Try again. If it keeps failing, check you&apos;re still signed in. No order has
        changed, so nothing is lost.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Button size="md" onClick={reset}>
          Try again
        </Button>
        <Link href="/account" className="inline-flex min-h-control items-center underline">
          Check my sign-in
        </Link>
      </div>
    </main>
  );
}
