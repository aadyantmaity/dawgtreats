import { UnsubscribeButton } from "@/app/notify/unsubscribe/unsubscribe-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stop these emails" };

export default async function UnsubscribePage({ searchParams }: PageProps<"/notify/unsubscribe">) {
  const { t } = await searchParams;
  const token = typeof t === "string" ? t : "";

  return (
    <main className="mx-auto animate-fade w-full max-w-md flex-1 py-12">
      <h1 className="text-4xl font-semibold">Stop these emails</h1>
      <p className="mt-3 text-secondary">
        You asked to be told when a batch opened. Press below and I&apos;ll forget your address.
      </p>
      <UnsubscribeButton token={token} />
      <p className="mt-6 text-sm text-tertiary">
        This only stops the batch-opening email. It changes nothing about an order you have
        already placed.
      </p>
    </main>
  );
}
