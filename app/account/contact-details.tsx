"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { messageFromBody } from "@/lib/errors";
import { LIMITS, formatPhoneInput, phoneError } from "@/lib/validation";

export function ContactDetails({
  name: savedName,
  phone: savedPhone,
  className = "",
}: {
  name: string | null;
  phone: string | null;
  className?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(savedName ?? "");
  const [phone, setPhone] = useState(formatPhoneInput(savedPhone ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [sending, setSending] = useState(false);
  const [touchedPhone, setTouchedPhone] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [refreshing, startTransition] = useTransition();

  // Blank is fine here: an account only needs a number once it reaches checkout.
  const phoneProblem = phoneError(phone, false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setTouchedPhone(true);
    // The phone refusal comes from the value, not from the attempt, so the same refusal
    // comes back unchanged. The count is what tells the field to shake again.
    setAttempt((count) => count + 1);
    if (phoneProblem) return;
    setSending(true);
    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(messageFromBody(data, "Couldn’t save that."));
        return;
      }
      setSaved(true);
      startTransition(() => router.refresh());
    } catch {
      setError("Couldn’t reach the server. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card title="Your details" className={className}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <p className="text-sm text-secondary">Saved for next time.</p>
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          maxLength={LIMITS.nameMax}
        />
        <Input
          label="Phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
          onBlur={() => setTouchedPhone(true)}
          error={touchedPhone ? (phoneProblem ?? undefined) : undefined}
          attempt={attempt}
          autoComplete="tel"
          inputMode="tel"
          placeholder="(425) 515-4457"
        />
        {error && <p className="text-sm text-error">{error}</p>}
        {saved && <p className="text-sm text-success">Saved.</p>}
        <div>
          <Button type="submit" disabled={sending || refreshing}>
            {sending || refreshing ? "Saving…" : "Save details"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
