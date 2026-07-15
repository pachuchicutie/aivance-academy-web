"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-client";
import { isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * If a student session exists on /, redirect to /portal.
 * Guests see the landing page as usual.
 */
export default function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "guest" | "authed">(
    "checking"
  );

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!isSupabaseConfigured()) {
        if (!cancelled) setState("guest");
        return;
      }

      try {
        const supabase = createSupabaseAuthClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (user) {
          setState("authed");
          router.replace("/portal");
          return;
        }

        setState("guest");
      } catch {
        if (!cancelled) setState("guest");
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state === "checking" || state === "authed") {
    return (
      <div className="auth-confirm-page" aria-busy="true" aria-live="polite">
        <div className="auth-confirm-card">
          <span className="eyebrow" style={{ justifyContent: "center" }}>
            AIvanza Academy
          </span>
          <h1>{state === "authed" ? "Welcome back" : "Loading…"}</h1>
          <p className="auth-confirm-message">
            {state === "authed"
              ? "Taking you to your student portal…"
              : "Checking your session."}
          </p>
          <div className="auth-confirm-spinner" aria-hidden="true" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
