"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Props = {
  tokenHash?: string;
  type?: string;
};

export function AuthConfirmClient({ tokenHash, type }: Props) {
  const [status, setStatus] = useState<"working" | "ok" | "error">("working");
  const [message, setMessage] = useState("Confirming your invite…");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!isSupabaseConfigured()) {
        if (!cancelled) {
          setStatus("error");
          setMessage("Account setup is not configured right now. Please contact support.");
        }
        return;
      }

      if (!tokenHash || !type) {
        if (!cancelled) {
          setStatus("error");
          setMessage("This invite link is incomplete or invalid.");
        }
        return;
      }

      try {
        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as "invite" | "signup" | "magiclink" | "recovery" | "email",
        });

        if (cancelled) return;

        if (error) {
          setStatus("error");
          setMessage(
            error.message ||
              "This invite link is invalid or has expired. Please ask for a new invite."
          );
          return;
        }

        setStatus("ok");
        setMessage(
          "Your invite is confirmed. You can continue to the home page while we finish account setup."
        );
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("Something went wrong confirming your invite. Please try again.");
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [tokenHash, type]);

  return (
    <main className="auth-confirm-page">
      <section className="auth-confirm-card">
        <span className="eyebrow">Account setup</span>
        <h1>
          {status === "working"
            ? "Confirming invite…"
            : status === "ok"
              ? "Invite confirmed"
              : "Invite problem"}
        </h1>
        <p>{message}</p>
        <div className="pay-state-actions">
          <Link className="btn btn-primary" href="/">
            Back to home
          </Link>
          {status === "error" ? (
            <a
              className="btn btn-ghost"
              href="https://www.facebook.com/aivanza.academy/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Message Us
            </a>
          ) : null}
        </div>
      </section>
    </main>
  );
}
