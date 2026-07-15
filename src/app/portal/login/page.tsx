"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-client";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export default function PortalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isSupabaseConfigured()) {
      setError("Login is not configured right now.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createSupabaseAuthClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(
          signInError.message === "Invalid login credentials"
            ? "That email and password combination doesn't match our records."
            : signInError.message || "Unable to sign in."
        );
        return;
      }

      router.replace("/portal");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="pt-login-page">
      <section className="pt-login-card">
        <div className="pt-login-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.webp" alt="AIvanza Academy logo" width={44} height={44} />
        </div>
        <span className="pt-eyebrow">AIvanza Academy</span>
        <h1>Student Portal</h1>
        <p>Sign in to continue your courses, sessions, and communities.</p>

        <form className="pt-form" onSubmit={onSubmit}>
          <label className="pt-field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </label>
          <label className="pt-field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </label>
          {error ? (
            <p className="pt-form-error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className="pt-btn pt-btn-primary pt-btn-block"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="pt-login-foot">
          New students receive a secure account-setup link by email after
          payment confirmation.
        </p>
        <p className="pt-login-foot">
          <Link href="/">← Back to aivanzaacademy.com</Link>
        </p>
      </section>
    </main>
  );
}
