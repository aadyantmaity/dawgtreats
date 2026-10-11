import { Card } from "@/components/ui/card";
import { Bone, LoadingNote } from "@/components/ui/loading";

export default function Loading() {
  return (
    <main className="w-full max-w-2xl flex-1 py-12">
      <LoadingNote>Loading your account</LoadingNote>
      <Bone className="h-10 w-1/2" />
      <Bone className="mt-3 h-6 w-2/3" />
      <Card className="mt-8">
        <Bone className="mb-4 h-6 w-1/2" />
        <div className="flex flex-col gap-4">
          {[0, 1].map((field) => (
            <div key={field} className="flex flex-col gap-1.5">
              <Bone className="h-5 w-20" />
              <Bone className="h-control w-full rounded-control" />
            </div>
          ))}
        </div>
      </Card>
      <Bone className="mt-10 mb-4 h-8 w-1/3" />
      <Card className="p-0">
        <ul className="divide-y divide-default">
          {[0, 1, 2].map((row) => (
            <li key={row} className="flex items-center justify-between gap-4 p-5">
              <div className="flex min-w-0 flex-col gap-2">
                <Bone className="h-6 w-24" />
                <Bone className="h-5 w-20" />
              </div>
              <Bone className="h-6 w-16 rounded-pill" />
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
