import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import Link from "next/link";
import { CartLink } from "@/components/cart";
import { FeedbackFab } from "@/components/feedback-fab";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dawg Treats",
  description: "Weekly cookie drops, picked up on the weekend.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="border-b border-default">
          <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between gap-4 px-6">
            <Link href="/" className="font-serif text-xl font-semibold">
              Dawg Treats
            </Link>
            <nav className="flex items-center gap-4">
              <Link href="/order/lookup" className="text-sm text-secondary hover:text-primary">
                Find my order
              </Link>
              <Link href="/feedback" className="text-sm text-secondary hover:text-primary">
                Feedback
              </Link>
              <Link href="/account" className="text-sm text-secondary hover:text-primary">
                Account
              </Link>
              <CartLink />
            </nav>
          </div>
        </header>
        {children}
        <footer className="mt-16 border-t border-default">
          <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-4 px-6 py-6 pb-fab-clearance text-sm text-secondary sm:pb-6">
            <Link href="/feedback" className="hover:text-primary">
              Feedback
            </Link>
            <Link href="/order/lookup" className="hover:text-primary">
              Find my order
            </Link>
            <span className="text-tertiary">Pickup only · all sales final</span>
          </div>
        </footer>
        <FeedbackFab />
      </body>
    </html>
  );
}
