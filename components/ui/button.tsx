import type { ComponentProps } from "react";

const variants = {
  primary: "bg-action text-on-action hover:bg-action/90",
  secondary: "bg-surface text-primary border border-default hover:bg-hover",
};

const sizes = {
  sm: "h-control-sm px-4 text-sm rounded-control-sm",
  md: "h-control px-5 text-base rounded-control",
};

type ButtonProps = ComponentProps<"button"> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export function Button({
  variant = "primary",
  size = "sm",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:pointer-events-none disabled:border disabled:border-default disabled:bg-disabled disabled:text-disabled ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
