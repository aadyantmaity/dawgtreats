"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export type SelectOption<T extends string> = { value: T; label: string };

type SelectProps<T extends string> = {
  label: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
};

// Select-only combobox (WAI-ARIA APG): focus stays on the button; aria-activedescendant tracks the highlight.
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  className = "",
}: SelectProps<T>) {
  const id = useId();
  const labelId = `${id}-label`;
  const listId = `${id}-list`;
  const optionId = (index: number) => `${id}-option-${index}`;

  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ text: "", at: 0 });

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Scrolls only the list; scrollIntoView would also move the page.
  function revealOption(index: number, center: boolean) {
    const list = listRef.current;
    const option = list?.children[index];
    if (!list || !(option instanceof HTMLElement)) return;
    const top = option.offsetTop;
    const bottom = top + option.offsetHeight;
    if (center) list.scrollTop = top - (list.clientHeight - option.offsetHeight) / 2;
    else if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }

  useEffect(() => {
    if (open) revealOption(activeIndex, false);
  }, [open, activeIndex]);

  useEffect(() => {
    if (open) revealOption(selectedIndex, true);
  }, [open, selectedIndex]);

  function openList() {
    setActiveIndex(selectedIndex);
    setOpen(true);
  }

  function choose(index: number) {
    onChange(options[index].value);
    setOpen(false);
  }

  function jumpTo(char: string) {
    const now = Date.now();
    const text = now - typeahead.current.at < 600 ? typeahead.current.text + char : char;
    typeahead.current = { text, at: now };
    const match = options.findIndex((o) => o.label.toLowerCase().startsWith(text.toLowerCase()));
    if (match === -1) return;
    if (open) setActiveIndex(match);
    else onChange(options[match].value);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const last = options.length - 1;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) openList();
        else setActiveIndex((i) => Math.min(i + 1, last));
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!open) openList();
        else setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        if (open) {
          event.preventDefault();
          setActiveIndex(0);
        }
        break;
      case "End":
        if (open) {
          event.preventDefault();
          setActiveIndex(last);
        }
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (open) choose(activeIndex);
        else openList();
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          setOpen(false);
        }
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) jumpTo(event.key);
    }
  }

  return (
    <div ref={rootRef} className={`flex flex-col gap-1.5 ${className}`}>
      <span id={labelId} className="text-sm text-secondary">
        {label}
      </span>
      <div className="relative">
        <button
          type="button"
          role="combobox"
          aria-labelledby={labelId}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open ? optionId(activeIndex) : undefined}
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : openList())}
          onKeyDown={onKeyDown}
          className={`flex h-11 w-full items-center rounded-xl border bg-surface pr-10 pl-3.5 text-left text-base text-primary focus:outline-none disabled:bg-disabled disabled:text-disabled ${open ? "border-focus" : "border-default focus-visible:border-focus"}`}
        >
          <span className="truncate">{options[selectedIndex]?.label}</span>
        </button>
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden
          className={`pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-secondary transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-labelledby={labelId}
          hidden={!open}
          className="absolute top-full left-0 z-20 mt-1.5 max-h-64 w-full min-w-max overflow-y-auto rounded-xl border border-default bg-surface py-1 shadow-lg"
        >
          {options.map((option, index) => {
            const selected = index === selectedIndex;
            return (
              <li
                key={option.value}
                id={optionId(index)}
                role="option"
                aria-selected={selected}
                onPointerEnter={() => setActiveIndex(index)}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => choose(index)}
                className={`flex cursor-pointer items-center justify-between gap-6 px-3.5 py-2 text-base ${index === activeIndex ? "bg-hover" : ""} ${selected ? "font-medium text-primary" : "text-primary/80"}`}
              >
                {option.label}
                {selected && (
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden className="size-4">
                    <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
