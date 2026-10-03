"use client";

import { useState, useTransition, type FormEvent } from "react";

import { submitFeedback } from "@/app/feedback-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LIMITS, messageError } from "@/lib/validation";

const STARS = [1, 2, 3, 4, 5];

export function FeedbackForm({
  className = "",
  onDone,
}: {
  className?: string;
  onDone?: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const messageProblem = messageError(message);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTried(true);
    setError(null);
    if (messageProblem) return;

    startTransition(async () => {
      const result = await submitFeedback({ rating, message, name });
      if (!result.ok) return setError(result.error);
      setDone(true);
      // Let them read the thank-you before a popup closes itself.
      if (onDone) setTimeout(onDone, 1500);
    });
  }

  if (done) {
    return (
      <div className={className}>
        <p className="font-medium">Thanks.</p>
        <p className="mt-1 text-sm text-secondary">I read all of these.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className={`flex flex-col gap-4 ${className}`}>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-secondary">Rate the cookies (optional)</span>
        <div className="flex gap-1">
          {STARS.map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star === rating ? 0 : star)}
              aria-label={`${star} out of 5`}
              aria-pressed={star === rating}
              className={`h-control-sm w-control-sm rounded-control-sm text-2xl leading-none transition-colors ${
                star <= rating ? "text-rating" : "text-tertiary hover:text-secondary"
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="feedback-message" className="text-sm text-secondary">
          What&apos;s on your mind?
        </label>
        <textarea
          id="feedback-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onBlur={() => setTried(true)}
          maxLength={LIMITS.messageMax}
          rows={3}
          aria-invalid={tried && messageProblem ? true : undefined}
          className="w-full rounded-control border border-default bg-surface px-4 py-3 text-base text-primary placeholder:text-tertiary focus:border-focus focus:outline-none aria-invalid:border-error"
          placeholder="Matcha white chocolate"
        />
        {tried && messageProblem ? (
          <p className="text-sm text-error">{messageProblem}</p>
        ) : (
          <p className="text-sm text-tertiary">
            {LIMITS.messageMax - message.trim().length} characters left
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
          {pending ? "Sending…" : "Send"}
        </Button>
      </div>
    </form>
  );
}
