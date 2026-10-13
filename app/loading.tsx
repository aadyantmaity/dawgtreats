import { Bone, LoadingNote } from "@/components/ui/loading";

// Shaped to the menu it stands in for, at both widths: a phone puts the photo beside the
// name, a laptop puts it above. A skeleton of the wrong shape moves the page when it goes.
export default function Loading() {
  return (
    <main className="w-full flex-1 py-12">
      <LoadingNote>Loading this week&apos;s bake</LoadingNote>
      <Bone className="h-10 w-2/3" />
      <div className="mt-3 flex flex-col gap-1">
        <Bone className="h-6 w-3/4" />
        <Bone className="h-6 w-1/2" />
      </div>
      {/* The allergens line, which wraps to two lines on a phone. */}
      <Bone className="mt-3 h-10 w-full sm:h-5 sm:w-2/3" />
      <div className="mt-10 grid gap-5 sm:gap-12 sm:grid-cols-2">
        {[0, 1].map((card) => (
          <div
            key={card}
            className="flex flex-col gap-4 rounded-card border border-default bg-surface p-5"
          >
            <div className="flex items-center gap-4 sm:flex-col sm:items-stretch">
              <Bone className="size-24 shrink-0 rounded-card sm:aspect-photo sm:size-auto sm:w-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Bone className="h-6 w-3/4 sm:w-1/2" />
                <Bone className="h-5 w-1/2 sm:w-1/3" />
              </div>
            </div>
            <div className="flex min-h-control items-center justify-between gap-3">
              <Bone className="h-5 w-16" />
              <Bone className="h-control-sm w-24 rounded-control" />
            </div>
            <Bone className="h-5 w-24" />
          </div>
        ))}
      </div>
    </main>
  );
}
