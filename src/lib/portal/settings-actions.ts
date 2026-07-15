"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerUserClient } from "@/lib/supabase/server";
import {
  healStudentProfileTier,
  normalizeTier,
  resolveStudentMembershipTier,
} from "@/lib/portal/membership";
import { getCommunities } from "@/lib/portal/queries";
import {
  parsePreferences,
  validatePasswordStrength,
  type StudentPreferences,
} from "@/lib/portal/settings";
import type { PortalProfile } from "@/lib/portal/types";

export type SettingsActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

function revalidateSettings() {
  revalidatePath("/portal/settings");
  revalidatePath("/portal/security");
  revalidatePath("/portal", "layout");
  revalidatePath("/portal");
}

async function requireUser() {
  const supabase = await createSupabaseServerUserClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { supabase, user: null as null };
  }
  return { supabase, user };
}

async function reauthenticate(
  supabase: Awaited<ReturnType<typeof createSupabaseServerUserClient>>,
  email: string,
  password: string
) {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return error;
}

/** Update full name via guarded RPC (cannot change role/tier/status). */
export async function updateProfileName(
  _prev: SettingsActionResult | null,
  formData: FormData
): Promise<SettingsActionResult> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (fullName.length < 2 || fullName.length > 80) {
    return {
      ok: false,
      message: "Name must be between 2 and 80 characters.",
    };
  }
  if (/[<>{}]/.test(fullName)) {
    return { ok: false, message: "Name contains invalid characters." };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const { error } = await supabase.rpc("update_own_profile", {
    p_full_name: fullName,
    p_sync_email: null,
  });

  if (error) {
    console.error("updateProfileName", error.message);
    return {
      ok: false,
      message: "We couldn't update your name. Please try again.",
    };
  }

  // Keep Auth metadata in sync for greetings / invites.
  await supabase.auth.updateUser({
    data: { full_name: fullName },
  });

  revalidateSettings();
  return { ok: true, message: "Your name has been updated." };
}

/**
 * Request email change. Current email stays active until the new address
 * is confirmed via Supabase Auth email link.
 */
