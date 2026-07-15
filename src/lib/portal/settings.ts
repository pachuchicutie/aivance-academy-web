export type StudentPreferences = {
  email_announcements: boolean;
  email_support_replies: boolean;
  email_session_reminders: boolean;
  reduce_motion: boolean;
};

export const DEFAULT_PREFERENCES: StudentPreferences = {
  email_announcements: true,
  email_support_replies: true,
  email_session_reminders: true,
  reduce_motion: false,
};

export function parsePreferences(raw: unknown): StudentPreferences {
  const obj =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  return {
    email_announcements:
      typeof obj.email_announcements === "boolean"
        ? obj.email_announcements
        : DEFAULT_PREFERENCES.email_announcements,
    email_support_replies:
      typeof obj.email_support_replies === "boolean"
        ? obj.email_support_replies
        : DEFAULT_PREFERENCES.email_support_replies,
    email_session_reminders:
      typeof obj.email_session_reminders === "boolean"
        ? obj.email_session_reminders
        : DEFAULT_PREFERENCES.email_session_reminders,
    reduce_motion:
      typeof obj.reduce_motion === "boolean"
        ? obj.reduce_motion
        : DEFAULT_PREFERENCES.reduce_motion,
  };
}

export type PasswordPolicyResult =
  | { ok: true }
  | { ok: false; message: string };

/** Shared password policy for settings + invite setup (min 12 with mix). */
export function validatePasswordStrength(
  password: string,
  opts?: { email?: string | null; fullName?: string | null }
): PasswordPolicyResult {
  if (password !== password.trim() || !password.trim()) {
    return { ok: false, message: "Password cannot be only spaces." };
  }
  if (password.length < 12) {
    return {
      ok: false,
      message: "Password must be at least 12 characters.",
    };
  }
  if (!/[A-Z]/.test(password)) {
    return {
      ok: false,
      message: "Include at least one uppercase letter.",
    };
  }
  if (!/[a-z]/.test(password)) {
    return {
      ok: false,
      message: "Include at least one lowercase letter.",
    };
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, message: "Include at least one number." };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return {
      ok: false,
      message: "Include at least one symbol (e.g. ! @ # $).",
    };
  }

  const email = (opts?.email ?? "").trim().toLowerCase();
  if (email && password.toLowerCase().includes(email)) {
    return {
      ok: false,
      message: "Password cannot contain your email address.",
    };
  }
  const local = email.includes("@") ? email.split("@")[0] : "";
  if (local.length >= 4 && password.toLowerCase().includes(local)) {
    return {
      ok: false,
      message: "Password cannot contain your email username.",
    };
  }

  const name = (opts?.fullName ?? "").trim().toLowerCase();
  if (name.length >= 4 && password.toLowerCase().includes(name)) {
    return {
      ok: false,
      message: "Password cannot contain your full name.",
    };
  }

  return { ok: true };
}

export function passwordStrengthScore(password: string): number {
  let score = 0;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(4, score);
}

export function strengthLabel(score: number) {
  if (score <= 1) return "Weak";
  if (score === 2) return "Fair";
  if (score === 3) return "Good";
  return "Strong";
}
