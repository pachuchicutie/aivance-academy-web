"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Mail,
  Save,
  Shield,
} from "lucide-react";
import {
  changePassword,
  requestEmailChange,
  signOutOtherSessions,
  updateNotificationPreferences,
  updateProfileName,
  type SettingsActionResult,
} from "@/lib/portal/settings-actions";
import {
  passwordStrengthScore,
  strengthLabel,
  type StudentPreferences,
} from "@/lib/portal/settings";

function Feedback({ state }: { state: SettingsActionResult | null }) {
  if (!state) return null;
  if (state.ok) {
    return (
      <p className="pt-form-success" role="status">
        <CheckCircle2 size={14} aria-hidden="true" /> {state.message}
      </p>
    );
  }
  return (
    <p className="pt-form-error" role="alert">
      {state.message}
    </p>
  );
}

function PasswordField({
  name,
  label,
  autoComplete,
  disabled,
  value,
  onChange,
}: {
  name: string;
  label: string;
  autoComplete: string;
  disabled?: boolean;
  value?: string;
  onChange?: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="pt-field">
      <span>{label}</span>
      <div className="pt-password-wrap">
        <input
          type={show ? "text" : "password"}
          name={name}
          autoComplete={autoComplete}
          required
          disabled={disabled}
          value={value}
          onChange={
            onChange ? (e) => onChange(e.target.value) : undefined
          }
        />
        <button
          type="button"
          className="pt-password-toggle"
          aria-label={show ? "Hide password" : "Show password"}
          onClick={() => setShow((v) => !v)}
          tabIndex={-1}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </label>
  );
}

function profileInitials(name: string, email: string | null) {
  const clean = name.trim();
  if (clean) {
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "ST";
}

export function ProfileNameForm({
  initialName,
  email,
}: {
  initialName: string;
  email?: string | null;
}) {
  const router = useRouter();
  const [draftName, setDraftName] = useState(initialName);
  const [state, action, pending] = useActionState(
    updateProfileName,
    null as SettingsActionResult | null
  );

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  // After successful save, server re-renders with new initialName; remount via key.
  const formKey = state?.ok ? `saved-${initialName}` : "edit";

  return (
    <form key={formKey} action={action} className="pt-form">
      <div className="pt-profile-identity">
        <span className="pt-profile-identity-avatar" aria-hidden="true">
          {profileInitials(draftName || initialName, email ?? null)}
        </span>
        <div className="pt-profile-identity-copy">
          <strong>{draftName.trim() || initialName || "Student"}</strong>
          <span>{email ?? "No email on file"}</span>
        </div>
      </div>
      <label className="pt-field">
        <span>Full name</span>
        <input
          type="text"
          name="full_name"
          required
          minLength={2}
          maxLength={80}
          defaultValue={initialName}
          disabled={pending}
          autoComplete="name"
          onChange={(e) => setDraftName(e.target.value)}
        />
      </label>
      <p className="pt-assist-note">
        Updating your name changes the sidebar, dashboard greeting, and portal
        display. Role, tier, and enrollment cannot be edited here.
      </p>
      <Feedback state={state} />
      <div className="pt-form-actions">
        <button type="submit" className="pt-btn pt-btn-soft" disabled={pending}>
          <Save size={15} aria-hidden="true" />
          {pending ? "Saving…" : "Save name"}
        </button>
      </div>
    </form>
  );
}

export function EmailChangeForm({
  currentEmail,
  pendingEmail,
  emailVerified = true,
}: {
  currentEmail: string | null;
  pendingEmail: string | null;
  emailVerified?: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    requestEmailChange,
    null as SettingsActionResult | null
  );

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="pt-form">
      <div className="pt-settings-readonly">
        <span>Current email</span>
        <strong>{currentEmail ?? "-"}</strong>
        <em className="pt-settings-verify-status">
          {emailVerified ? "Verified" : "Not verified yet"}
        </em>
      </div>
      {pendingEmail ? (
        <p className="pt-settings-pending" role="status">
          Pending verification: <strong>{pendingEmail}</strong>. Your current
          email remains active until the new address is confirmed. Check that
          inbox and open the verification link.
        </p>
      ) : null}
      <label className="pt-field">
        <span>New email</span>
        <input
          type="email"
          name="new_email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          disabled={pending}
        />
      </label>
      <PasswordField
        name="current_password"
        label="Current password"
        autoComplete="current-password"
        disabled={pending}
      />
      <Feedback state={state} />
      <div className="pt-form-actions">
        <button type="submit" className="pt-btn pt-btn-soft" disabled={pending}>
          <Mail size={15} aria-hidden="true" />
          {pending ? "Sending…" : "Send verification"}
        </button>
      </div>
    </form>
  );
}

