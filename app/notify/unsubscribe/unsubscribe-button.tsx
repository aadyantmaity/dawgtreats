"use client";

import { useState, useTransition } from "react";

import { unsubscribe } from "@/app/notify/unsubscribe/actions";
import { Button } from "@/components/ui/button";

// A press, not a page load: mail scanners open every link in a message, and an address
// must not come off the list because a filter looked at it.
export function UnsubscribeButton({ token }: { token: string }) {
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done !== null) {
    return (
      <p className="animate-rise mt-6 text-secondary" role="status">
        Done. {done ? `${done} is off the list.` : "That address is off the list."}
      </p>
    );
  }

  return (
    <div className="mt-6 flex flex-col items-start gap-2">
      <Button
        size="md"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await unsubscribe(token);
            if (!result.ok) return setError(result.error);
            setDone(result.email ?? "");
          })
        }
      >
        {pending ? "Taking you off…" : "Stop emailing me"}
      </Button>
      {error && (
        <p className="animate-rise text-sm text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
