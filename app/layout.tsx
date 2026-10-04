import type { Metadata } from "next";
import { DM_Sans, Shantell_Sans } from "next/font/google";
import Link from "next/link";
import { CartLink } from "@/components/cart";
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
          <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between gap-4 px-4 sm:px-6">
            <Link href="/" className="font-display text-lg font-semibold whitespace-nowrap sm:text-xl">
              Dawg Treats
            </Link>
            <nav className="flex items-center gap-3 sm:gap-4">
              <Link
                href="/order/lookup"
                className="text-sm whitespace-nowrap text-secondary hover:text-primary"
              >
                My order
              </Link>
              <Link href="/feedback" className="text-sm whitespace-nowrap text-secondary hover:text-primary">
                Feedback
              </Link>
              <Link href="/account" className="text-sm whitespace-nowrap text-secondary hover:text-primary">
                Account
              </Link>
              {admin && (
                <Link
                  href="/pickup"
                  className="text-sm whitespace-nowrap text-secondary hover:text-primary"
                >
                  Pickup
                </Link>
              )}
              <CartLink />
            </nav>
          </div>
        </header>
        {children}
        <FeedbackFab />
      </body>
    </html>
  );
}
