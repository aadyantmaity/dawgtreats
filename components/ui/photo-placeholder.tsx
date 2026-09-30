export function PhotoPlaceholder({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-control-sm bg-placeholder text-tertiary ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-1/2">
        <path d="M21 12.5A9 9 0 1 1 11.5 3a2.5 2.5 0 0 0 3 3 2.5 2.5 0 0 0 3.5 3.5 2.5 2.5 0 0 0 3 3Z" />
        <circle cx="8.5" cy="9.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="14" cy="13" r="1" fill="currentColor" stroke="none" />
        <circle cx="9" cy="15.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="15.5" cy="17" r="0.75" fill="currentColor" stroke="none" />
      </svg>
    </div>
  );
}
