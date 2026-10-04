"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// A header link that knows whether it is the page you are on. App Router only
// exposes the current path to the browser, so this cannot be a server component.
export function NavLink({ href, children }: { href: string; children: string }) {
  const pathname = usePathname();
  const here = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={here ? "page" : undefined}
      className={`shrink-0 text-sm whitespace-nowrap transition-colors duration-motion ease-spring ${
        here ? "text-primary underline underline-offset-4" : "text-secondary hover:text-primary"
      }`}
    >
      {children}
    </Link>
  );
}
