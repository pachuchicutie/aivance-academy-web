import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  BookOpen,
  CalendarDays,
  ExternalLink,
  GraduationCap,
  LifeBuoy,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  getAnnouncements,
  getCommunities,
  getEnrolledCourses,
  getPortalContext,
  getUpcomingSessions,
} from "@/lib/portal/queries";
import { aggregateEnrolledCourseProgress } from "@/lib/portal/progress";
import {
  firstName,
  formatSessionDay,
  formatSessionTime,
  formatDate,
  getSessionLiveState,
  sessionTypeLabel,
} from "@/lib/portal/format";
import {
  CourseProgressCard,
} from "@/components/portal/CourseProgressCard";
import {
  EmptyState,
  PortalCardBody,
  PortalCardHeader,
  SectionHead,
  TypeBadge,
} from "@/components/portal/ui";

export const dynamic = "force-dynamic";

const ANNOUNCEMENT_TONES = {
  general: "muted",
  update: "cyan",
  event: "violet",
  reminder: "gold",
} as const;

function HeroVisual() {
  return (
    <svg
      className="pt-hero-visual"
      viewBox="0 0 300 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="pt-hero-glow" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="rgba(56,189,248,0.35)" />
          <stop offset="60%" stopColor="rgba(56,189,248,0.08)" />
          <stop offset="100%" stopColor="rgba(56,189,248,0)" />
        </radialGradient>
        <linearGradient id="pt-hero-cap" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <circle cx="150" cy="86" r="82" fill="url(#pt-hero-glow)" />
      <g stroke="rgba(125,180,255,0.35)" strokeWidth="1">
        <line x1="52" y1="120" x2="106" y2="70" />
        <line x1="106" y1="70" x2="150" y2="106" />
        <line x1="150" y1="106" x2="204" y2="58" />
        <line x1="204" y1="58" x2="252" y2="112" />
        <line x1="106" y1="70" x2="204" y2="58" />
      </g>
      <g fill="#7dd3fc">
        <circle cx="52" cy="120" r="3.5" opacity="0.8" />
        <circle cx="106" cy="70" r="4" />
        <circle cx="204" cy="58" r="4" />
        <circle cx="252" cy="112" r="3.5" opacity="0.8" />
      </g>
      <g transform="translate(118 74)">
        <ellipse cx="32" cy="52" rx="42" ry="9" fill="rgba(59,130,246,0.25)" />
        <path
          d="M32 18 66 32 32 46 -2 32Z"
          fill="url(#pt-hero-cap)"
          opacity="0.95"
        />
        <path
          d="M14 38v12c0 4.4 8 8 18 8s18-3.6 18-8V38l-18 7.6L14 38Z"
          fill="#1d4ed8"
          opacity="0.9"
        />
        <path d="M66 32v16" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" />
        <circle cx="66" cy="50" r="2.6" fill="#facc15" />
      </g>
    </svg>
  );
}

