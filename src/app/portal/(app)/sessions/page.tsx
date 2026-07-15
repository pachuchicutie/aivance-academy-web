import { CalendarDays, Video } from "lucide-react";
import { getAllSessions, getPortalContext } from "@/lib/portal/queries";
import {
  formatSessionDate,
  formatSessionDay,
  formatSessionTime,
  getSessionLiveState,
  sessionTypeLabel,
} from "@/lib/portal/format";
import { EmptyState, PageHeader, TypeBadge } from "@/components/portal/ui";
import type { PortalLiveSession } from "@/lib/portal/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Live Sessions | AIvanza Academy",
};

function SessionRow({ session }: { session: PortalLiveSession }) {
  const state = getSessionLiveState(session);
  const day = formatSessionDay(session.starts_at);
  const cancelled = session.status === "cancelled";
  const finished = session.status === "completed" || state === "ended";
  const joinable =
    !cancelled &&
    !finished &&
    Boolean(session.meeting_url) &&
    (state === "live" || state === "starting_soon");

  return (
    <article
      className="pt-session-card pt-session-card-wide"
      data-past={finished || cancelled ? "true" : "false"}
    >
      <div className="pt-session-date" aria-hidden="true">
        <small>{day.month}</small>
        <strong>{day.day}</strong>
      </div>
      <div className="pt-session-copy">
        <div className="pt-session-title-row">
          <h3>{session.title}</h3>
          {cancelled ? (
            <TypeBadge label="Cancelled" tone="danger" />
          ) : state === "live" ? (
            <TypeBadge label="Live now" tone="success" />
          ) : state === "starting_soon" ? (
            <TypeBadge label="Starting soon" tone="gold" />
          ) : finished ? (
            <TypeBadge label="Completed" tone="muted" />
          ) : (
            <TypeBadge label="Upcoming" tone="cyan" />
          )}
        </div>
        <p>
          {sessionTypeLabel(session.session_type)}
          {session.mentor_name ? ` · With ${session.mentor_name}` : ""}
        </p>
        <p className="pt-session-time">
          {formatSessionDate(session.starts_at)} ·{" "}
          {formatSessionTime(session.starts_at)} PHT ·{" "}
          {session.duration_minutes} min
        </p>
        {session.description ? (
          <p className="pt-session-desc">{session.description}</p>
        ) : null}
        {joinable && session.meeting_url ? (
          <a
            className="pt-btn pt-btn-primary pt-btn-sm"
            href={session.meeting_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Video size={15} aria-hidden="true" />
            Join session
          </a>
        ) : null}
      </div>
    </article>
  );
}

export default async function LiveSessionsPage() {
  const { supabase } = await getPortalContext();
  const { upcoming, past } = await getAllSessions(supabase);

  return (
    <>
      <PageHeader
        eyebrow="Schedule"
        title="Live Sessions"
        description="Class schedules, Q&As, and workshops for your enrollment. Times are shown in Philippine Time (PHT)."
      />

      <section className="pt-panel">
        <h2 className="pt-panel-title">Upcoming</h2>
        <div className="pt-panel-body">
          {upcoming.length > 0 ? (
            <div className="pt-session-stack">
              {upcoming.map((session) => (
                <SessionRow key={session.id} session={session} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CalendarDays}
              message="No live session is currently scheduled."
              compact
            />
          )}
        </div>
      </section>

      {past.length > 0 ? (
        <section className="pt-panel">
          <h2 className="pt-panel-title">Past sessions</h2>
          <div className="pt-panel-body">
            <div className="pt-session-stack">
              {past.slice(0, 10).map((session) => (
                <SessionRow key={session.id} session={session} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
