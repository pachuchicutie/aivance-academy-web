"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-client";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type Props = {
  tokenHash?: string;
  type?: string;
  /** Always collect a password after invite/setup links */
  requirePassword?: boolean;
  /** Optional post-confirm redirect (e.g. /portal/settings) */
  nextPath?: string;
};

type Phase = "working" | "set-password" | "ok" | "error";

export function AuthConfirmClient({
  tokenHash,
  type,
  requirePassword = true,
  nextPath,
}: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("working");
  const [message, setMessage] = useState("Confirming your link…");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  const safeNext =
    nextPath && nextPath.startsWith("/portal") ? nextPath : "/portal";

  // Email-change / recovery confirmation should not force password setup.
  const needsPassword =
    requirePassword &&
    type !== "email_change" &&
    type !== "email" &&
    type !== "recovery";

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!isSupabaseConfigured()) {
        if (!cancelled) {
          setPhase("error");
          setMessage(
            "Account setup is not configured right now. Please contact support."
          );
        }
        return;
      }

      if (!tokenHash || !type) {
        if (!cancelled) {
          setPhase("error");
          setMessage("This confirmation link is incomplete or invalid.");
        }
        return;
      }

      try {
        const supabase = createSupabaseAuthClient();

        // Support invite / magiclink / recovery / signup / email_change
        const otpType = (type || "invite") as
          | "invite"
          | "signup"
          | "magiclink"
          | "recovery"
          | "email"
          | "email_change";

        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType,
        });

        if (cancelled) return;

        if (error) {
          setPhase("error");
          setMessage(
            error.message ||
              "This link is invalid or has expired. Please request a new one."
          );
          return;
        }

        const user = data.user ?? data.session?.user ?? null;
        setEmail(user?.email ?? null);

        // Email change completed — sync profile email when possible.
        if (otpType === "email_change" || otpType === "email") {
          if (user?.id && user.email) {
            await supabase.rpc("update_own_profile", {
              p_full_name: null,
              p_sync_email: user.email,
            });
          }
          setPhase("ok");
          setMessage("Your email address has been updated. Redirecting…");
          setTimeout(() => {
            if (!cancelled) {
              router.replace(
                safeNext.includes("settings")
                  ? "/portal/settings?email=updated"
                  : safeNext
              );
            }
          }, 900);
          return;
        }

        // Always collect password for account-setup links (invite + magiclink resends).
        if (needsPassword) {
          setPhase("set-password");
          setMessage(
            "Invite confirmed. Create a password to finish setting up your account."
          );
          return;
        }

        setPhase("ok");
        setMessage("You're signed in. Redirecting…");
        setTimeout(() => {
          if (!cancelled) router.replace(safeNext);
        }, 900);
      } catch {
        if (!cancelled) {
          setPhase("error");
          setMessage(
            "Something went wrong confirming this link. Please try again."
          );
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [tokenHash, type, needsPassword, router, safeNext]);

  async function onSetPassword(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (password.length < 12) {
      setFormError("Password must be at least 12 characters.");
      return;
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      setFormError(
        "Use upper & lower case letters, a number, and a symbol."
      );
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createSupabaseAuthClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setFormError(
          error.message || "Unable to save password. Please try again."
        );
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const fullName =
        typeof user?.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : null;

      if (user?.id && fullName) {
        await supabase
          .from("profiles")
          .update({ full_name: fullName, email: user.email ?? null })
          .eq("id", user.id);
      }

      setPhase("ok");
      setMessage("Password saved. Taking you to your student portal…");
      setTimeout(() => {
        router.replace("/portal");
      }, 800);
    } catch {
      setFormError(
        "Something went wrong saving your password. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  const title =
    phase === "working"
      ? "Confirming invite…"
      : phase === "set-password"
        ? "Create your password"
        : phase === "ok"
          ? "Account ready"
          : "Invite problem";

  return (
    <main className="auth-confirm-page">
      <section className="auth-confirm-card">
        <span className="eyebrow" style={{ justifyContent: "center" }}>
          Account setup
        </span>
        <h1>{title}</h1>
        <p className="auth-confirm-message">{message}</p>
        {email ? (
          <p className="auth-confirm-email">
            Signed in as <strong>{email}</strong>
          </p>
        ) : null}

        {phase === "set-password" ? (
          <form
            className="auth-password-form"
            onSubmit={onSetPassword}
            noValidate
          >
            <label className="auth-field">
              <span>Password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
              />
            </label>
            <label className="auth-field">
              <span>Confirm password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                required
                minLength={8}
              />
            </label>
            {formError ? (
              <p className="auth-form-error" role="alert">
                {formError}
              </p>
            ) : null}
            <button
              type="submit"
              className="btn btn-primary auth-confirm-btn"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save password & continue"}
            </button>
          </form>
        ) : null}

        {phase === "ok" || phase === "error" ? (
          <div className="auth-confirm-actions">
            {phase === "ok" ? (
              <Link className="btn btn-primary auth-confirm-btn" href="/portal">
                Enter student portal
              </Link>
            ) : null}
            <Link
              className={`btn ${phase === "ok" ? "btn-ghost" : "btn-primary"} auth-confirm-btn`}
              href="/"
            >
              Back to home
            </Link>
            {phase === "error" ? (
              <a
                className="btn btn-ghost auth-confirm-btn"
                href="https://www.facebook.com/aivanza.academy/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Message Us
              </a>
            ) : null}
          </div>
        ) : null}

        {phase === "working" ? (
          <div className="auth-confirm-spinner" aria-hidden="true" />
        ) : null}
      </section>
    </main>
  );
}
