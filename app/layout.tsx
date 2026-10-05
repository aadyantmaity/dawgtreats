import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { DM_Sans, Shantell_Sans } from "next/font/google";
import Link from "next/link";
import { CartLink } from "@/components/cart";
import { NavTabs } from "@/components/nav-tabs";
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
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${shantellSans.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="border-b border-default">
          <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between gap-3 px-4 sm:gap-4 sm:px-6">
            <Link href="/" className="shrink-0 font-display text-base font-semibold whitespace-nowrap sm:text-xl">
              Dawg Treats
            </Link>
            <nav className="flex min-w-0 items-center gap-2 sm:gap-4">
              {/* Tabs scroll if they must; the cart never leaves the screen. */}
              <NavTabs
                tabs={[
                  { href: "/", label: "Home" },
                  { href: "/order/lookup", label: "My order" },
                  { href: "/feedback", label: "Feedback", hideOnPhone: true },
                  { href: "/account", label: "Account" },
                  ...(admin
                    ? [
                        { href: "/pickup", label: "Pickup" },
                        { href: "/stats", label: "Stats" },
                      ]
                    : []),
                ]}
              />
              <CartLink />
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
