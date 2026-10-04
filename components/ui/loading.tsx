// Placeholders that hold the shape of what is coming, so the page does not jump
// when it arrives. Hidden from screen readers; each page says "Loading" itself.
export function Bone({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`shimmer rounded-control-sm ${className}`} />;
}

export function Spinner({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`spinner ${className}`} />;
}

// Announced once per page so a screen reader is told the wait, not the shapes.
export function LoadingNote({ children = "Loading" }: { children?: string }) {
  return (
    <p role="status" className="sr-only">
      {children}
    </p>
  );
}
