"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function SignInWithGoogle({ next = "/account" }: { next?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) {
        setError("Couldn’t start sign-in. Try again.");
        setBusy(false);
      }
    } catch {
      setError("Couldn’t start sign-in. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button size="md" variant="secondary" onClick={signIn} disabled={busy}>
        {busy ? "Opening Google…" : "Sign in with Google"}
      </Button>
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}
