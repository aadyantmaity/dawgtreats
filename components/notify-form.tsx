"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { emailError } from "@/lib/validation";

// Shown only while ordering is shut: the one moment someone wants cookies and
// cannot have them.
export function NotifyForm({ signedInAs }: { signedInAs?: string | null }) {
  const [email, setEmail] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <p className="mt-6 text-secondary" role="status">
        You&apos;re on the list. I&apos;ll email you when the next batch opens.
      </p>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!signedInAs) {
      const wrong = emailError(email);
      if (wrong) return setProblem(wrong);
    }

    setPending(true);
    try {
      const response = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signedInAs ? {} : { email }),
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const message =
          body && typeof body === "object" && "error" in body ? String(body.error) : null;
        setProblem(message ?? "That didn't send. Try again in a moment.");
        return;
      }
      setDone(true);
    } catch {
      setProblem("That didn't send. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (signedInAs) {
    return (
      <form onSubmit={submit} className="mt-6 flex flex-col items-start gap-2">
        <Button type="submit" size="md" disabled={pending}>
          {pending ? "Adding you…" : "Email me when it opens"}
        </Button>
        {problem && <p className="text-sm text-error">{problem}</p>}
      </form>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="mt-6 flex max-w-md flex-col gap-3">
      <Input
        label="Email me when the next batch opens"
        id="notify-email"
        type="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (problem) setProblem(null);
        }}
        autoComplete="email"
        placeholder="you@email.com"
        error={problem ?? undefined}
      />
      <Button type="submit" size="md" disabled={pending} className="self-start">
        {pending ? "Adding you…" : "Tell me when it opens"}
      </Button>
    </form>
  );
}
