import { Card } from "@/components/ui/card";
import { Bone, LoadingNote } from "@/components/ui/loading";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12 sm:px-6">
      <LoadingNote>Loading the feedback form</LoadingNote>
      <Bone className="h-10 w-full" />
      <Bone className="mt-3 h-6 w-3/4" />
      <Card className="mt-8">
        <div className="flex flex-col gap-2">
          <Bone className="h-5 w-1/3" />
          <div className="flex gap-2">
            {[0, 1, 2, 3, 4].map((star) => (
              <Bone key={star} className="size-control-sm rounded-control-sm" />
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <Bone className="h-5 w-1/2" />
          <Bone className="h-24 w-full rounded-card" />
          <Bone className="h-5 w-1/3" />
        </div>
        <div className="mt-4 flex flex-col gap-1.5">
          <Bone className="h-5 w-1/2" />
          <Bone className="h-control w-full rounded-control" />
        </div>
        <Bone className="mt-6 h-control-sm w-24 rounded-control-sm" />
      </Card>
    </main>
  );
}
