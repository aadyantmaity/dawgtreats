"use client";

import { useState, useTransition, type FormEvent } from "react";

import { submitRequest } from "@/app/feedback-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LIMITS, requestError } from "@/lib/validation";

export function RequestForm({
  className = "",
  onDone,
}: {
  className?: string;
  onDone?: () => void;
}) {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const textProblem = requestError(text);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTried(true);
    setError(null);
    if (textProblem) return;

    startTransition(async () => {
      const result = await submitRequest({ name, text });
      if (!result.ok) return setError(result.error);
      setDone(true);
      // Let them read the thank-you before the panel closes itself.
      if (onDone) setTimeout(onDone, 1500);
    });
  }

  if (done) {
    return (
      <Card title="Got it" className={className}>
        <p className="text-secondary">Thanks — I&apos;ll see what I can do.</p>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="request" className="text-sm text-secondary">
            Your idea
          </label>
          <textarea
            id="request"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => setTried(true)}
            maxLength={LIMITS.requestMax}
            rows={3}
            aria-invalid={tried && textProblem ? true : undefined}
            className="w-full rounded-control border border-default bg-surface px-4 py-3 text-base text-primary placeholder:text-tertiary focus:border-focus focus:outline-none aria-invalid:border-error"
            placeholder="Double chocolate with sea salt"
          />
          {tried && textProblem ? (
            <p className="text-sm text-error">{textProblem}</p>
          ) : (
            <p className="text-sm text-tertiary">
              {LIMITS.requestMax - text.trim().length} characters left
            </p>
          )}
        </div>

        <Input
          label="Your name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          maxLength={LIMITS.nameMax}
        />

        {error && <p className="text-sm text-error">{error}</p>}

        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Sending…" : "Send it"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
