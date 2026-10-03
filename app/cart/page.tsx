import { CartView } from "@/app/cart/cart-view";
import { getMenu } from "@/lib/inventory";
import { getOrderableWeek } from "@/lib/weeks";

export const dynamic = "force-dynamic";

export const metadata = { title: "Your cart" };

export default async function CartPage() {
  const week = await getOrderableWeek();
  const menu = await getMenu(week?.id ?? null);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <h1 className="text-4xl font-semibold">Your cart</h1>
      <CartView menu={menu} ordersOpen={week !== null} />
    </main>
  );
}
