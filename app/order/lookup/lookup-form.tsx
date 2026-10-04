"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/loading";

// Codes are four characters now; the older eight-character ones still have to work.
const CODE = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{4,8}$/;

export function LookupForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [navigating, startTransition] = useTransition();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!CODE.test(clean)) {
      setError("That code is letters and numbers, 4 characters.");
      return;
    }

    setError(null);
    setChecking(true);
    try {
      const response = await fetch(`/api/orders/${clean}`);
      if (response.status === 404) {
        setError("No order with that code. Check it and try again.");
        return;
      }
      if (response.status === 429) {
        setError("Too many tries. Wait a minute and try again.");
        return;
      }
      // Anything else failing means we cannot say whether the order exists, so sending
      // them to its page would show a confusing empty one instead of saying so.
      if (!response.ok) {
        setError("Something went wrong. Try again in a moment.");
        return;
      }
      startTransition(() => router.push(`/order/${clean}`));
    } catch {
      setError("Couldn’t reach the server. Check your connection and try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-8 flex flex-col gap-4">
      <Input
        label="Order code"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        onBlur={() => setCode((c) => c.trim().toUpperCase())}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={8}
        placeholder="4X7K"
        error={error ?? undefined}
        className="font-mono tracking-widest tabular-nums"
      />
      <Button type="submit" size="md" disabled={checking || navigating}>
        {checking || navigating ? (
          <span className="inline-flex items-center gap-2">
            <Spinner className="size-4" />
            Looking…
          </span>
        ) : (
          "Find my order"
        )}
      </Button>
    </form>
  );
}
