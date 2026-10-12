import { Check, CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

const tones = {
  error: { icon: CircleAlert, text: "text-error", role: "alert" },
  success: { icon: Check, text: "text-success", role: "status" },
};

type MessageProps = {
  tone: keyof typeof tones;
  children: ReactNode;
  className?: string;
};

export function Message({ tone, children, className = "" }: MessageProps) {
  const { icon: Icon, text, role } = tones[tone];

  return (
    <p role={role} className={`flex items-start gap-2 ${text} ${className}`}>
      {/* The icon marks the first line of the refusal, so it sits on that line's text
          rather than in the middle of a paragraph that wrapped. */}
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      {children}
    </p>
  );
}
