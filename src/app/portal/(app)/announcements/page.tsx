import Link from "next/link";
import { BellRing } from "lucide-react";
import { getAnnouncements, getPortalContext } from "@/lib/portal/queries";
import { formatDate } from "@/lib/portal/format";
import { EmptyState, PageHeader, TypeBadge } from "@/components/portal/ui";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Announcements | AIvanza Academy",
};

const TONES = {
  general: "muted",
  update: "cyan",
  event: "violet",
  reminder: "gold",
} as const;

function excerpt(body: string | null, max = 140) {
  if (!body) return null;
  const text = body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export default async function AnnouncementsPage() {
  const { supabase } = await getPortalContext();
  const announcements = await getAnnouncements(supabase, 50);

  return (
    <>
      <PageHeader
        eyebrow="Updates"
        title="Announcements"
        description="Class updates, schedules, and academy news for your enrollment."
      />

      {announcements.length === 0 ? (
        <EmptyState
          icon={BellRing}
          title="All caught up"
          message="You're all caught up. New academy updates will appear here."
        />
      ) : (
        <section className="pt-panel pt-panel-padded">
          <ul className="pt-ann-list pt-ann-list-page">
            {announcements.map((a) => {
              const preview = excerpt(a.body);
              return (
                <li key={a.id}>
                  <Link
                    href={`/portal/announcements/${a.id}`}
                    className="pt-ann-item"
                    data-unread={a.read ? "false" : "true"}
                  >
                    <TypeBadge
                      label={a.type === "general" ? "News" : a.type}
                      tone={TONES[a.type]}
                    />
                    <span className="pt-ann-copy">
                      <strong>
                        {a.title}
                        {!a.read ? (
                          <span className="pt-unread-dot" aria-label=" (unread)" />
                        ) : null}
                      </strong>
                      {preview ? <span>{preview}</span> : null}
                      <span className="pt-ann-date">
                        {formatDate(a.published_at ?? a.created_at)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
