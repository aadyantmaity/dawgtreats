import type { KeyboardEvent } from "react";

type StepperProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max: number;
  invalid?: boolean;
  describedBy?: string;
};

const buttonClass =
  "grid size-11 shrink-0 place-items-center rounded-xl border border-default bg-surface text-lg text-primary hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:pointer-events-none disabled:bg-disabled disabled:text-disabled";

// Holds a string so the box can be briefly empty while typing; an empty box counts as `min`.
export function Stepper({ label, value, onChange, min = 0, max, invalid = false, describedBy }: StepperProps) {
  const current = Number(value || String(min));
  const step = (delta: number) => onChange(String(Math.min(max, Math.max(min, current + delta))));
  const digitsOnly = (raw: string) =>
    raw
      .replace(/\D/g, "")
      .replace(/^0+(?=\d)/, "")
      .slice(0, String(max).length);

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
        −
      </button>
      <input
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onFocus={(e) => e.target.select()}
        onChange={(e) => onChange(digitsOnly(e.target.value))}
        onBlur={() => {
          if (value === "") onChange(String(min));
        }}
        onKeyDown={onKeyDown}
        className="h-11 w-16 rounded-xl border border-default bg-surface px-2 text-center text-base text-primary tabular-nums focus:border-focus focus:outline-none aria-invalid:border-error"
      />
      <button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={current >= max}
        onClick={() => step(1)}
        className={buttonClass}
      >
        +
      </button>
    </div>
  );
}
