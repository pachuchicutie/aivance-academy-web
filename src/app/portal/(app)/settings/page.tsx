import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  Info,
  Shield,
  UserRound,
} from "lucide-react";
import { getPortalContext } from "@/lib/portal/queries";
import { loadSettingsContext } from "@/lib/portal/settings-actions";
import { tierLabel, formatDate } from "@/lib/portal/format";
import {
  PageHeader,
  PortalCardBody,
  PortalCardHeader,
  SectionHead,
  TypeBadge,
} from "@/components/portal/ui";
import {
  PreferencesForm,
  ProfileNameForm,
} from "@/components/portal/settings/SettingsForms";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Account Settings | AIvanza Academy",
};

export default async function SettingsPage() {
  const { profile: gateProfile } = await getPortalContext();
  if (gateProfile.status !== "active") {
    redirect("/portal");
  }

  const ctx = await loadSettingsContext();
  if (!ctx) redirect("/portal/login");

  const fullName = ctx.profile?.full_name ?? "";
  const email = ctx.user.email ?? ctx.profile?.email ?? null;
  const tier = tierLabel(ctx.profile?.tier ?? null);
  const status = ctx.profile?.status ?? "active";
  const batch =
    typeof ctx.profile?.batch === "string" && ctx.profile.batch.trim()
      ? ctx.profile.batch.trim()
      : null;
  const communities = ctx.communities ?? [];

  return (
    <>
      <PageHeader
        eyebrow="YOUR ACCOUNT"
        title="Account Settings"
        description="Manage your profile and preferences. Sign-in security lives on the Security page."
        action={
          <Link href="/portal/security" className="pt-btn pt-btn-ghost pt-btn-sm">
            <Shield size={15} aria-hidden="true" />
            Open Security
          </Link>
        }
      />

      <div className="pt-settings-layout">
        <section className="pt-panel pt-settings-card" id="profile">
          <PortalCardHeader>
            <SectionHead
              icon={UserRound}
              title="Profile"
              description="How your name appears across the student portal."
            />
          </PortalCardHeader>
          <PortalCardBody>
            <ProfileNameForm
              initialName={fullName}
              email={email}
            />
          </PortalCardBody>
        </section>

        <section className="pt-panel pt-settings-card" id="preferences">
          <PortalCardHeader>
            <SectionHead
              icon={Bell}
              title="Preferences"
              description="Choose which emails you'd like to receive. Delivery depends on academy notification setup."
            />
          </PortalCardHeader>
          <PortalCardBody>
            <PreferencesForm initial={ctx.preferences} />
          </PortalCardBody>
        </section>

        <section
          className="pt-panel pt-settings-card pt-settings-account-span"
          id="account-info"
        >
          <PortalCardHeader>
            <SectionHead
              icon={Info}
              title="Account information"
              description="Read-only details from your enrollment record. Contact support if something looks wrong."
            />
          </PortalCardHeader>
          <PortalCardBody>
            <dl className="pt-settings-dl pt-settings-dl-wide">
              <div>
                <dt>Membership tier</dt>
                <dd>
                  {tier ? (
                    <TypeBadge label={`${tier} tier`} tone="cyan" />
                  ) : (
                    "Not assigned yet"
                  )}
                </dd>
              </div>
              <div>
                <dt>Account status</dt>
                <dd style={{ textTransform: "capitalize" }}>{status}</dd>
              </div>
              <div>
                <dt>Email verification</dt>
                <dd>
                  {ctx.user.emailConfirmedAt
                    ? "Verified"
                    : "Pending verification"}
                </dd>
              </div>
              <div>
                <dt>Active courses</dt>
                <dd>{ctx.courseCount}</dd>
              </div>
              <div>
                <dt>Account created</dt>
                <dd>
                  {ctx.user.createdAt
                    ? formatDate(ctx.user.createdAt)
                    : ctx.profile?.created_at
                      ? formatDate(ctx.profile.created_at as string)
                      : "-"}
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
              {batch ? (
                <div>
                  <dt>Assigned batch</dt>
                  <dd>{batch}</dd>
                </div>
              ) : null}
              {communities.length > 0 ? (
                <div>
                  <dt>Communities</dt>
                  <dd>{communities.join(", ")}</dd>
                </div>
              ) : null}
              <div>
                <dt>Email on file</dt>
                <dd className="pt-settings-email-value">{email ?? "-"}</dd>
              </div>
            </dl>
          </PortalCardBody>
        </section>
      </div>
    </>
  );
}
