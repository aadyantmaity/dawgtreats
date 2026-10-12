"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";

import { submitFeedback } from "@/app/feedback-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Message } from "@/components/ui/message";
import { LIMITS, messageError, ratingError } from "@/lib/validation";

const STARS = [1, 2, 3, 4, 5];

const STEMS = ["Bake this next:", "More of these:", "Pickup was", "Too sweet"];

export function FeedbackForm({
  className = "",
  compact = false,
  onDone,
}: {
  className?: string;
  // The popup is an aside, not the page: it asks for less so the Send button stays in
  // view on a short phone. The whole form still lives on /feedback.
  compact?: boolean;
  onDone?: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const [bumped, setBumped] = useState(0);
  const [refused, setRefused] = useState(false);
  const [seeded, setSeeded] = useState(0);
  const messageBox = useRef<HTMLTextAreaElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);

  const messageProblem = messageError(message);
  const ratingProblem = ratingError(rating);

  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  // The caret can only go to the end once React has rendered the new value, so this
  // waits for that render instead of moving it in the click.
  useEffect(() => {
    if (!seeded) return;
    const box = messageBox.current;
    if (!box) return;
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
  }, [seeded]);

  // A stem replaces the box. Picking a second one means the first was the wrong start,
  // so keeping it would leave two openings to delete by hand.
  function seedMessage(stem: string) {
    setMessage(`${stem} `);
    setSeeded((count) => count + 1);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTried(true);
    setError(null);
    if (ratingProblem || messageProblem) {
      // The message problem also appears on blur, where a shake would nag. Only a refused
      // send reads as a refusal.
      setRefused(true);
      return;
    }

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
      // The form it replaces is gone, so without a home focus lands on the page body and
      // a reader is told nothing. This takes the focus and says what happened.
      <div
        ref={doneRef}
        role="status"
        tabIndex={-1}
        className={`animate-rise outline-none ${className}`}
      >
        <p className="font-medium">Thanks.</p>
        <p className="mt-1 text-sm text-secondary">I read all of these.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className={`flex flex-col gap-4 ${className}`}>
      <div
        className={`flex flex-col gap-1.5 ${refused && ratingProblem ? "animate-shake" : ""}`}
        // A child's animation must not end this one.
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget) setRefused(false);
        }}
      >
        <span className="text-sm text-secondary">Rate the cookies</span>
        <div className="flex gap-1" onMouseLeave={() => setHovered(0)}>
          {STARS.map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => {
                const next = star === rating ? 0 : star;
                setRating(next);
                // The bump says "this is your rating". Clearing one leaves no rating to
                // announce, so taking a star back stays quiet.
                if (next) setBumped(star);
              }}
              // The class comes off once it has played, so choosing the same star again
              // replays it. Nothing remounts, so the star keeps its focus.
              onAnimationEnd={() => setBumped(0)}
              onMouseEnter={() => setHovered(star)}
              onFocus={() => setHovered(star)}
              onBlur={() => setHovered(0)}
              aria-label={`${star} out of 5`}
              aria-pressed={star === rating}
              // A press must read as immediate; only the release springs back.
              className={`size-control rounded-control-sm text-2xl leading-none transition ease-spring hover:-translate-y-0.5 focus-visible:-translate-y-0.5 active:duration-100 active:scale-95 ${
                star <= (hovered || rating) ? "text-rating" : "text-tertiary"
              } ${bumped === star ? "animate-bump" : ""}`}
            >
              ★
            </button>
          ))}
        </div>
        {tried && ratingProblem && <p className="text-sm text-error">{ratingProblem}</p>}
      </div>

      <div
        className={`flex flex-col gap-1.5 ${refused && messageProblem ? "animate-shake" : ""}`}
        // A child's animation must not end this one.
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget) setRefused(false);
        }}
      >
        <label htmlFor="feedback-message" className="text-sm text-secondary">
          What&apos;s on your mind? (optional)
        </label>
        <div role="group" aria-label="Starters" className="flex flex-wrap gap-2">
          {STEMS.map((stem) => (
            <button
              key={stem}
              type="button"
              // A press must not take focus off the box. The blur shows the rating error, which
              // moves this row down between mousedown and mouseup and loses the click.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => seedMessage(stem)}
              className="inline-flex h-control items-center rounded-pill border border-default bg-surface px-3 text-sm text-secondary transition-colors ease-spring hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {stem}
            </button>
          ))}
        </div>
        <textarea
          ref={messageBox}
          id="feedback-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onBlur={() => setTried(true)}
          maxLength={LIMITS.messageMax}
          rows={compact ? 2 : 3}
          aria-invalid={tried && messageProblem ? true : undefined}
          className="w-full rounded-card border border-default bg-surface px-4 py-3 text-base text-primary placeholder:text-tertiary focus:border-focus focus:outline-none aria-invalid:border-error"
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

      {!compact && (
        <Input
          label="Your name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          maxLength={LIMITS.nameMax}
        />
      )}

      {error && (
        <Message tone="error" className="text-sm">
          {error}
        </Message>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send"}
        </Button>
      </div>
    </form>
  );
}
