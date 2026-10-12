"use client";

import { ChartColumn, House, MessageCircle, ReceiptText, Store, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { prefersReducedMotion } from "@/lib/motion";

export type NavTab = { href: string; label: string; icon: IconName };

export type IconName = keyof typeof ICONS;

// A tab names its icon rather than passing one in, so the server layout stays a list of links.
const ICONS = {
  home: House,
  orders: ReceiptText,
  feedback: MessageCircle,
  account: User,
  pickup: Store,
  stats: ChartColumn,
} as const;

export function NavIcon({ name }: { name: IconName }) {
  const Icon = ICONS[name];
  return <Icon aria-hidden className="size-4 shrink-0" />;
}

type Box = { left: number; width: number };

type Register = (href: string, el: HTMLAnchorElement | null) => void;

const Pill = createContext<Register | null>(null);

// A control that is not one of the tabs, but belongs to the same row, says so with this.
// The pill then travels to it like any other, and outside the row it does nothing.
export function useNavPill(href: string) {
  const register = useContext(Pill);
  return useCallback((el: HTMLAnchorElement | null) => register?.(href, el), [register, href]);
}

// The pill stretches across both tabs on the way and draws back in, so it reads as one
// thing moving rather than a box being put somewhere else.
export function NavTabs({ tabs, children }: { tabs: NavTab[]; children?: ReactNode }) {
  const pathname = usePathname();
  const links = useRef(new Map<string, HTMLAnchorElement | null>());
  const pillRef = useRef<HTMLSpanElement>(null);
  const previous = useRef<Box | null>(null);
  const [pill, setPill] = useState<Box | null>(null);
  const [joined, setJoined] = useState<string[]>([]);
  const row = useRef<HTMLDivElement>(null);
  // A rule in the row is drawn over the pill, not under it, so the pill does not simply
  // swallow it on the way past. While it is covered it takes the pill's own ink colour.
  const [covered, setCovered] = useState(false);

  const register = useCallback<Register>((href, el) => {
    if (el) links.current.set(href, el);
    else links.current.delete(href);
    setJoined((known) => (el && !known.includes(href) ? [...known, href] : known));
  }, []);

  const here = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const active = [...tabs.map((tab) => tab.href), ...joined].find(here) ?? null;

  const measure = useCallback(() => {
    const el = active ? links.current.get(active) : null;
    // A tab hidden at this width measures zero, and no pill beats a flat one.
    const next = el && el.offsetWidth > 0 ? { left: el.offsetLeft, width: el.offsetWidth } : null;
    // Same numbers must mean no change, or every measurement restarts the animation
    // from where it is going and the pill never gets to travel.
    setPill((current) =>
      current?.left === next?.left && current?.width === next?.width ? current : next,
    );
  }, [active]);

  useLayoutEffect(measure, [measure]);

  useLayoutEffect(() => {
    const el = pillRef.current;
    const from = previous.current;
    previous.current = pill;
    if (!el || !from || !pill) return;
    if (from.left === pill.left && from.width === pill.width) return;
    if (prefersReducedMotion()) return;

    // One journey at a time: a second would start from where the first is headed.
    for (const running of el.getAnimations()) running.cancel();

    const left = Math.min(from.left, pill.left);
    const right = Math.max(from.left + from.width, pill.left + pill.width);

    const travel = el.animate(
      [
        { left: `${from.left}px`, width: `${from.width}px` },
        { left: `${left}px`, width: `${right - left}px`, offset: 0.45 },
        { left: `${pill.left}px`, width: `${pill.width}px` },
      ],
      // Longer than the rest of the site on purpose: the pill covers the whole bar on the
      // way and needs the time to read as one journey rather than a flash.
      { duration: 420, easing: "cubic-bezier(0.32, 0.72, 0.3, 1)" },
    );

    // Only the widest point of the journey matters: the rule is either inside the span the
    // pill opens up or it is not, and a journey that never reaches it leaves it alone.
    const rule = row.current?.querySelector<HTMLElement>(".nav-rule");
    if (!rule || rule.offsetLeft < left || rule.offsetLeft > right) return;
    setCovered(true);
    const done = () => setCovered(false);
    travel.addEventListener("finish", done);
    travel.addEventListener("cancel", done);
    return () => {
      travel.removeEventListener("finish", done);
      travel.removeEventListener("cancel", done);
    };
  }, [pill]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    // Text shifts when the display font finishes loading, and so must the pill.
    void document.fonts?.ready.then(measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return (
    // No sideways scrolling: a phone gets the drawer instead, so these always fit. The
    // scroller rubber-banded at its ends and dragged the pill along with it.
    <div
      ref={row}
      data-covered={covered ? "" : undefined}
      className="relative flex min-w-0 items-center gap-1 sm:gap-2"
    >
      {pill && (
        <span
          ref={pillRef}
          aria-hidden
          className="absolute inset-y-0 rounded-pill bg-action"
          style={{ left: pill.left, width: pill.width }}
        />
      )}
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          ref={(el) => {
            links.current.set(tab.href, el);
          }}
          aria-current={here(tab.href) ? "page" : undefined}
          // The pill is measured in the browser, so until that happens there is nothing
          // dark behind this tab and on-action ink would be ivory on ivory.
          className={`relative flex shrink-0 items-center gap-1.5 rounded-pill px-3 py-1.5 text-sm whitespace-nowrap transition-colors ease-spring ${
            here(tab.href)
              ? pill
                ? "text-on-action"
                : "text-primary"
              : "text-secondary hover:text-primary"
          }`}
        >
          <NavIcon name={tab.icon} />
          {tab.label}
        </Link>
      ))}
      <Pill value={register}>{children}</Pill>
    </div>
  );
}
