import { Bone, LoadingNote } from "@/components/ui/loading";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6">
      <LoadingNote>Loading your account</LoadingNote>
      <Bone className="h-10 w-52" />
      <Bone className="mt-3 h-5 w-60 max-w-full" />
      <div className="mt-8 rounded-card border border-default bg-surface p-5">
        <Bone className="h-6 w-40" />
        <div className="mt-4 flex flex-col gap-4">
          <Bone className="h-control w-full rounded-control" />
          <Bone className="h-control w-full rounded-control" />
        </div>
      </div>
      <Bone className="mt-10 mb-4 h-8 w-36" />
      <div className="rounded-card border border-default bg-surface">
        <ul className="divide-y divide-default">
          {[0, 1, 2].map((row) => (
            <li key={row} className="flex items-center justify-between gap-4 p-5">
              <div className="flex min-w-0 flex-col gap-2">
                <Bone className="h-5 w-28" />
                <Bone className="h-4 w-40 max-w-full" />
              </div>
              <Bone className="h-6 w-16 rounded-pill" />
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
