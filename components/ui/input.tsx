"use client";

import { useId, useState, type ComponentProps } from "react";

type InputProps = ComponentProps<"input"> & {
  label?: string;
  error?: string;
  hint?: string;
  /** Ring the field as well as saying why. An empty field says it is required from the
   * start, which is a label, not something the person has got wrong yet. */
  invalid?: boolean;
  // Bump on every refused submit. Without it the field never shakes, because `error`
  // alone cannot tell a refusal from a keystroke: it changes while someone is still typing.
  attempt?: number;
};

export function Input({
  label,
  error,
  hint,
  attempt,
  id,
  required,
  invalid,
  className = "",
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const message = error ?? hint;
  const [shaking, setShaking] = useState(false);
  const [seenAttempt, setSeenAttempt] = useState(attempt);

  // Set during render, not in an effect: an effect would shake a frame after the refusal
  // appears. React discards this render and re-runs it, so there is no loop.
  if (seenAttempt !== attempt) {
    setSeenAttempt(attempt);
    setShaking(Boolean(error));
  }

  return (
    <div
      className={`flex flex-col gap-1.5 ${shaking ? "animate-shake" : ""}`}
      // A child's animation must not end this one.
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) setShaking(false);
      }}
    >
      {label && (
        <label htmlFor={inputId} className="text-sm text-secondary">
          {label}
        </label>
      )}
      <input
        id={inputId}
        required={required}
        aria-invalid={(invalid ?? Boolean(error)) || undefined}
        aria-describedby={message ? messageId : undefined}
        className={`h-control w-full rounded-control border border-default bg-surface text-base text-primary placeholder:text-tertiary transition-colors ease-spring focus:border-focus focus:outline-none disabled:bg-disabled disabled:text-disabled disabled:transition-none aria-invalid:border-error aria-invalid:transition-none px-4 ${className}`}
        {...props}
      />
      {message && (
        <p
          id={messageId}
          // A refusal has to be heard, not only seen. The hint under an untouched field is
          // not news, so only the error speaks.
          role={error ? "alert" : undefined}
          className={`text-sm ${error ? "text-error" : "text-tertiary"}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