export function PasswordChangeForm({
  email: _email,
  fullName: _fullName,
}: {
  email: string | null;
  fullName: string | null;
}) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [formKey, setFormKey] = useState(0);
  const [state, action, pending] = useActionState(
    changePassword,
    null as SettingsActionResult | null
  );

  // Server validates strength using session user; props kept for future UI hints.
  void _email;
  void _fullName;

  if (state?.ok) {
    return (
      <div className="pt-form">
        <Feedback state={state} />
        <div className="pt-form-actions">
          <button
            type="button"
            className="pt-btn pt-btn-ghost"
            onClick={() => {
              setNewPassword("");
              setFormKey((k) => k + 1);
              router.refresh();
            }}
          >
            Change password again
          </button>
        </div>
      </div>
    );
  }

  const score = passwordStrengthScore(newPassword);

  return (
    <form key={formKey} action={action} className="pt-form">
      <PasswordField
        name="current_password"
        label="Current password"
        autoComplete="current-password"
        disabled={pending}
      />
      <PasswordField
        name="new_password"
        label="New password"
        autoComplete="new-password"
        disabled={pending}
        value={newPassword}
        onChange={setNewPassword}
      />
      <div className="pt-password-meter" data-score={score} aria-live="polite">
        <div className="pt-password-meter-bar">
          <span style={{ width: `${(score / 4) * 100}%` }} />
        </div>
        <small>
          Strength: {newPassword ? strengthLabel(score) : "-"} · Min 12 chars,
          upper, lower, number, symbol
        </small>
      </div>
      <PasswordField
        name="confirm_password"
        label="Confirm new password"
        autoComplete="new-password"
        disabled={pending}
      />
      <Feedback state={state} />
      <div className="pt-form-actions">
        <button type="submit" className="pt-btn pt-btn-soft" disabled={pending}>
          <KeyRound size={15} aria-hidden="true" />
          {pending ? "Updating…" : "Update password"}
        </button>
      </div>
    </form>
  );
}

export function SessionsPanel() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<SettingsActionResult | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function onConfirm() {
    setPending(true);
    setResult(null);
    try {
      const res = await signOutOtherSessions();
      setResult(res);
      setConfirming(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="pt-form">
      <p className="pt-assist-note">
        Sign out of your account on other browsers and devices. This device
        stays signed in.
      </p>
      {!confirming ? (
        <div className="pt-form-actions">
          <button
            type="button"
            className="pt-btn pt-btn-ghost"
            onClick={() => setConfirming(true)}
          >
            <LogOut size={15} aria-hidden="true" />
            Sign out other devices
          </button>
        </div>
      ) : (
        <div className="pt-settings-confirm">
          <p>
            <Shield size={16} aria-hidden="true" /> End all other sessions?
          </p>
          <div className="pt-form-actions">
            <button
              type="button"
              className="pt-btn pt-btn-soft"
              disabled={pending}
              onClick={() => void onConfirm()}
            >
              {pending ? "Signing out…" : "Yes, sign out others"}
            </button>
            <button
              type="button"
              className="pt-btn pt-btn-ghost"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <Feedback state={result} />
    </div>
  );
}

export function PreferencesForm({
  initial,
}: {
  initial: StudentPreferences;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    updateNotificationPreferences,
    null as SettingsActionResult | null
  );

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="pt-form">
      <label className="pt-check">
        <input
          type="checkbox"
          name="email_announcements"
          defaultChecked={initial.email_announcements}
          disabled={pending}
        />
        <span>Email me about academy announcements</span>
      </label>
      <label className="pt-check">
        <input
          type="checkbox"
          name="email_support_replies"
          defaultChecked={initial.email_support_replies}
          disabled={pending}
        />
        <span>Email me when support replies</span>
      </label>
      <label className="pt-check">
        <input
          type="checkbox"
          name="email_session_reminders"
          defaultChecked={initial.email_session_reminders}
          disabled={pending}
        />
        <span>Email me live-session reminders</span>
      </label>
      <label className="pt-check">
        <input
          type="checkbox"
          name="reduce_motion"
          defaultChecked={initial.reduce_motion}
          disabled={pending}
        />
        <span>Prefer reduced motion in the portal</span>
      </label>
      <Feedback state={state} />
      <div className="pt-form-actions">
        <button type="submit" className="pt-btn pt-btn-soft" disabled={pending}>
          <Save size={15} aria-hidden="true" />
          {pending ? "Saving…" : "Save preferences"}
        </button>
      </div>
    </form>
  );
}
