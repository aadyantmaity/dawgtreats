"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CODE = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{8}$/;

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
      setError("That code is 8 characters, letters and numbers.");
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
        placeholder="486N6XNV"
        error={error ?? undefined}
        className="font-mono tracking-widest tabular-nums"
      />
      <Button type="submit" size="md" disabled={checking || navigating}>
        {checking || navigating ? "Looking…" : "Find my order"}
      </Button>
    </form>
  );
}
