import { AccountTabs, type AccountSection } from "@/app/account/account-tabs";
import { ContactDetails } from "@/app/account/contact-details";
import { PickupPanel } from "@/app/pickup/pickup-panel";
import { StatsPanel } from "@/app/stats/stats-panel";
import { OrderList } from "@/components/order-list";
import { SignInWithGoogle } from "@/components/sign-in";
import { Card } from "@/components/ui/card";
import { currentAccount, currentAdmin } from "@/lib/auth";
import { listOrdersForAccount } from "@/lib/orders";
import { IconLogout } from "@tabler/icons-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your account" };

export default async function AccountPage() {
  const account = await currentAccount();

  if (!account) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 animate-fade py-12">
        <h1 className="text-4xl font-semibold">Your account</h1>
        <p className="mt-3 mb-8 text-secondary">
          Sign in to see past orders and save your details. You never need an account to order.
        </p>
        <SignInWithGoogle />
      </main>
    );
  }

  const [orders, admin] = await Promise.all([listOrdersForAccount(account.id), currentAdmin()]);

  const yours = (
    <div>
      <ContactDetails name={account.name} phone={account.phone} />
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
    </div>
  );

  // Only the owner sees the other two, so a lone tab row would say nothing to everyone else.
  const sections: AccountSection[] = admin
    ? [
        { id: "yours", label: "Yours", panel: yours },
        { id: "pickup", label: "Pickup day", panel: <PickupPanel /> },
        { id: "stats", label: "Stats", panel: <StatsPanel /> },
      ]
    : [];

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 animate-fade py-12">
      <h1 className="text-4xl font-semibold">Your account</h1>
      <p className="mt-3 text-secondary">{account.email}</p>

      {admin ? <AccountTabs sections={sections} /> : <div className="mt-8">{yours}</div>}

      <form action="/auth/signout" method="post" className="mt-8">
        <button type="submit" className="inline-flex min-h-control items-center gap-2 text-sm text-secondary hover:text-primary">
          <IconLogout aria-hidden className="size-4" />
          <span className="underline">Sign out</span>
        </button>
      </form>
    </main>
  );
}
