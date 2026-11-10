"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";

import { submitApplication } from "@/app/team/apply-actions";
import { buttonClass } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Message } from "@/components/ui/message";
import { Select } from "@/components/ui/select";
import { APPLICATION_YEARS, LIMITS } from "@/lib/validation";

const YEARS = APPLICATION_YEARS.map((year) => ({
  value: year,
  label: year.charAt(0).toUpperCase() + year.slice(1),
}));

type Year = (typeof APPLICATION_YEARS)[number] | "";

const label = "text-sm text-secondary";
const area =
  "min-h-28 w-full rounded-control border border-default bg-surface p-4 text-base text-primary placeholder:text-tertiary transition-colors ease-spring focus:border-focus focus:outline-none";

export function ApplyForm() {
  const [year, setYear] = useState<Year>("");
  const [product, setProduct] = useState(false);
  const [engineering, setEngineering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const doneRef = useRef<HTMLParagraphElement>(null);

  // Before a role is ticked both questions show, so the form never looks half written.
  const neither = !product && !engineering;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await submitApplication(form);
      if (result.ok) {
        setDone(true);
        doneRef.current?.focus();
      } else {
        setError(result.error);
      }
    });
  }

  if (done) {
    return (
      <Message tone="success">
        <span ref={doneRef} tabIndex={-1}>
          Your application is in. Check your email for a copy.
        </span>
      </Message>
    );
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={onSubmit}>
      <div className="grid gap-6 sm:grid-cols-2">
        <Input label="Name" name="name" autoComplete="name" required />
        <Input label="Email" name="email" type="email" autoComplete="email" required />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <Select
            label="Year"
            value={year}
            options={YEARS}
            onChange={setYear}
            placeholder="Choose a year"
          />
          {/* The select is a listbox, not an input, so the form needs the value written down. */}
          <input type="hidden" name="year" value={year} />
        </div>
        <Input label="Major" name="major" required />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={label}>Which role?</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="roles"
              value="product"
              checked={product}
              onChange={(event) => setProduct(event.target.checked)}
              className="size-4 accent-action"
            />
            Product &amp; Operations
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="roles"
              value="engineering"
              checked={engineering}
              onChange={(event) => setEngineering(event.target.checked)}
              className="size-4 accent-action"
            />
            Software Engineering
          </label>
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="resume" className={label}>
          Resume
        </label>
        <input
          id="resume"
          name="resume"
          type="file"
          accept=".pdf,.doc,.docx"
          required
          className="w-full rounded-control border border-default bg-surface p-3 text-base text-primary file:mr-4 file:rounded-control-sm file:border-0 file:bg-action file:px-4 file:py-2 file:text-sm file:text-on-action"
        />
        <p className="text-sm text-tertiary">PDF or Word, 5 MB max.</p>
      </div>

      <Input
        label="Link to something you made and finished"
        name="link"
        placeholder="github.com/you, a site, a deck, anything"
        required
      />

      {(neither || product) && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="productAnswer" className={label}>
            Product &amp; Operations: what feature or improvement would you propose for Dawg Treats,
            and why?
          </label>
          <textarea
            id="productAnswer"
            name="productAnswer"
            maxLength={LIMITS.answerMax}
            required={product}
            className={area}
          />
        </div>
      )}

      {(neither || engineering) && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="engineeringAnswer" className={label}>
            Software Engineering: what is the most technically challenging thing you have built?
          </label>
          <textarea
            id="engineeringAnswer"
            name="engineeringAnswer"
            maxLength={LIMITS.answerMax}
            required={engineering}
            className={area}
          />
        </div>
      )}

      <div className="sm:max-w-36">
        <Input
          label="Hours a week"
          name="hoursPerWeek"
          type="number"
          min={LIMITS.hoursMin}
          max={LIMITS.hoursMax}
          placeholder="10"
          required
        />
      </div>

      {error && <Message tone="error">{error}</Message>}

      <button
        type="submit"
        disabled={pending}
        className={buttonClass({ size: "md", className: "self-start" })}
      >
        {pending ? "Sending" : "Send application"}
      </button>
    </form>
  );
}
