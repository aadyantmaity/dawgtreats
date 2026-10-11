import { ContactDetails } from "@/app/account/contact-details";
import { OrderList } from "@/components/order-list";
import { SignInWithGoogle } from "@/components/sign-in";
import { Card } from "@/components/ui/card";
import { currentAccount } from "@/lib/auth";
import { listOrdersForAccount } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your account" };

export default async function AccountPage() {
  const account = await currentAccount();

  if (!account) {
    return (
      <main className="w-full max-w-2xl flex-1 animate-fade py-12">
        <h1 className="text-4xl font-semibold">Your account</h1>
        <p className="mt-3 mb-8 text-secondary">
          Sign in to see past orders and save your details. You never need an account to order.
        </p>
        <SignInWithGoogle />
      </main>
    );
  }

  const orders = await listOrdersForAccount(account.id);

  return (
    <main className="w-full max-w-2xl flex-1 animate-fade py-12">
      <h1 className="text-4xl font-semibold">Your account</h1>
      <p className="mt-3 text-secondary">{account.email}</p>

      <ContactDetails name={account.name} phone={account.phone} className="mt-8" />

      <h2 className="mt-10 mb-4 text-2xl font-semibold">Past orders</h2>
      {orders.length === 0 ? (
        <Card>
          <p className="text-secondary">
            No orders yet. Anything you order with {account.email} shows up here.
          </p>
        </Card>
      ) : (
        <OrderList orders={orders} />
      )}

      <form action="/auth/signout" method="post" className="mt-8">
        <button type="submit" className="inline-flex min-h-control items-center text-sm text-secondary underline hover:text-primary">
          Sign out
        </button>
      </form>
    </main>
  );
}
