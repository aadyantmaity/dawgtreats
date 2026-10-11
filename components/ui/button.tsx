import type { ComponentProps } from "react";

const variants = {
  primary: "bg-action text-on-action hover:bg-action/90",
  secondary: "bg-surface text-primary border border-default hover:bg-hover",
};

// The small size is only small where there is a cursor. A thumb needs the full control
// height, and this is the default size, so every button on the site inherits it.
const sizes = {
  sm: "h-control px-4 text-sm rounded-control-sm sm:h-control-sm",
  md: "h-control px-5 text-base rounded-control",
};

type ButtonProps = ComponentProps<"button"> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

const base =
  "inline-flex items-center justify-center font-medium transition ease-spring hover:-translate-y-0.5 active:duration-100 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:pointer-events-none disabled:border disabled:border-default disabled:bg-disabled disabled:text-disabled disabled:transition-none";

// A link that acts as a button needs these same classes, and a <Link> cannot be a
// <button>. Exporting the string keeps one source rather than a copy that drifts.
export function buttonClass({
  variant = "primary",
  size = "sm",
  className = "",
}: {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
} = {}): string {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`;
}

export function Button({
  variant = "primary",
  size = "sm",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return <button type={type} className={buttonClass({ variant, size, className })} {...props} />;
}
