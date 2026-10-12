"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Message } from "@/components/ui/message";
import { emailError } from "@/lib/validation";
import { IconBell, IconBellOff, IconCheck } from "@tabler/icons-react";

// Shown only while ordering is shut: the one moment someone wants cookies and
// cannot have them.
export function NotifyForm({
  signedInAs,
  alreadyOnList = false,
}: {
  signedInAs?: string | null;
  alreadyOnList?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [onList, setOnList] = useState(alreadyOnList);
  const [justJoined, setJustJoined] = useState(false);
  const [wasAlready, setWasAlready] = useState(false);

  // The count is what makes the field shake, so a refusal that never increments it
  // passes in silence.
  const refuse = (message: string) => {
    setProblem(message);
    setAttempt((n) => n + 1);
  };

  async function ask(method: "POST" | "DELETE", body: unknown) {
    setPending(true);
    setProblem(null);
    try {
      const response = await fetch("/api/notify", {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "POST" ? JSON.stringify(body) : undefined,
      });
      const parsed: unknown = await response.json().catch(() => null);
      const field = (key: string) =>
        parsed && typeof parsed === "object" && key in parsed
          ? (parsed as Record<string, unknown>)[key]
          : null;
      if (!response.ok) {
        const message = field("error");
        refuse(message ? String(message) : "That didn't send. Try again in a moment.");
        return false;
      }
      setWasAlready(field("already") === true);
      return true;
    } catch {
      refuse("That didn't send. Check your connection and try again.");
      return false;
    } finally {
      setPending(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!signedInAs) {
      const wrong = emailError(email);
      if (wrong) return refuse(wrong);
    }
    if (await ask("POST", signedInAs ? {} : { email })) {
      setOnList(true);
      setJustJoined(true);
    }
  }

  async function leave() {
    if (await ask("DELETE", null)) {
      setOnList(false);
      setJustJoined(false);
      setWasAlready(false);
    }
  }

  // Someone not signed in has no address the page can recognise, so they only ever see
  // the thank-you for this visit. Their way off the list is the link in the email.
  if (onList) {
    return (
      <div className="mt-6 flex flex-col items-start gap-2">
        <p
          className={`flex items-start gap-2 text-secondary ${justJoined ? "animate-rise" : ""}`}
          role="status"
        >
          <IconCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
          {wasAlready
            ? "You're already on the list. I'll email you when the next batch opens."
            : "You're on the list. I'll email you when the next batch opens."}
          </span>
        </p>
        {signedInAs && (
          <button
            type="button"
            onClick={leave}
            disabled={pending}
            className="inline-flex items-center gap-2 py-2 text-sm text-secondary transition-colors ease-spring hover:text-primary disabled:text-disabled"
          >
            <IconBellOff aria-hidden className="size-4 shrink-0" />
            <span className="underline">
              {pending ? "Taking you off…" : "Take me off the list"}
            </span>
          </button>
        )}
        {problem && (
          <Message tone="error" className="animate-rise text-sm">
            {problem}
          </Message>
        )}
      </div>
    );
  }

  if (signedInAs) {
    return (
      <form onSubmit={submit} className="mt-6 flex flex-col items-start gap-2">
        <Button type="submit" size="md" disabled={pending}>
          <IconBell aria-hidden className="size-4" />
          {pending ? "Adding you…" : "Email me when it opens"}
        </Button>
        {problem && (
          <Message tone="error" className="text-sm">
            {problem}
          </Message>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="mt-6 flex max-w-md flex-col gap-2">
      <Input
        label="Email me when the next batch opens"
        id="notify-email"
        type="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (problem) setProblem(null);
        }}
        autoComplete="email"
        placeholder="you@email.com"
        error={problem ?? undefined}
        attempt={attempt}
      />
      <Button type="submit" size="md" disabled={pending} className="self-start">
        {pending ? "Adding you…" : "Tell me when it opens"}
      </Button>
    </form>
  );
}
