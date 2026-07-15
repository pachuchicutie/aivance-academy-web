import type { ReactNode } from "react";
import { getPortalContext, getUnreadAnnouncementCount } from "@/lib/portal/queries";
import { getStudentSupportUnreadCount } from "@/lib/portal/support-queries";
import { parsePreferences } from "@/lib/portal/settings";
import { tierLabel } from "@/lib/portal/format";
import { StudentPortalShell } from "@/components/portal/StudentPortalShell";
import { AccountStatusNotice } from "@/components/portal/AccountStatusNotice";

export const dynamic = "force-dynamic";

export default async function PortalAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { supabase, profile, membership } = await getPortalContext();

  if (profile.status !== "active") {
    return <AccountStatusNotice status={profile.status} />;
  }

  const [unreadAnnouncements, unreadSupport, profilePrefs] = await Promise.all([
    getUnreadAnnouncementCount(supabase),
    getStudentSupportUnreadCount(supabase),
    supabase
      .from("profiles")
      .select("preferences")
      .eq("id", profile.id)
      .maybeSingle(),
  ]);

  const preferences = parsePreferences(profilePrefs.data?.preferences);

  // Always give the shell a visible plan label:
  // membership catalog → tier code label → Admin for staff.
  const isAdmin = profile.role === "admin";
  const planDisplayName =
    membership?.displayName?.trim() ||
    tierLabel(profile.tier) ||
    tierLabel(membership?.code) ||
    (isAdmin ? "Admin" : null);
  const planLabel =
    membership?.planLabel?.trim() ||
    (planDisplayName && planDisplayName !== "Admin"
      ? `${planDisplayName} Tier`
      : planDisplayName);
  const tierCode =
    membership?.code?.trim().toLowerCase() ||
    profile.tier?.trim().toLowerCase() ||
    (isAdmin ? "admin" : null);

  return (
    <StudentPortalShell
      profile={{
        id: profile.id,
        fullName: profile.full_name,
        email: profile.email,
        role: profile.role,
        tier: tierCode,
        /** Short public name e.g. "Basic" from membership_tiers.label */
        planDisplayName,
        /** Sentence form e.g. "Basic Tier" when needed elsewhere */
        planLabel,
        reduceMotion: preferences.reduce_motion,
      }}
      unreadAnnouncements={unreadAnnouncements}
      unreadSupport={unreadSupport}
    >
      {children}
    </StudentPortalShell>
  );
}
