"use client";

import {
  IconBuildingStore,
  IconChartBar,
  IconHome,
  IconMessageCircle,
  IconReceipt,
  IconUser,
} from "@tabler/icons-react";
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

import { NAV_TAB } from "@/components/nav-chrome";
import { prefersReducedMotion } from "@/lib/motion";

export type NavTab = { href: string; label: string; icon: IconName };

export type IconName = keyof typeof ICONS;

// A tab names its icon rather than passing one in, so the server layout stays a list of links.
const ICONS = {
  home: IconHome,
  orders: IconReceipt,
  feedback: IconMessageCircle,
  account: IconUser,
  pickup: IconBuildingStore,
  stats: IconChartBar,
} as const;

export function NavIcon({ name }: { name: IconName }) {
  const Icon = ICONS[name];
  // A Tabler glyph is drawn inside its box with about 2px of air, so even padding reads
  // as left-heavy against a word that starts at its own edge. This takes that air back.
  return <Icon aria-hidden className="nav-icon -ml-0.5 size-4 shrink-0" />;
}

type Box = { left: number; width: number };

type Register = (href: string, el: HTMLAnchorElement | null) => void;

const Pill = createContext<Register | null>(null);

// Longer than the rest of the site on purpose: the pill covers the whole bar on the way
// and needs the time to read as one journey rather than a flash.
const JOURNEY_MS = 420;
// Not the site's spring. A spring overshoots, and a pill that overshoots lands past the
// tab it is going to and slides back onto it.
const JOURNEY_EASING = "cubic-bezier(0.32, 0.72, 0.3, 1)";

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
      { duration: JOURNEY_MS, easing: JOURNEY_EASING },
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
    // The active tab can change width without the window moving at all: the cart's count
    // reaching two digits widens it, and the pill was left short until the next resize.
    const observer = new ResizeObserver(measure);
    if (row.current) observer.observe(row.current);
    const el = active ? links.current.get(active) : null;
    if (el) observer.observe(el);
    return () => {
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [measure, active]);

  return (
    // No sideways scrolling: the row drops to marks alone before it would need any, so it
    // always fits. The scroller rubber-banded at its ends and dragged the pill with it.
    <div
      ref={row}
      data-covered={covered ? "" : undefined}
      className="relative flex min-w-0 items-center gap-1 sm:gap-3"
    >
      {pill && (
        <span
          ref={pillRef}
          aria-hidden
          className="absolute inset-y-1.5 rounded-pill bg-action sm:inset-y-0"
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
          className={`${NAV_TAB} ${
            here(tab.href)
              ? pill
                ? "text-on-action"
                : "text-primary"
              : "text-secondary hover:text-primary"
          }`}
        >
          <NavIcon name={tab.icon} />
          <span className="sr-only tabtext:not-sr-only">{tab.label}</span>
        </Link>
      ))}
      <Pill value={register}>{children}</Pill>
    </div>
  );
}
