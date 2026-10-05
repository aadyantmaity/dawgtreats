import type { ComponentProps } from "react";

const tones = {
  neutral: "bg-subtle text-secondary border-default",
  success: "bg-success text-success border-transparent",
  warning: "bg-warning text-warning border-transparent",
};

type BadgeProps = ComponentProps<"span"> & {
  tone?: keyof typeof tones;
};

export function Badge({ tone = "neutral", className = "", ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-xs font-medium transition-colors ${tones[tone]} ${className}`}
      {...props}
    />
  );
}
