import { Card } from "@/components/ui/card";
import { Bone, LoadingNote } from "@/components/ui/loading";

export default function Loading() {
  return (
    <main className="w-full max-w-2xl flex-1 py-12">
      <LoadingNote>Loading stats</LoadingNote>
      <Bone className="h-10 w-1/3" />
      <Bone className="mt-3 h-6 w-2/3" />
      <Card className="mt-8">
        <Bone className="mb-4 h-6 w-1/2" />
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="flex flex-col gap-1">
              <div className="flex justify-between gap-3">
                <Bone className="h-5 w-1/2" />
                <Bone className="h-5 w-16" />
              </div>
              <Bone className="h-2 w-full rounded-pill" />
            </div>
          ))}
        </div>
      </Card>
      {[0, 1].map((card) => (
        <Card key={card} className="mt-6">
          <Bone className="mb-4 h-6 w-1/3" />
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex justify-between gap-4">
                <Bone className="h-5 w-1/2" />
                <Bone className="h-5 w-12" />
              </div>
            ))}
          </div>
        </Card>
      ))}
    </main>
  );
}
