import Link from "next/link";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 animate-rise flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-4xl font-semibold">Nothing here</h1>
      <p className="mt-3 text-secondary">
        That page doesn&apos;t exist. Looking for an order? Find it with its code.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="inline-flex min-h-control items-center underline">
          The menu
        </Link>
        <span className="text-tertiary">·</span>
        <Link href="/order/lookup" className="inline-flex min-h-control items-center underline">
          Find my order
        </Link>
      </div>
    </main>
  );
}
