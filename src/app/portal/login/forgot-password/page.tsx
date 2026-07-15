"use client";

import { Suspense, useId, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-client";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type Feedback = {
  tone: "error" | "success" | "info";
  message: string;
} | null;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const emailId = useId();
  const formErrorId = useId();
  const emailErrorId = useId();

  const initialEmail = useMemo(() => {
    const fromQuery = searchParams.get("email");
    return typeof fromQuery === "string" ? fromQuery.trim() : "";
  }, [searchParams]);

  const [email, setEmail] = useState(initialEmail);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setFieldError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setFieldError("Enter the email address for your academy account.");
      setFeedback({
        tone: "error",
        message: "Enter your email address to continue.",
      });
      return;
    }
    if (!isValidEmail(trimmed)) {
      setFieldError("Enter a valid email address.");
      setFeedback({
        tone: "error",
        message: "That doesn’t look like a valid email address.",
      });
      return;
    }

    if (!isSupabaseConfigured()) {
      setFeedback({
        tone: "error",
        message:
          "Password reset is not available right now. Please try again later.",
      });
      return;
    }

    setLoading(true);
    try {
      const supabase = createSupabaseAuthClient();
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";

      // Always show the same success copy (no account enumeration).
      await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${origin}/auth/confirm?next=${encodeURIComponent("/portal")}`,
      });

      setSent(true);
      setFeedback({
        tone: "success",
        message:
          "If an account exists for that email, we’ll send password-reset instructions shortly. Check your inbox and spam folder.",
      });
    } catch {
      setFeedback({
        tone: "error",
        message:
          "We couldn’t send a reset email right now. Check your connection and try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="pt-login-card" aria-labelledby="pt-forgot-title">
      <header className="pt-login-brand">
        <div className="pt-login-logo-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.webp"
            alt=""
            width={48}
            height={48}
            decoding="async"
          />
        </div>
        <span className="pt-login-eyebrow">AIvanza Academy</span>
        <h1 id="pt-forgot-title">Forgot password</h1>
        <p className="pt-login-lead">
          Enter the email on your student account. If it matches an academy
          account, we’ll send a secure reset link.
        </p>
      </header>

      {feedback ? (
        <div
          className="pt-login-alert"
          data-tone={feedback.tone}
          role={feedback.tone === "error" ? "alert" : "status"}
          aria-live="polite"
          id={formErrorId}
        >
          {feedback.message}
        </div>
      ) : null}

      {!sent ? (
        <form className="pt-login-form" onSubmit={onSubmit} noValidate>
          <div className="pt-login-field">
            <label htmlFor={emailId}>Email</label>
            <div className="pt-login-input-wrap">
              <Mail
                className="pt-login-input-icon"
                size={17}
                aria-hidden="true"
              />
              <input
                id={emailId}
                type="email"
                name="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFieldError(null);
                  if (feedback?.tone === "error") setFeedback(null);
                }}
                required
                disabled={loading}
                aria-invalid={fieldError ? true : undefined}
                aria-describedby={
                  fieldError
                    ? emailErrorId
                    : feedback
                      ? formErrorId
                      : undefined
                }
              />
            </div>
            {fieldError ? (
              <p className="pt-login-field-error" id={emailErrorId} role="alert">
                {fieldError}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            className="pt-btn pt-btn-primary pt-btn-block pt-login-submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2
                  className="pt-login-spin"
                  size={18}
                  aria-hidden="true"
                />
                Sending reset link…
              </>
            ) : (
              <>
                <KeyRound size={18} aria-hidden="true" />
                Send reset link
              </>
            )}
          </button>
        </form>
      ) : (
        <div className="pt-login-form">
          <Link
            href="/portal/login"
            className="pt-btn pt-btn-primary pt-btn-block pt-login-submit"
          >
            Back to sign in
          </Link>
          <button
            type="button"
            className="pt-btn pt-btn-ghost pt-btn-block"
            onClick={() => {
              setSent(false);
              setFeedback(null);
            }}
          >
            Use a different email
          </button>
        </div>
      )}

      <aside className="pt-login-info" aria-label="Account setup note">
        <span className="pt-login-info-icon" aria-hidden="true">
          <ShieldCheck size={18} />
        </span>
        <div className="pt-login-info-copy">
          <strong>New student?</strong>
          <p>
            If you haven’t set up your account yet, use the secure setup link
            from your payment confirmation email instead of a password reset.
          </p>
        </div>
      </aside>

      <div className="pt-login-footer-links">
        <Link href="/portal/login" className="pt-login-back">
          <ArrowLeft size={15} aria-hidden="true" />
          Back to sign in
        </Link>
        <Link href="/#contact" className="pt-login-help">
          Having trouble? Contact support
        </Link>
      </div>
    </section>
  );
}

function ForgotPasswordFallback() {
  return (
    <section className="pt-login-card" aria-busy="true">
      <header className="pt-login-brand">
        <div className="pt-login-logo-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.webp" alt="" width={48} height={48} decoding="async" />
        </div>
        <span className="pt-login-eyebrow">AIvanza Academy</span>
        <h1>Forgot password</h1>
        <p className="pt-login-lead">Loading…</p>
      </header>
    </section>
  );
}

export default function ForgotPasswordPage() {
  return (
    <main className="pt-login-page">
      <div className="pt-login-bg" aria-hidden="true">
        <span className="pt-login-glow pt-login-glow-a" />
        <span className="pt-login-glow pt-login-glow-b" />
        <span className="pt-login-grid" />
        <span className="pt-login-vignette" />
      </div>

      <div className="pt-login-shell">
        <Suspense fallback={<ForgotPasswordFallback />}>
          <ForgotPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
