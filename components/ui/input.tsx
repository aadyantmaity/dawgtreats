import { useId, type ComponentProps } from "react";

type InputProps = ComponentProps<"input"> & {
  label?: string;
  error?: string;
  hint?: string;
  prefix?: string;
};

export function Input({ label, error, hint, prefix, id, className = "", ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const message = error ?? hint;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm text-secondary">
          {label}
        </label>
      )}
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-secondary">
            {prefix}
          </span>
        )}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className={`h-11 w-full rounded-xl border border-default bg-surface text-base text-primary placeholder:text-tertiary focus:border-focus focus:outline-none disabled:bg-disabled disabled:text-disabled aria-invalid:border-error ${prefix ? "pr-3.5 pl-7" : "px-3.5"} ${className}`}
          {...props}
        />
      </div>
      {message && (
        <p id={messageId} className={`text-sm ${error ? "text-error" : "text-tertiary"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
