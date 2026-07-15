import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getAnnouncement, getPortalContext } from "@/lib/portal/queries";
import { markAnnouncementRead } from "@/lib/portal/actions";
import { formatDate } from "@/lib/portal/format";
import { isEmptyHtml, sanitizeHtml } from "@/lib/portal/sanitize";
import { TypeBadge } from "@/components/portal/ui";

export const dynamic = "force-dynamic";

const TONES = {
  general: "muted",
  update: "cyan",
  event: "violet",
  reminder: "gold",
} as const;

export default async function AnnouncementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await getPortalContext();
  const announcement = await getAnnouncement(supabase, id);

  if (!announcement) {
    notFound();
  }

  if (!announcement.read) {
    // Server-side read receipt; RLS restricts the row to the current user.
    await markAnnouncementRead(announcement.id);
  }

  const body = sanitizeHtml(announcement.body);

  return (
    <>
      <nav className="pt-breadcrumb" aria-label="Breadcrumb">
        <Link href="/portal/announcements">
          <ChevronLeft size={14} aria-hidden="true" />
          Announcements
        </Link>
      </nav>

      <article className="pt-panel pt-panel-padded pt-article">
        <header className="pt-article-header">
          <TypeBadge
            label={
              announcement.type === "general" ? "News" : announcement.type
            }
            tone={TONES[announcement.type]}
          />
          <h1>{announcement.title}</h1>
          <p className="pt-article-date">
            {formatDate(announcement.published_at ?? announcement.created_at)}
          </p>
        </header>

        {!isEmptyHtml(body) ? (
          <div
            className="pt-lesson-content"
            dangerouslySetInnerHTML={{ __html: body }}
          />
        ) : (
          <p className="pt-lesson-placeholder">
            This announcement has no additional details.
          </p>
        )}
      </article>
    </>
  );
}
