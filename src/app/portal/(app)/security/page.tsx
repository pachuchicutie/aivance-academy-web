import { redirect } from "next/navigation";
import Link from "next/link";
import {
  KeyRound,
  Mail,
  Settings,
  Shield,
  ShieldCheck,
} from "lucide-react";
import { getPortalContext } from "@/lib/portal/queries";
import {
  loadSettingsContext,
  syncVerifiedEmailToProfile,
} from "@/lib/portal/settings-actions";
import { formatDate } from "@/lib/portal/format";
import {
  PageHeader,
  PortalCardBody,
  PortalCardHeader,
  SectionHead,
  TypeBadge,
} from "@/components/portal/ui";
import {
  EmailChangeForm,
  PasswordChangeForm,
  SessionsPanel,
} from "@/components/portal/settings/SettingsForms";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Security | AIvanza Academy",
};

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const params = await searchParams;
  const { profile: gateProfile } = await getPortalContext();
  if (gateProfile.status !== "active") {
    redirect("/portal");
  }

  const ctx = await loadSettingsContext();
  if (!ctx) redirect("/portal/login");

  // After email confirm redirect, sync profile.email to Auth email.
  if (params.email === "updated" && ctx.user.email) {
    await syncVerifiedEmailToProfile();
  }

  const fullName = ctx.profile?.full_name ?? "";
  const emailVerified = Boolean(ctx.user.emailConfirmedAt);
  const pendingEmail = ctx.user.pendingEmail;
  const hasPasswordIdentity =
    (ctx.user.identitiesCount ?? 0) > 0 || Boolean(ctx.user.email);

  return (
    <>
      <PageHeader
        eyebrow="ACCOUNT SECURITY"
        title="Security"
        description="Manage your email, password, sessions, and sign-in security."
        action={
          <Link href="/portal/settings" className="pt-btn pt-btn-ghost pt-btn-sm">
            <Settings size={15} aria-hidden="true" />
            Account Settings
          </Link>
        }
      />

      <div className="pt-security-layout">
        <section className="pt-panel pt-settings-card" id="email">
          <PortalCardHeader>
            <SectionHead
              icon={Mail}
              title="Email address & verification"
              description="Changes require verification. Your current email stays active until you confirm the new one."
            />
          </PortalCardHeader>
          <PortalCardBody>
            <EmailChangeForm
              currentEmail={ctx.user.email}
              pendingEmail={pendingEmail}
              emailVerified={emailVerified}
            />
          </PortalCardBody>
        </section>

        <section className="pt-panel pt-settings-card" id="password">
          <PortalCardHeader>
            <SectionHead
              icon={KeyRound}
              title="Change password"
              description="Require your current password, then set a strong new one."
            />
          </PortalCardHeader>
          <PortalCardBody>
            <PasswordChangeForm
              email={ctx.user.email}
              fullName={fullName || null}
            />
          </PortalCardBody>
        </section>

        <section className="pt-panel pt-settings-card" id="sessions">
          <PortalCardHeader>
            <SectionHead
              icon={Shield}
              title="Active sessions"
              description="End access on other browsers and devices. This device stays signed in when the service supports it."
            />
          </PortalCardHeader>
          <PortalCardBody>
            <SessionsPanel />
          </PortalCardBody>
        </section>

        <section className="pt-panel pt-settings-card" id="security-status">
          <PortalCardHeader>
            <SectionHead
              icon={ShieldCheck}
              title="Security status"
              description="Read-only sign-in security details from your authenticated session."
            />
          </PortalCardHeader>
          <PortalCardBody>
            <dl className="pt-settings-dl pt-settings-dl-wide">
              <div>
                <dt>Email verification</dt>
                <dd>
                  {emailVerified ? (
                    <TypeBadge label="Verified" tone="cyan" />
                  ) : (
                    <TypeBadge label="Unverified" tone="gold" />
                  )}
                </dd>
              </div>
              <div>
                <dt>Pending email change</dt>
                <dd>
                  {pendingEmail ? (
                    <span className="pt-settings-pending-inline">
                      {pendingEmail}
                    </span>
                  ) : (
                    "None"
                  )}
                </dd>
              </div>
              <div>
                <dt>Last sign-in</dt>
                <dd>
                  {ctx.user.lastSignInAt
                    ? formatDate(ctx.user.lastSignInAt)
                    : "-"}
                </dd>
              </div>
              <div>
                <dt>Password account</dt>
                <dd>
                  {hasPasswordIdentity
                    ? "Password sign-in available"
                    : "Not detected"}
                </dd>
              </div>
              <div>
                <dt>Multi-factor authentication</dt>
                <dd>Not enabled for this academy portal</dd>
              </div>
              <div>
                <dt>Session revocation</dt>
                <dd>Sign out other devices is available</dd>
              </div>
              <div>
                <dt>Current email</dt>
                <dd className="pt-settings-email-value">
                  {ctx.user.email ?? "-"}
                </dd>
              </div>
              <div>
                <dt>Account created</dt>
                <dd>
                  {ctx.user.createdAt
                    ? formatDate(ctx.user.createdAt)
                    : "-"}
                </dd>
              </div>
            </dl>
          </PortalCardBody>
        </section>
      </div>
    </>
  );
}
