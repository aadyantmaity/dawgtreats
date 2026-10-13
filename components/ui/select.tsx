"use client";

import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export type SelectOption<T extends string> = { value: T; label: string };

type SelectProps<T extends string> = {
  label: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
  // What the control says when `value` names nothing in `options`. The default reads
  // "Choose a pickup time"; a label that needs "an" passes its own.
  placeholder?: string;
};

// How long typed letters keep building one search word. A pause longer than this starts a
// new one, so "sa" then a pause then "t" looks for "t", not "sat".
const TYPEAHEAD_MS = 600;

// Select-only combobox (WAI-ARIA APG): focus stays on the button; aria-activedescendant tracks the highlight.
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  className = "",
  placeholder,
}: SelectProps<T>) {
  const id = useId();
  const labelId = `${id}-label`;
  const listId = `${id}-list`;
  const optionId = (index: number) => `${id}-option-${index}`;

  const [open, setOpen] = useState(false);
  // A value that names nothing in the list is no selection at all. Rounding it up to the
  // first option would show someone a pickup time they never chose, and they would turn
  // up at it: the list loses an option when a slot fills between render and interaction.
  const selectedIndex = options.findIndex((o) => o.value === value);
  const chosen = selectedIndex >= 0;
  // With nothing chosen the keyboard still has to start somewhere.
  const [activeIndex, setActiveIndex] = useState(chosen ? selectedIndex : 0);
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
    if (open && chosen) revealOption(selectedIndex, true);
  }, [open, chosen, selectedIndex]);

  function openList() {
    setActiveIndex(chosen ? selectedIndex : 0);
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    // The list can lose the highlighted option between render and click, so this closes
    // rather than reading a value off nothing and taking the form down with it.
    if (!option) return setOpen(false);
    onChange(option.value);
    setOpen(false);
  }

  function jumpTo(char: string) {
    const now = Date.now();
    const text = now - typeahead.current.at < TYPEAHEAD_MS ? typeahead.current.text + char : char;
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
          className={`flex h-control w-full items-center rounded-control border bg-surface pr-10 pl-4 text-left text-base text-primary transition-colors ease-spring focus:outline-none disabled:pointer-events-none disabled:bg-disabled disabled:text-disabled disabled:transition-none ${open ? "border-focus" : "border-default focus-visible:border-focus"}`}
        >
          <span className={`truncate ${chosen ? "" : "text-tertiary"}`}>
            {chosen ? options[selectedIndex].label : placeholder ?? `Choose a ${label.toLowerCase()}`}
          </span>
        </button>
        <IconChevronDown
          aria-hidden
          className={`pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-secondary transition-transform ${open ? "rotate-180" : ""}`}
        />

        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-labelledby={labelId}
          hidden={!open}
          className="absolute top-full left-0 z-20 mt-1.5 max-h-menu w-full min-w-max overflow-y-auto rounded-card border border-default bg-surface py-1 shadow-lg animate-rise"
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
                className={`flex cursor-pointer items-center justify-between gap-6 px-4 py-2 text-base ${index === activeIndex ? "bg-hover" : ""} ${selected ? "font-medium text-primary" : "text-primary/80"}`}
              >
                {option.label}
                {selected && <IconCheck aria-hidden className="size-4" />}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
