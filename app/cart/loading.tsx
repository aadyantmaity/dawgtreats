import { Bone, LoadingNote } from "@/components/ui/loading";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6">
      <LoadingNote>Loading your cart</LoadingNote>
      <Bone className="h-10 w-44" />
      <div className="mt-6 rounded-card border border-default bg-surface">
        <ul className="divide-y divide-default">
          {[0, 1].map((row) => (
            <li key={row} className="flex flex-wrap items-center gap-4 p-5">
              <Bone className="size-12 shrink-0" />
              <div className="flex min-w-0 flex-1 basis-40 flex-col gap-2">
                <Bone className="h-5 w-40 max-w-full" />
                <Bone className="h-4 w-24" />
              </div>
              <Bone className="h-control w-32 rounded-control" />
              <Bone className="h-5 w-16" />
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
