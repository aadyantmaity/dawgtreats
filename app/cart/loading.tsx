import { Card } from "@/components/ui/card";
import { Bone, LoadingNote } from "@/components/ui/loading";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 py-12">
      <LoadingNote>Loading your cart</LoadingNote>
      <Bone className="h-10 w-1/2" />
      <div className="mt-8 flex flex-col gap-6">
        <Card className="p-0">
          <ul className="divide-y divide-default">
            {[0, 1].map((row) => (
              <li key={row} className="flex flex-col gap-4 p-5 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <Bone className="size-12 shrink-0 rounded-control-sm" />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Bone className="h-6 w-3/4" />
                    <Bone className="h-5 w-1/2" />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <Bone className="h-control w-24 rounded-control" />
                  <Bone className="h-6 w-20" />
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <div className="flex items-center justify-between">
          <Bone className="h-6 w-24" />
          <Bone className="h-6 w-16" />
        </div>
        <Bone className="h-control w-1/2 rounded-control" />
        <Bone className="h-5 w-3/4" />
      </div>
    </main>
  );
}
