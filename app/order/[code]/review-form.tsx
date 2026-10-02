"use client";

import { useState, useTransition, type FormEvent } from "react";

import { submitReview } from "@/app/feedback-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LIMITS, commentError } from "@/lib/validation";

const STARS = [1, 2, 3, 4, 5];

export function ReviewForm({ orderCode }: { orderCode: string }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const commentProblem = commentError(comment);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTried(true);
    setError(null);
    if (rating === 0 || commentProblem) return;

    startTransition(async () => {
      const result = await submitReview(orderCode, { rating, comment });
      if (result.ok) setDone(true);
      else setError(result.error);
    });
  }

  if (done) {
    return (
      <Card title="Thanks" className="mt-6">
        <p className="text-secondary">That helps more than you&apos;d think.</p>
      </Card>
    );
  }

  return (
    <Card title="How were they?" className="mt-6">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div>
          <div className="flex gap-1">
            {STARS.map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                aria-label={`${star} out of 5`}
                aria-pressed={rating === star}
                className={`h-control-sm w-control-sm rounded-control-sm text-2xl leading-none transition-colors ${
                  star <= rating ? "text-rating" : "text-tertiary hover:text-secondary"
                }`}
              >
                ★
              </button>
            ))}
          </div>
          {tried && rating === 0 && <p className="mt-1 text-sm text-error">Pick a rating</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="comment" className="text-sm text-secondary">
            Anything to add? (optional)
          </label>
          <textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={LIMITS.commentMax}
            rows={3}
            className="w-full rounded-control border border-default bg-surface px-4 py-3 text-base text-primary placeholder:text-tertiary focus:border-focus focus:outline-none"
            placeholder="Too sweet, not sweet enough, perfect…"
          />
          <p className="text-sm text-tertiary">
            {LIMITS.commentMax - comment.trim().length} characters left
          </p>
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Sending…" : "Send"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
