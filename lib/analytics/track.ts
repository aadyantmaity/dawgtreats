"use client";

import { useEffect } from "react";

import type { Device, EventName } from "@/lib/validation";


const VISITOR_KEY = "dawgtreats.visitor";

// A coarse pointer is a finger. It splits phones and tablets from anything with a mouse,
// which is the only split worth knowing and the only one that describes no one.
function device(): Device {
  return window.matchMedia("(pointer: coarse)").matches ? "phone" : "desktop";
}

// Held for one browser session only. It is a random string, never anything about a person,
// and it exists so the same visit is not counted twice at each step.
function visitorId(): string | null {
  try {
    const existing = window.sessionStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const made = crypto.randomUUID();
    window.sessionStorage.setItem(VISITOR_KEY, made);
    return made;
  } catch {
    return null;
  }
}

// A dropped event is a missing number, never a broken page, so nothing here throws.
export function track(name: EventName, detail?: string): void {
  try {
    const visitor = visitorId();
    if (!visitor) return;
    const body = JSON.stringify({ name, visitorId: visitor, detail, device: device() });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    // Counting must never cost someone their cookies.
  }
}

// For a page that is otherwise rendered on the server and has nothing to click.
export function TrackView({ name, detail }: { name: EventName; detail?: string }) {
  useEffect(() => {
    track(name, detail);
  }, [name, detail]);
  return null;
}
