"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-client";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type Feedback = {
  tone: "error" | "success" | "info";
  message: string;
} | null;

function mapSignInError(raw: string | undefined): string {
  const msg = (raw ?? "").toLowerCase();
  if (
    msg.includes("invalid login") ||
    msg.includes("invalid credentials") ||
    msg.includes("wrong password") ||
    msg.includes("user not found")
  ) {
    return "We couldn't sign you in with those details. Check your email and password and try again.";
  }
  if (msg.includes("email not confirmed")) {
    return "Your email isn't confirmed yet. Open the secure setup link from your invitation email, then try again.";
  }
  if (msg.includes("too many requests") || msg.includes("rate limit")) {
    return "Too many sign-in attempts. Please wait a moment and try again.";
  }
  if (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("failed to fetch")
  ) {
    return "We couldn't reach the sign-in service. Check your connection and try again.";
  }
  // Never surface raw provider/internal errors.
  return "We couldn't sign you in right now. Please try again in a moment.";
}

function isValidEmail(value: string): boolean {
  // Practical validation — not exhaustive RFC coverage.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function PortalLoginPage() {
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();
  const formErrorId = useId();
  const emailErrorId = useId();
  const passwordErrorId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [loading, setLoading] = useState(false);

  function clearMessages() {
    setFeedback(null);
    setFieldErrors({});
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    clearMessages();

    const trimmed = email.trim();
    const nextFieldErrors: { email?: string; password?: string } = {};

    if (!trimmed) {
      nextFieldErrors.email = "Enter the email address for your academy account.";
    } else if (!isValidEmail(trimmed)) {
      nextFieldErrors.email = "Enter a valid email address.";
    }
    if (!password) {
      nextFieldErrors.password = "Enter your password.";
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setFeedback({
        tone: "error",
        message: "Please fix the highlighted fields and try again.",
      });
      return;
    }

    if (!isSupabaseConfigured()) {
      setFeedback({
        tone: "error",
        message: "Sign-in is not available right now. Please try again later.",
      });
      return;
    }

    setLoading(true);
    try {
      const supabase = createSupabaseAuthClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmed,
        password,
      });

      if (signInError) {
        setFeedback({
          tone: "error",
          message: mapSignInError(signInError.message),
        });
        return;
      }

      router.replace("/portal");
      router.refresh();
    } catch {
      setFeedback({
        tone: "error",
        message:
          "We couldn't reach the sign-in service. Check your connection and try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  const forgotHref = email.trim()
    ? `/portal/login/forgot-password?email=${encodeURIComponent(email.trim())}`
    : "/portal/login/forgot-password";

  return (
    <main className="pt-login-page">
      <div className="pt-login-bg" aria-hidden="true">
        <span className="pt-login-glow pt-login-glow-a" />
        <span className="pt-login-glow pt-login-glow-b" />
        <span className="pt-login-grid" />
        <span className="pt-login-vignette" />
      </div>

      <div className="pt-login-shell">
        <section className="pt-login-card" aria-labelledby="pt-login-title">
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
            <h1 id="pt-login-title">Student Portal</h1>
            <p className="pt-login-lead">
              Sign in to continue your courses, live sessions, communities, and
              academy resources.
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
                    if (fieldErrors.email || feedback?.tone === "error") {
                      clearMessages();
                    }
                  }}
                  required
                  disabled={loading}
                  aria-invalid={fieldErrors.email ? true : undefined}
                  aria-describedby={
                    fieldErrors.email
                      ? emailErrorId
                      : feedback
                        ? formErrorId
                        : undefined
                  }
                />
              </div>
              {fieldErrors.email ? (
                <p className="pt-login-field-error" id={emailErrorId} role="alert">
                  {fieldErrors.email}
                </p>
              ) : null}
            </div>

            <div className="pt-login-field">
              <div className="pt-login-label-row">
                <label htmlFor={passwordId}>Password</label>
                <Link href={forgotHref} className="pt-login-text-btn">
                  Forgot password?
                </Link>
              </div>
              <div className="pt-login-input-wrap pt-login-input-wrap-password">
                <Lock
                  className="pt-login-input-icon"
                  size={17}
                  aria-hidden="true"
                />
                <input
                  id={passwordId}
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password || feedback?.tone === "error") {
                      clearMessages();
                    }
                  }}
                  required
                  disabled={loading}
                  aria-invalid={fieldErrors.password ? true : undefined}
                  aria-describedby={
                    fieldErrors.password ? passwordErrorId : undefined
                  }
                />
                <button
                  type="button"
                  className="pt-login-reveal"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={loading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <EyeOff size={17} aria-hidden="true" />
                  ) : (
                    <Eye size={17} aria-hidden="true" />
                  )}
                </button>
              </div>
              {fieldErrors.password ? (
                <p
                  className="pt-login-field-error"
                  id={passwordErrorId}
                  role="alert"
                >
                  {fieldErrors.password}
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
                  Signing in…
                </>
              ) : (
                <>
                  <LogIn size={18} aria-hidden="true" />
                  Sign in
                </>
              )}
            </button>
          </form>

          <aside className="pt-login-info" aria-label="New student information">
            <span className="pt-login-info-icon" aria-hidden="true">
              <ShieldCheck size={18} />
            </span>
            <div className="pt-login-info-copy">
              <strong>New student?</strong>
              <p>
                After your payment is confirmed, AIvanza Academy will email you a
                secure link to set up your account. There is no public sign-up.
              </p>
            </div>
          </aside>

          <div className="pt-login-footer-links">
            <Link href="/" className="pt-login-back">
              <ArrowLeft size={15} aria-hidden="true" />
              Back to AIvanza Academy
            </Link>
            <a
              href="https://www.facebook.com/aivanza.academy/"
              className="pt-login-help"
              target="_blank"
              rel="noopener noreferrer"
            >
              Having trouble? Contact support
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
