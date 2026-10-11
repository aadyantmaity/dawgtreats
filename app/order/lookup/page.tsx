import { LookupForm } from "@/app/order/lookup/lookup-form";
import { OrderList } from "@/components/order-list";
import { currentAccount } from "@/lib/auth";
import { listOrdersForAccount } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const metadata = { title: "Orders" };

export default async function LookupPage() {
  const account = await currentAccount();

  if (!account) {
    return (
      <main className="animate-fade w-full max-w-md flex-1 py-12">
        <h1 className="text-4xl font-semibold">Find my order</h1>
        <p className="mt-3 text-secondary">
          Your code is in your confirmation email, like 4X7K. Check spam if it&apos;s not there.
        </p>
        <LookupForm />
      </main>
    );
  }

  const orders = await listOrdersForAccount(account.id);

  if (orders.length === 0) {
    return (
      <main className="animate-fade w-full max-w-md flex-1 py-12">
        <h1 className="text-4xl font-semibold">Your orders</h1>
        <p className="mt-3 text-secondary">
          Nothing ordered with {account.email} yet. If you used a different email, look it up with
          your code.
        </p>
        <LookupForm />
      </main>
    );
  }

  return (
    <main className="animate-fade w-full max-w-2xl flex-1 py-12">
      <h1 className="mb-6 text-4xl font-semibold">Your orders</h1>
      <OrderList orders={orders} />

      <details className="group mt-10 border-t border-default pt-3">
        <summary className="disclosure text-sm text-secondary transition-colors ease-spring hover:text-primary">
          Ordered with a different email?
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden
            className="size-4 shrink-0 transition-transform ease-spring group-open:rotate-180"
          >
            <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <p className="mt-2 text-sm text-tertiary">
          Your code is in that confirmation email, like 4X7K.
        </p>
        <LookupForm />
      </details>
    </main>
  );
}
