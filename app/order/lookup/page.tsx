import { LookupForm } from "@/app/order/lookup/lookup-form";

export const metadata = { title: "Find my order · Dawg Treats" };

export default function LookupPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-12">
      <h1 className="text-4xl font-semibold">Find my order</h1>
      <p className="mt-3 text-secondary">
        Your order code was on the confirmation page, like 486N6XNV.
      </p>
      <LookupForm />
    </main>
  );
}
