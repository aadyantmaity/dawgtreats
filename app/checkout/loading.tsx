import { Bone, LoadingNote } from "@/components/ui/loading";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6">
      <LoadingNote>Loading checkout</LoadingNote>
      <Bone className="h-10 w-48" />
      <div className="mt-3 flex flex-col gap-2">
        <Bone className="h-5 w-64 max-w-full" />
        <Bone className="h-5 w-72 max-w-full" />
      </div>
      <div className="mt-8 flex flex-col gap-6">
        {[0, 1].map((card) => (
          <div key={card} className="rounded-card border border-default bg-surface p-5">
            <Bone className="h-6 w-36" />
            <div className="mt-4 flex flex-col gap-4">
              <Bone className="h-control w-full rounded-control" />
              {card === 1 && <Bone className="h-control w-full rounded-control" />}
            </div>
          </div>
        ))}
        <Bone className="h-control w-48 rounded-control" />
      </div>
    </main>
  );
}
