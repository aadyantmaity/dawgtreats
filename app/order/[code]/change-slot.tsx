"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Message } from "@/components/ui/message";
import { Select } from "@/components/ui/select";
import { IconClock } from "@tabler/icons-react";

export type SlotChoice = { id: string; label: string; spotsLeft: number; current: boolean };

// Not a cancellation: the cookies and the money stay put and only the time changes, so this
// sits on the order page rather than behind a sign-in.
export function ChangeSlot({ orderCode, choices }: { orderCode: string; choices: SlotChoice[] }) {
  const router = useRouter();
  const current = choices.find((slot) => slot.current);
  const [open, setOpen] = useState(false);
  // Empty when the order's own slot has already passed, so `current` is gone from the
  // list. The picker then starts on nothing and the button below stays refused until
  // a real time is chosen.
  const [picked, setPicked] = useState(current?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, startTransition] = useTransition();

  // One slot left means it is the one they already have, so there is nowhere to move to.
  if (choices.length < 2) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex min-h-control items-center gap-2 text-sm text-secondary transition-colors ease-spring hover:text-primary"
      >
        <IconClock aria-hidden className="size-4 shrink-0" />
        <span className="underline">Change pickup time</span>
      </button>
    );
  }

  function save() {
    startTransition(async () => {
      setError(null);
      try {
        const response = await fetch(`/api/orders/${orderCode}/slot`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slotId: picked }),
        });
        if (!response.ok) {
          const body: unknown = await response.json().catch(() => null);
          setError(
            body && typeof body === "object" && "error" in body
              ? String(body.error)
              : "That didn't save. Try again in a moment.",
          );
          return;
        }
        setOpen(false);
        router.refresh();
      } catch {
        setError("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  return (
    <div className="animate-rise mt-3 flex flex-col gap-3">
      <Select
        label="Pickup time"
        value={picked}
        onChange={setPicked}
        options={choices.map((slot) => ({
          value: slot.id,
          label: slot.current ? `${slot.label} · yours now` : `${slot.label} · ${slot.spotsLeft} ${slot.spotsLeft === 1 ? "spot" : "spots"}`,
        }))}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button size="md" onClick={save} disabled={saving || !picked || picked === current?.id}>
          {saving ? "Moving…" : "Move my pickup"}
        </Button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
            setPicked(current?.id ?? "");
          }}
          className="py-2 text-sm text-secondary underline transition-colors ease-spring hover:text-primary"
        >
          Keep it as it is
        </button>
      </div>
      {error && (
        <Message tone="error" className="animate-rise text-sm">
          {error}
        </Message>
      )}
    </div>
  );
}
