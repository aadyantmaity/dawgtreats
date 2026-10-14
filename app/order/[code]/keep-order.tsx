"use client";

import { IconUserPlus } from "@tabler/icons-react";
import { useState, useTransition } from "react";

import { keepOrderAction } from "@/app/order/[code]/claim-actions";
import { SignInWithGoogle } from "@/components/sign-in";
import { Button } from "@/components/ui/button";
import { Message } from "@/components/ui/message";

// Offered once the cookies are paid for, which is the moment an account is worth having
// and the moment it costs nothing to say so. The order is kept by its own code, never by
// matching an address: the one typed at checkout and the one behind a Google account are
// often different people's idea of the same person.
export function KeepOrder({ orderCode, signedIn }: { orderCode: string; signedIn: boolean }) {
  const [kept, setKept] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, startTransition] = useTransition();

  if (kept) {
    return (
      <Message tone="success" className="mt-6 text-sm">
        Kept. This order is in your account now.
      </Message>
    );
  }

  return (
    <div className="mt-6 rounded-card border border-default bg-surface p-5">
      <p className="font-medium">Keep this order in your account</p>
      <p className="mt-1 text-sm text-secondary">
        Then it is here next time, without the code.
      </p>
      <div className="mt-4">
        {signedIn ? (
          <Button
            size="md"
            disabled={saving}
            onClick={() =>
              startTransition(async () => {
                setProblem(null);
                try {
                  await keepOrderAction(orderCode);
                  setKept(true);
                } catch {
                  setProblem("That didn't save. Try again in a moment.");
                }
              })
            }
          >
            <IconUserPlus aria-hidden className="size-4" />
            {saving ? "Keeping…" : "Keep it"}
          </Button>
        ) : (
          <SignInWithGoogle next={`/order/${orderCode}`} />
        )}
      </div>
      {problem && (
        <Message tone="error" className="mt-3 text-sm">
          {problem}
        </Message>
      )}
    </div>
  );
}
