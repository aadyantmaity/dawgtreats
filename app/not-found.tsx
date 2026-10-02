import Link from "next/link";

export const metadata = { title: "Not found · Dawg Treats" };

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-24">
      <h1 className="text-4xl font-semibold">Nothing here</h1>
      <p className="mt-3 text-secondary">
        That page doesn&apos;t exist. If you were after an order, find it with its code.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/" className="underline">
          The menu
        </Link>
        <span className="text-tertiary">·</span>
        <Link href="/order/lookup" className="underline">
          Find my order
        </Link>
      </div>
    </main>
  );
}
