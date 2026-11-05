"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { buttonClass } from "@/components/ui/button";

const YEARS = [
  { value: "freshman", label: "Freshman" },
  { value: "sophomore", label: "Sophomore" },
  { value: "junior", label: "Junior" },
  { value: "senior", label: "Senior" },
  { value: "other", label: "Other" },
] as const;

type Year = (typeof YEARS)[number]["value"] | "";

const field = "text-sm text-secondary";
const area =
  "min-h-28 w-full rounded-control border border-default bg-surface p-4 text-base text-primary placeholder:text-tertiary transition-colors ease-spring focus:border-focus focus:outline-none";

export function ApplyForm() {
  const [year, setYear] = useState<Year>("");
  const [product, setProduct] = useState(false);
  const [engineering, setEngineering] = useState(false);

  // Before a role is ticked both questions show, so the form never looks half written.
  const neither = !product && !engineering;

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <Input label="Name" name="name" autoComplete="name" required />
        <Input label="Email" name="email" type="email" autoComplete="email" required />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Select label="Year" value={year} options={YEARS} onChange={setYear} placeholder="Choose a year" />
        <Input label="Major" name="major" required />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={field}>Which role?</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="role"
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
              name="role"
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
        <label htmlFor="resume" className={field}>
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
        <p className="text-sm text-tertiary">PDF preferred, 5 MB max.</p>
      </div>

      <Input
        label="Link to something you made and finished"
        name="link"
        type="url"
        placeholder="github.com/you, a site, a deck, anything"
        required
      />

      {(neither || product) && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="idea" className={field}>
            Product &amp; Operations: what feature or improvement would you propose for Dawg Treats, and why?
          </label>
          <textarea id="idea" name="idea" required={product} className={area} />
        </div>
      )}

      {(neither || engineering) && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="hard" className={field}>
            Software Engineering: what is the most technically challenging thing you have built?
          </label>
          <textarea id="hard" name="hard" required={engineering} className={area} />
        </div>
      )}

      <div className="sm:max-w-36">
        <Input label="Hours a week" name="hours" type="number" min={1} max={40} placeholder="10" required />
      </div>

      <p className="text-sm text-tertiary">This form is a preview. Nothing is sent yet.</p>

      <button type="submit" className={buttonClass({ size: "md", className: "self-start" })}>
        Send application
      </button>
    </form>
  );
}
