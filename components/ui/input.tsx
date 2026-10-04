import { useId, type ComponentProps } from "react";

type InputProps = ComponentProps<"input"> & {
  label?: string;
  error?: string;
  hint?: string;
};

export function Input({ label, error, hint, id, className = "", ...props }: InputProps) {
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
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        className={`h-control w-full rounded-control border border-default bg-surface text-base text-primary placeholder:text-tertiary transition-colors ease-spring duration-motion focus:border-focus focus:outline-none disabled:bg-disabled disabled:text-disabled disabled:transition-none aria-invalid:border-error aria-invalid:transition-none px-4 ${className}`}
        {...props}
      />
      {message && (
        <p id={messageId} className={`text-sm ${error ? "text-error" : "text-tertiary"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