export async function requestEmailChange(
  _prev: SettingsActionResult | null,
  formData: FormData
): Promise<SettingsActionResult> {
  const newEmail = String(formData.get("new_email") ?? "")
    .trim()
    .toLowerCase();
  const currentPassword = String(formData.get("current_password") ?? "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  if (!currentPassword) {
    return {
      ok: false,
      message: "Enter your current password to confirm this change.",
    };
  }

  const { supabase, user } = await requireUser();
  if (!user?.email) {
    return { ok: false, message: "Please sign in again." };
  }

  if (newEmail === user.email.toLowerCase()) {
    return {
      ok: false,
      message: "That is already your current email address.",
    };
  }

  const reauthError = await reauthenticate(
    supabase,
    user.email,
    currentPassword
  );
  if (reauthError) {
    return {
      ok: false,
      message: "Current password is incorrect.",
    };
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.COURSE_SITE_URL?.replace(/\/$/, "") ||
    "https://aivanzaacademy.com";

  const { error } = await supabase.auth.updateUser(
    { email: newEmail },
    {
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(
        "/portal/security?email=updated"
      )}`,
    }
  );

  if (error) {
    console.error("requestEmailChange", error.message);
    // Safe message — avoid account enumeration.
    return {
      ok: false,
      message: "We couldn't use that email address. Please try another one.",
    };
  }

  revalidateSettings();
  return {
    ok: true,
    message:
      "Verification sent to your new email address. Your current email remains active until the new address is confirmed.",
  };
}

/** Change password after proving current password. Never logs secrets. */
export async function changePassword(
  _prev: SettingsActionResult | null,
  formData: FormData
): Promise<SettingsActionResult> {
  const currentPassword = String(formData.get("current_password") ?? "");
  const newPassword = String(formData.get("new_password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { ok: false, message: "All password fields are required." };
  }
  if (newPassword !== confirmPassword) {
    return { ok: false, message: "New password and confirmation do not match." };
  }
  if (newPassword === currentPassword) {
    return {
      ok: false,
      message: "Choose a new password that is different from your current one.",
    };
  }

  const { supabase, user } = await requireUser();
  if (!user?.email) {
    return { ok: false, message: "Please sign in again." };
  }

  const strength = validatePasswordStrength(newPassword, {
    email: user.email,
    fullName:
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : null,
  });
  if (!strength.ok) {
    return { ok: false, message: strength.message };
  }

  const reauthError = await reauthenticate(
    supabase,
    user.email,
    currentPassword
  );
  if (reauthError) {
    return { ok: false, message: "Current password is incorrect." };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    console.error("changePassword", error.message);
    return {
      ok: false,
      message: "We couldn't update your password. Please try again.",
    };
  }

  revalidateSettings();
  return {
    ok: true,
    message: "Your password has been updated.",
  };
}

/** Sign out other devices; keep current session when supported. */
export async function signOutOtherSessions(): Promise<SettingsActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  // Supabase JS: scope 'others' revokes refresh tokens except current session.
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) {
    console.error("signOutOtherSessions", error.message);
    return {
      ok: false,
      message:
        "We couldn't sign out other sessions right now. Please try again.",
    };
  }

  revalidateSettings();
  return {
    ok: true,
    message:
      "Other sessions have been signed out. This device stays signed in.",
  };
}

export async function updateNotificationPreferences(
  _prev: SettingsActionResult | null,
  formData: FormData
): Promise<SettingsActionResult> {
  const prefs: StudentPreferences = {
    email_announcements: formData.get("email_announcements") === "on",
    email_support_replies: formData.get("email_support_replies") === "on",
    email_session_reminders: formData.get("email_session_reminders") === "on",
    reduce_motion: formData.get("reduce_motion") === "on",
  };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const { error } = await supabase.rpc("update_own_preferences", {
    p_prefs: prefs,
  });

  if (error) {
    console.error("updateNotificationPreferences", error.message);
    return {
      ok: false,
      message: "We couldn't save your preferences. Please try again.",
    };
  }

  revalidateSettings();
  return { ok: true, message: "Preferences saved." };
}

/** Sync profile.email after Auth email change is confirmed. */
export async function syncVerifiedEmailToProfile(): Promise<SettingsActionResult> {
  const { supabase, user } = await requireUser();
  if (!user?.email) return { ok: false, message: "Please sign in again." };

  const { error } = await supabase.rpc("update_own_profile", {
    p_full_name: null,
    p_sync_email: user.email,
  });

  if (error) {
    console.error("syncVerifiedEmailToProfile", error.message);
    return { ok: false, message: "Could not sync email to profile." };
  }

  revalidateSettings();
  return { ok: true, message: "Email synchronized." };
}

export async function loadSettingsContext() {
  const { supabase, user } = await requireUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, role, tier, status, batch, preferences, created_at, email_verified, updated_at"
    )
    .eq("id", user.id)
    .maybeSingle();

  const [{ count: courseCount }, communityRows] = await Promise.all([
    supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active"),
    getCommunities(supabase).catch(() => [] as { name: string }[]),
  ]);

  const communities = communityRows.map((c) => c.name).filter(Boolean);

  const identities = user.identities ?? [];
  const userWithPending = user as typeof user & { new_email?: string | null };
  const pendingEmail =
    typeof userWithPending.new_email === "string"
      ? userWithPending.new_email
      : null;

  let resolvedProfile = profile
    ? ({
        ...profile,
        tier: normalizeTier(profile.tier),
      } as PortalProfile)
    : null;

  if (resolvedProfile && resolvedProfile.role === "student") {
    const tier = await resolveStudentMembershipTier(supabase, resolvedProfile);
    await healStudentProfileTier(resolvedProfile, tier);
    resolvedProfile = {
      ...resolvedProfile,
      tier,
      created_at:
        typeof profile?.created_at === "string" ? profile.created_at : null,
    };
  }

  return {
    user: {
      id: user.id,
      email: user.email ?? null,
      emailConfirmedAt: user.email_confirmed_at ?? null,
      lastSignInAt: user.last_sign_in_at ?? null,
      createdAt: user.created_at ?? null,
      pendingEmail,
      identitiesCount: identities.length,
    },
    profile: resolvedProfile,
    preferences: parsePreferences(profile?.preferences),
    courseCount: courseCount ?? 0,
    communities,
  };
}