export default async function PortalDashboardPage() {
  const { supabase, profile } = await getPortalContext();

  const [courses, sessions, announcements, communities] = await Promise.all([
    getEnrolledCourses(supabase),
    getUpcomingSessions(supabase, 2),
    getAnnouncements(supabase, 3),
    getCommunities(supabase),
  ]);

  // Module-weighted progress across all enrolled accessible courses only.
  const overall = aggregateEnrolledCourseProgress(courses);
  const overallPercent = overall.overallProgressPercentage;
  const activeEnrolledCount = courses.filter(
    (c) =>
      !(
        c.progress.totalCourseModules > 0 &&
        c.progress.completedCourseModules >= c.progress.totalCourseModules &&
        c.progress.overallCourseProgressExact >= 99.5
      )
  ).length;
  const unread = announcements.filter((a) => !a.read).length;
  const name = firstName(profile.full_name);
  const featured = courses.slice(0, 3);
  const nextSession = sessions[0] ?? null;

  return (
    <>
      <section className="pt-hero" aria-label="Welcome">
        {/* Padded content shell — inset lives here, not on bare text nodes */}
        <div className="pt-hero-inner">
          <div className="pt-hero-copy">
            <span className="pt-eyebrow">Welcome back,</span>
            <h1>
              {name ?? "Welcome back"} <span aria-hidden="true">👋</span>
            </h1>
            <p>Continue building the skills that move your career forward.</p>
          </div>
          <div className="pt-hero-art" aria-hidden="true">
            <HeroVisual />
          </div>
        </div>
      </section>

      <section className="pt-summary-grid" aria-label="Learning summary">
        <Link href="/portal/courses" className="pt-summary-card">
          <span className="pt-summary-icon" data-tone="cyan" aria-hidden="true">
            <BookOpen size={19} />
          </span>
          <span className="pt-summary-copy">
            <small>Active courses</small>
            <strong>{activeEnrolledCount}</strong>
            <span>
              {activeEnrolledCount > 0
                ? "Enrolled and in progress"
                : courses.length > 0
                  ? "All enrolled courses completed"
                  : "Appears after payment confirmation"}
            </span>
          </span>
          <ArrowRight size={15} className="pt-summary-arrow" aria-hidden="true" />
        </Link>

        <Link href="/portal/announcements" className="pt-summary-card">
          <span className="pt-summary-icon" data-tone="violet" aria-hidden="true">
            <BellRing size={19} />
          </span>
          <span className="pt-summary-copy">
            <small>Announcements</small>
            <strong>{unread}</strong>
            <span>{unread === 1 ? "New update" : "New updates"}</span>
          </span>
          <ArrowRight size={15} className="pt-summary-arrow" aria-hidden="true" />
        </Link>

        <Link href="/portal/communities" className="pt-summary-card">
          <span className="pt-summary-icon" data-tone="teal" aria-hidden="true">
            <Users size={19} />
          </span>
          <span className="pt-summary-copy">
            <small>Communities</small>
            <strong>{communities.length}</strong>
            <span>
              {communities.length > 0 ? "Active groups" : "No group assigned yet"}
            </span>
          </span>
          <ArrowRight size={15} className="pt-summary-arrow" aria-hidden="true" />
        </Link>

        <div className="pt-summary-card pt-summary-card-static">
          <span className="pt-summary-icon" data-tone="gold" aria-hidden="true">
            <TrendingUp size={19} />
          </span>
          <span className="pt-summary-copy">
            <small>Overall progress</small>
            <strong>{overallPercent}%</strong>
            <span>
              {overall.contentPending || overall.totalModules === 0
                ? "Across enrolled courses"
                : `${overall.completedModules} of ${overall.totalModules} modules completed${
                    overall.completedLessons > 0
                      ? ` · ${overall.completedLessons} lesson${
                          overall.completedLessons === 1 ? "" : "s"
                        } completed`
                      : ""
                  }`}
            </span>
          </span>
        </div>
      </section>

      <div className="pt-dash-grid">
        <div className="pt-dash-main">
          <section className="pt-panel" aria-labelledby="continue-learning">
            <PortalCardHeader>
              <SectionHead
                id="continue-learning"
                icon={GraduationCap}
                title="Continue Learning"
                description="Pick up where you left off."
                action={
                  courses.length > 3
                    ? { href: "/portal/courses", label: "View all courses" }
                    : undefined
                }
              />
            </PortalCardHeader>
            <PortalCardBody>
              {featured.length > 0 ? (
                <div className="pt-course-list">
                  {featured.map((course) => (
                    <CourseProgressCard
                      key={course.enrollmentId}
                      course={course}
                      featured={featured.length === 1}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={BookOpen}
                  title="No active course yet"
                  message="Your course will appear here after your payment and access are confirmed."
                  action={{ href: "/portal/support", label: "Contact support" }}
                  compact
                />
              )}
              {featured.length > 0 ? (
                <p className="pt-motivation">
                  <Sparkles size={14} aria-hidden="true" />
                  Keep going! Consistency today, mastery tomorrow.
                </p>
              ) : null}
            </PortalCardBody>
          </section>

          <section className="pt-panel" aria-labelledby="my-communities">
            <PortalCardHeader>
              <SectionHead
                id="my-communities"
                icon={Users}
                title="My Communities"
                description="Connect, collaborate, and grow together."
                action={
                  communities.length > 3
                    ? { href: "/portal/communities", label: "View all" }
                    : undefined
                }
              />
            </PortalCardHeader>
            <PortalCardBody>
              {communities.length > 0 ? (
                <div className="pt-community-row">
                  {communities.slice(0, 3).map((community) =>
                    community.external_url ? (
                      <a
                        key={community.id}
                        className="pt-community-chip"
                        href={community.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <span className="pt-community-avatar" aria-hidden="true">
                          <Users size={16} />
                        </span>
                        <span className="pt-community-copy">
                          <strong>{community.name}</strong>
                          <span>
                            <span className="pt-dot pt-dot-live" aria-hidden="true" />
                            Active
                          </span>
                        </span>
                        <ExternalLink size={13} aria-hidden="true" />
                      </a>
                    ) : (
                      <Link
                        key={community.id}
                        className="pt-community-chip"
                        href="/portal/communities"
                      >
                        <span className="pt-community-avatar" aria-hidden="true">
                          <Users size={16} />
                        </span>
                        <span className="pt-community-copy">
                          <strong>{community.name}</strong>
                          <span>
                            <span className="pt-dot pt-dot-live" aria-hidden="true" />
                            Active
                          </span>
                        </span>
                      </Link>
                    )
                  )}
                </div>
              ) : (
                <EmptyState
                  icon={Users}
                  title="No community yet"
                  message="You haven't been assigned to a learning community yet."
                  compact
                />
              )}
            </PortalCardBody>
          </section>
        </div>

        <div className="pt-dash-side">
          <section className="pt-panel" aria-labelledby="upcoming-sessions">
            <PortalCardHeader>
              <SectionHead
                id="upcoming-sessions"
                icon={CalendarDays}
                title="Upcoming Live Sessions"
                action={{ href: "/portal/sessions", label: "View schedule" }}
              />
            </PortalCardHeader>
            <PortalCardBody>
              {nextSession ? (
                <div className="pt-session-stack">
                  {sessions.map((session) => {
                    const state = getSessionLiveState(session);
                    const day = formatSessionDay(session.starts_at);
                    return (
                      <article key={session.id} className="pt-session-card">
                        <div className="pt-session-date" aria-hidden="true">
                          <small>{day.month}</small>
                          <strong>{day.day}</strong>
                        </div>
                        <div className="pt-session-copy">
                          <div className="pt-session-title-row">
                            <h3>{session.title}</h3>
                            {state === "live" ? (
                              <TypeBadge label="Live" tone="success" />
                            ) : state === "starting_soon" ? (
                              <TypeBadge label="Starting soon" tone="gold" />
                            ) : null}
                          </div>
                          {session.mentor_name ? (
                            <p>With {session.mentor_name}</p>
                          ) : (
                            <p>{sessionTypeLabel(session.session_type)}</p>
                          )}
                          <p className="pt-session-time">
                            {formatSessionTime(session.starts_at)} PHT ·{" "}
                            {session.duration_minutes} min
                          </p>
                          {session.meeting_url &&
                          (state === "live" || state === "starting_soon") ? (
                            <a
                              className="pt-btn pt-btn-primary pt-btn-xs"
                              href={session.meeting_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Join session
                            </a>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={CalendarDays}
                  title="No sessions scheduled"
                  message="No live session is currently scheduled. Check back soon."
                  compact
                />
              )}
            </PortalCardBody>
          </section>

          <section className="pt-panel" aria-labelledby="recent-announcements">
            <PortalCardHeader>
              <SectionHead
                id="recent-announcements"
                icon={BellRing}
                title="Recent Announcements"
                action={{ href: "/portal/announcements", label: "View all" }}
              />
            </PortalCardHeader>
            <PortalCardBody>
              {announcements.length > 0 ? (
                <ul className="pt-ann-list">
                  {announcements.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`/portal/announcements/${a.id}`}
                        className="pt-ann-item"
                        data-unread={a.read ? "false" : "true"}
                      >
                        <TypeBadge
                          label={a.type === "general" ? "News" : a.type}
                          tone={ANNOUNCEMENT_TONES[a.type]}
                        />
                        <span className="pt-ann-copy">
                          <strong>{a.title}</strong>
                          <span>
                            {formatDate(a.published_at ?? a.created_at)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={BellRing}
                  title="You're all caught up"
                  message="New academy updates will appear here."
                  compact
                />
              )}
            </PortalCardBody>
          </section>

          <section className="pt-panel pt-help-panel" aria-labelledby="need-help">
            <PortalCardHeader>
              <SectionHead
                id="need-help"
                icon={LifeBuoy}
                title="Need Help?"
                description="We're here to support your learning journey."
              />
            </PortalCardHeader>
            <PortalCardBody>
              <div className="pt-help-links">
                <Link href="/portal/support" className="pt-help-link">
                  <span className="pt-summary-icon" data-tone="cyan" aria-hidden="true">
                    <LifeBuoy size={18} />
                  </span>
                  <span className="pt-help-copy">
                    <strong>Contact Support</strong>
                    <span>Send a request to the academy team</span>
                  </span>
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
                <div className="pt-help-link pt-help-link-static">
                  <span className="pt-summary-icon" data-tone="violet" aria-hidden="true">
                    <Sparkles size={18} />
                  </span>
                  <span className="pt-help-copy">
                    <strong>AI Assistant</strong>
                    <span>Use the chat button at the bottom-right anytime</span>
                  </span>
                </div>
              </div>
            </PortalCardBody>
          </section>
        </div>
      </div>
    </>
  );
}
