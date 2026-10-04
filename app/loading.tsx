import { Bone, LoadingNote } from "@/components/ui/loading";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
      <LoadingNote>Loading this week&apos;s bake</LoadingNote>
      <Bone className="h-10 w-2/3" />
      <div className="mt-3 flex flex-col gap-1">
        <Bone className="h-6 w-3/4" />
        <Bone className="h-6 w-1/2" />
      </div>
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {[0, 1].map((card) => (
          <div key={card} className="flex flex-col gap-4 rounded-card border border-default bg-surface p-4">
            <Bone className="aspect-photo w-full rounded-card" />
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <Bone className="h-6 w-1/2" />
                <Bone className="h-6 w-12" />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Bone className="h-5 w-16" />
              <Bone className="h-control-sm w-24 rounded-control" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
