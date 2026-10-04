import { Bone, LoadingNote } from "@/components/ui/loading";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12 sm:px-6">
      <LoadingNote>Loading order lookup</LoadingNote>
      <Bone className="h-10 w-3/4" />
      <div className="mt-3 flex flex-col gap-1">
        <Bone className="h-6 w-full" />
        <Bone className="h-6 w-1/2" />
      </div>
      <div className="mt-8 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Bone className="h-5 w-24" />
          <Bone className="h-control w-full rounded-control" />
        </div>
        <Bone className="h-control w-full rounded-control" />
      </div>
    </main>
  );
}
