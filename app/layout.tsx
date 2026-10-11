import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { DM_Sans, Shantell_Sans } from "next/font/google";
import Link from "next/link";
import { CartLink } from "@/components/cart";
import { NavMenu } from "@/components/nav-menu";
import { NavTabs, type NavTab } from "@/components/nav-tabs";
import { FeedbackFab } from "@/components/feedback-fab";
import { viewerIsAdmin } from "@/lib/auth";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

// Loaded as a variable font so headings get the weight they ask for, including 600.
const shantellSans = Shantell_Sans({
  variable: "--font-shantell-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Dawg Treats",
    template: "%s · Dawg Treats",
  },
  description: "Homemade cookies, picked up on the weekend.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const admin = await viewerIsAdmin();
  const tabs: NavTab[] = [
    { href: "/", label: "Home" },
    { href: "/order/lookup", label: "My order" },
    { href: "/feedback", label: "Feedback" },
    { href: "/account", label: "Account" },
  ];
  const adminTabs: NavTab[] = admin
    ? [
        { href: "/pickup", label: "Pickup" },
        { href: "/stats", label: "Stats" },
      ]
    : [];
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${shantellSans.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Stays put: the menu runs past a phone screen several times over, and the cart
            was only reachable by scrolling all the way back to the top. The drawer below
            opens from the bottom of this bar, so the bar has to be where it says it is.
            A sticky element with a z-index traps its children in that layer, and the menu
            drawer is one of them, so this has to outrank the floating feedback button. */}
        <header className="sticky top-0 z-50 border-b border-default bg-page">
          <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between gap-3 px-4 sm:gap-4 sm:px-6">
            <Link href="/" className="shrink-0 font-display text-base font-semibold whitespace-nowrap sm:text-xl">
              Dawg Treats
            </Link>
            {/* The cart sits in the bar at every width: a part-finished order must never
                be behind a menu someone has to open first. */}
            <nav className="flex min-w-0 items-center gap-2 sm:gap-4">
              <div className="hidden min-w-0 sm:block">
                <NavTabs tabs={[...tabs, ...adminTabs]} />
              </div>
              <CartLink />
              <NavMenu tabs={tabs} adminTabs={adminTabs} />
            </nav>
          </div>
        </header>
        {children}
        <FeedbackFab />
        <Analytics />
      </body>
    </html>
  );
}
