import { Card } from "@/components/ui/card";
import { Bone, LoadingNote } from "@/components/ui/loading";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6">
      <LoadingNote>Loading your order</LoadingNote>
      <div className="flex items-center justify-between gap-4">
        <Bone className="h-10 w-1/2" />
        <Bone className="h-6 w-20 rounded-pill" />
      </div>
      <Bone className="mt-3 h-6 w-1/3" />
      <Card className="mt-8">
        <Bone className="mb-4 h-6 w-1/4" />
        <Bone className="h-6 w-2/3" />
        <Bone className="mt-1 h-6 w-3/4" />
        <Bone className="mt-2 h-5 w-1/3" />
      </Card>
      <Card className="mt-6">
        <Bone className="mb-4 h-6 w-1/3" />
        <div className="flex flex-col gap-2">
          <Bone className="h-6 w-full" />
          <Bone className="h-6 w-full" />
        </div>
        <div className="mt-3 border-t border-default pt-3">
          <Bone className="h-6 w-full" />
        </div>
      </Card>
      <Bone className="mt-6 h-10 w-1/3" />
    </main>
  );
}
