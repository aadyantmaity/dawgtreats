import { Card } from "@/components/ui/card";
import { Bone, LoadingNote } from "@/components/ui/loading";

export default function Loading() {
  return (
    <main className="w-full max-w-2xl flex-1 py-12">
      <LoadingNote>Loading pickup day</LoadingNote>
      <Bone className="h-10 w-1/2" />
      <div className="mt-3 flex flex-col gap-1">
        <Bone className="h-6 w-3/4" />
        <Bone className="h-6 w-1/2" />
      </div>
      <div className="mt-8 flex flex-col gap-6">
        {[0, 1].map((group) => (
          <Card key={group}>
            <Bone className="mb-4 h-6 w-2/3" />
            <div className="flex flex-col gap-4">
              {[0, 1].map((order) => (
                <div key={order} className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 flex-col gap-2">
                    <Bone className="h-6 w-24" />
                    <Bone className="h-5 w-20" />
                  </div>
                  <Bone className="h-control-sm w-24 rounded-control" />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
