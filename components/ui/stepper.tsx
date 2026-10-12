"use client";

import { Minus, Plus } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";

import { bump } from "@/lib/motion";

type StepperProps = {
  label: string;
  value: string;
  // Typing reports a change per digit, so a caller that reacts to a change acts on
  // `step` only. Arrow keys count as a step: each one moves the number once.
  onChange: (value: string, from: "step" | "type") => void;
  min?: number;
  max: number;
  invalid?: boolean;
  describedBy?: string;
};

const buttonClass =
  "grid size-control shrink-0 place-items-center rounded-control border border-default bg-surface text-lg text-primary transition ease-spring hover:bg-hover hover:-translate-y-0.5 active:duration-100 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:pointer-events-none disabled:bg-disabled disabled:text-disabled disabled:transition-none";

// Holds a string so the box can be briefly empty while typing; an empty box counts as `min`.
export function Stepper({ label, value, onChange, min = 0, max, invalid = false, describedBy }: StepperProps) {
  const current = Number(value || String(min));
  const inputRef = useRef<HTMLInputElement>(null);
  // Typing has to obey the same ceiling the buttons do. Truncating the digits is not a
  // clamp: with a max of 24 it still lets 99 through, and the cart then cannot be paid for.
  const digitsOnly = (raw: string) => {
    const digits = raw
      .replace(/\D/g, "")
      .replace(/^0+(?=\d)/, "")
      .slice(0, String(max).length);
    if (digits === "") return "";
    return String(Math.min(max, Math.max(min, Number(digits))));
  };

  const step = (delta: number) => {
    const next = String(Math.min(max, Math.max(min, current + delta)));
    onChange(next, "step");
    // A bordered box this wide reaches the buttons beside it well before animate-bump's 1.5.
    if (next !== String(current)) bump(inputRef.current, 1.12);
  };

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    step(event.key === "ArrowUp" ? 1 : -1);
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={current <= min}
        onClick={() => step(-1)}
        className={buttonClass}
      >
        <Minus aria-hidden className="size-5" />
      </button>
      <input
        ref={inputRef}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onFocus={(e) => e.target.select()}
        onChange={(e) => onChange(digitsOnly(e.target.value), "type")}
        onBlur={() => {
          if (value === "") onChange(String(min), "type");
        }}
        onKeyDown={onKeyDown}
        className="h-control w-16 rounded-control border border-default bg-surface px-2 text-center text-base text-primary tabular-nums focus:border-focus focus:outline-none aria-invalid:border-error"
      />
      <button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={current >= max}
        onClick={() => step(1)}
        className={buttonClass}
      >
        <Plus aria-hidden className="size-5" />
      </button>
    </div>
  );
}
