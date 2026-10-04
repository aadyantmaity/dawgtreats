import { Card } from "@/components/ui/card";
import { Bone, LoadingNote } from "@/components/ui/loading";

// A card heading is 28px tall above a 12px gap. The spacing scale has no 7,
// so a 24px bone with a 16px gap lands on the same 40px.
function CardHeading({ className = "" }: { className?: string }) {
  return <Bone className={`mb-4 h-6 ${className}`} />;
}

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6">
      <LoadingNote>Loading checkout</LoadingNote>
      <Bone className="h-10 w-1/2" />
      <div className="mt-3 flex flex-col gap-1">
        <Bone className="h-6 w-3/4" />
        <Bone className="h-6 w-full" />
        <Bone className="h-6 w-2/3" />
      </div>
      <div className="mt-8 flex flex-col gap-6">
        <Card>
          <CardHeading className="w-1/3" />
          <div className="flex flex-col gap-2">
            <Bone className="h-6 w-full" />
            <Bone className="h-6 w-full" />
          </div>
          <div className="mt-3 border-t border-default pt-3">
            <Bone className="h-6 w-full" />
          </div>
        </Card>

        <Card>
          <CardHeading className="w-1/3" />
          <div className="flex flex-col gap-1.5">
            <Bone className="h-5 w-24" />
            <Bone className="h-control w-full rounded-control" />
          </div>
          <Bone className="mt-2 h-5 w-1/3" />
        </Card>

        <Card>
          <CardHeading className="w-1/2" />
          <div className="flex flex-col gap-4">
            {[0, 1, 2].map((field) => (
              <div key={field} className="flex flex-col gap-1.5">
                <Bone className="h-5 w-20" />
                <Bone className="h-control w-full rounded-control" />
                {/* The email field carries a hint line the others do not. */}
                {field === 1 && <Bone className="h-5 w-2/3" />}
              </div>
            ))}
          </div>
        </Card>

        <Bone className="h-control w-1/2 rounded-control" />
        <div className="flex flex-col gap-0">
          <Bone className="h-5 w-full" />
          <Bone className="h-5 w-2/3" />
        </div>
      </div>
    </main>
  );
}
