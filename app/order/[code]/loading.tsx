import { Bone, LoadingNote } from "@/components/ui/loading";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6">
      <LoadingNote>Loading your order</LoadingNote>
      <Bone className="h-10 w-56" />
      <Bone className="mt-3 h-5 w-64 max-w-full" />
      {[0, 1].map((card) => (
        <div key={card} className="mt-8 rounded-card border border-default bg-surface p-5">
          <Bone className="h-6 w-32" />
          <div className="mt-4 flex flex-col gap-3">
            <Bone className="h-5 w-full" />
            <Bone className="h-5 w-3/4" />
          </div>
        </div>
      ))}
    </main>
  );
}
