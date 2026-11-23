// The bar renders at its real width. A fill that grows from empty on every mount shows a
// figure that was never true, and the reader has to wait to read the one that is.
export function FunnelBar({ share }: { share: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-pill bg-subtle">
      <div
        className="h-2 w-full origin-left rounded-pill bg-action"
        style={{ transform: `scaleX(${share / 100})` }}
      />
    </div>
  );
}
