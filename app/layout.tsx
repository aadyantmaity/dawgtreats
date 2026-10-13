import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { DM_Sans, Shantell_Sans } from "next/font/google";
import Link from "next/link";
import { CartLink } from "@/components/cart";
import { NavTabs, type NavTab } from "@/components/nav-tabs";
import { FeedbackFab } from "@/components/feedback-fab";
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
  const tabs: NavTab[] = [
    { href: "/", label: "Home", icon: "home" },
    { href: "/order/lookup", label: "Orders", icon: "orders" },
    { href: "/account", label: "Account", icon: "account" },
  ];
  // The owner's two screens live inside the account page now, and feedback has its own
  // button on the page, so the bar carries the same short row for everyone.
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${shantellSans.variable} h-full overscroll-y-none antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Stays put: the menu runs past a phone screen several times over, and the cart
            was only reachable by scrolling all the way back to the top. The drawer below
            opens from the bottom of this bar, so the bar has to be where it says it is.
            A sticky element with a z-index traps its children in that layer, and the menu
            drawer is one of them, so this has to outrank the floating feedback button. */}
        <header className="sticky top-2 z-50 mt-2">
          <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
            <div className="relative mx-auto h-bar w-fit max-w-full">
            {/* The blur is on its own layer rather than on the bar. A backdrop filter is
                the containing block for every fixed thing inside it, and the drawer below
                is one, so blurring the bar pinned the drawer to the bar, not the window. */}
            <div
              aria-hidden
              className="absolute inset-0 rounded-pill border border-default bg-floating shadow-lg backdrop-blur-md"
            />
            <div className="relative flex h-full items-center justify-start gap-5 pr-2 pl-3 sm:pr-3 sm:pl-5">
            <Link href="/" className="inline-flex min-h-control shrink-0 items-center gap-2 font-display text-base font-semibold whitespace-nowrap">
              {/* The mark carries the name beside it, so it is decoration to a reader
                  who cannot see it. next/image has nothing to optimise in a vector, and
                  one cached file beats the same paths in every page's HTML. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="" className="h-10 w-auto sm:h-12" />
              <span className="wordmark hidden flex-col sm:flex">
                <span>Dawg</span>
                <span>Treats</span>
              </span>
            </Link>
            {/* The cart sits in the bar at every width: a part-finished order must never
                be behind a menu someone has to open first. */}
            <nav className="flex min-w-0 items-center gap-1 sm:gap-3">
              {/* The cart rides in the tab row, so the pill travels to it like any tab. */}
              <div className="min-w-0">
                <NavTabs tabs={tabs}>
                  {/* Four of these are places and the last one is a basket. The rule says
                      so, and the pill still travels across it. */}
                  <span aria-hidden className="nav-rule h-5 w-0 shrink-0 border-l" />
                  <CartLink variant="tab" />
                </NavTabs>
              </div>
            </nav>
            </div>
            </div>
          </div>
        </header>
        {/* One column for the whole site, the same width as the bar above it. A page
            narrower than the bar sits in the middle of it, not against one edge. */}
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 sm:px-6">
          {children}
        </div>
        <FeedbackFab />
        <Analytics />
      </body>
    </html>
  );
}
