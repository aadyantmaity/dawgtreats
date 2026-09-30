import type { ComponentProps } from "react";

type CardProps = ComponentProps<"div"> & {
  title?: string;
};

export function Card({ title, className = "", children, ...props }: CardProps) {
  return (
    <div className={`rounded-card border border-default bg-surface p-5 ${className}`} {...props}>
      {title && <h2 className="mb-3 text-lg font-semibold">{title}</h2>}
      {children}
    </div>
  );
}
