"use client";

import { useState, type ReactNode } from "react";

import { NAV_TAB } from "@/components/nav-chrome";

export type AccountSection = { id: string; label: string; panel: ReactNode };

// Switching here hides and shows what the server already sent, so a tap costs nothing and
// the pickup list keeps its open slots. The whole page would otherwise be one long scroll.
export function AccountTabs({ sections }: { sections: AccountSection[] }) {
  const [current, setCurrent] = useState(sections[0]?.id);

  return (
    <div className="mt-8">
      <div role="tablist" aria-label="Your account" className="flex flex-wrap items-center gap-1">
        {sections.map((section) => {
          const active = section.id === current;
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              id={`tab-${section.id}`}
              aria-selected={active}
              aria-controls={`panel-${section.id}`}
              onClick={() => setCurrent(section.id)}
              className={`${NAV_TAB} ${
                active ? "bg-action text-on-action" : "text-secondary hover:bg-quiet hover:text-primary"
              }`}
            >
              {section.label}
            </button>
          );
        })}
      </div>

      {sections.map((section) => (
        <div
          key={section.id}
          role="tabpanel"
          id={`panel-${section.id}`}
          aria-labelledby={`tab-${section.id}`}
          hidden={section.id !== current}
          className="mt-6"
        >
          {section.panel}
        </div>
      ))}
    </div>
  );
}
