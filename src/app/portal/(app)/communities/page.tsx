import { ExternalLink, Users } from "lucide-react";
import { getCommunities, getPortalContext } from "@/lib/portal/queries";
import { EmptyState, PageHeader, TypeBadge } from "@/components/portal/ui";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Communities | AIvanza Academy",
};

const PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook Group",
  messenger: "Messenger",
  discord: "Discord",
  whatsapp: "WhatsApp",
  other: "Community",
};

export default async function CommunitiesPage() {
  const { supabase } = await getPortalContext();
  const communities = await getCommunities(supabase);

  return (
    <>
      <PageHeader
        eyebrow="Together"
        title="Communities"
        description="Your batchmates, mentors, and study groups | connect, collaborate, and grow together."
      />

      {communities.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No community yet"
          message="You haven't been assigned to a learning community yet."
          action={{ href: "/portal/support", label: "Ask the team" }}
        />
      ) : (
        <div className="pt-community-grid">
          {communities.map((community) => (
            <article key={community.id} className="pt-community-card">
              <div className="pt-community-card-head">
                <span className="pt-community-avatar" aria-hidden="true">
                  <Users size={18} />
                </span>
                <TypeBadge
                  label={PLATFORM_LABELS[community.platform] ?? "Community"}
                  tone="teal"
                />
              </div>
              <h2>{community.name}</h2>
              {community.description ? <p>{community.description}</p> : null}
              {community.mentor_name ? (
                <p className="pt-community-mentor">
                  Mentor: {community.mentor_name}
                </p>
              ) : null}
              {community.external_url ? (
                <a
                  href={community.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pt-btn pt-btn-primary pt-btn-sm"
                >
                  Open community
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              ) : (
                <p className="pt-community-note">
                  Access details will be shared by your mentor.
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
