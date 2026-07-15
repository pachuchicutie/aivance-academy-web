import Link from "next/link";
import {
  Bot,
  ExternalLink,
  LifeBuoy,
  MessageSquareText,
  Ticket,
} from "lucide-react";
import { getEnrolledCourses, getPortalContext } from "@/lib/portal/queries";
import {
  listStudentSupportTickets,
  partitionTickets,
} from "@/lib/portal/support-queries";
import {
  SUPPORT_STATUS_LABELS,
  SUPPORT_STATUS_TONES,
  supportCategoryLabel,
  type SupportTicket,
} from "@/lib/portal/support";
import { formatDate } from "@/lib/portal/format";
import {
  EmptyState,
  PageHeader,
  PortalCardBody,
  PortalCardHeader,
  SectionHead,
  TypeBadge,
} from "@/components/portal/ui";
import { SupportForm } from "@/components/portal/SupportForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Support Center | AIvanza Academy",
};

function TicketRow({ ticket }: { ticket: SupportTicket }) {
  return (
    <li>
      <Link href={`/portal/support/${ticket.id}`} className="pt-ticket-link">
        <div className="pt-ticket-link-main">
          <div className="pt-ticket-link-top">
            <strong>{ticket.subject}</strong>
            {ticket.has_unread ? (
              <span className="pt-unread-pill">New reply</span>
            ) : null}
          </div>
          <span className="pt-ticket-meta">
            {ticket.reference_code ?? "Pending ref"} ·{" "}
            {supportCategoryLabel(ticket.category)} · Updated{" "}
            {formatDate(ticket.last_activity_at ?? ticket.updated_at)}
          </span>
        </div>
        <TypeBadge
          label={SUPPORT_STATUS_LABELS[ticket.status] ?? ticket.status}
          tone={SUPPORT_STATUS_TONES[ticket.status] ?? "muted"}
        />
      </Link>
    </li>
  );
}

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    subject?: string;
    category?: string;
    message?: string;
  }>;
}) {
  const params = await searchParams;
  const { tab } = params;
  const activeTab = tab === "resolved" || tab === "all" ? tab : "current";
  const formDefaults = {
    subject:
      typeof params.subject === "string" ? params.subject.slice(0, 150) : "",
    category:
      typeof params.category === "string" ? params.category.slice(0, 40) : "",
    message:
      typeof params.message === "string" ? params.message.slice(0, 5000) : "",
  };

  const { supabase, userId } = await getPortalContext();
  const [courses, tickets] = await Promise.all([
    getEnrolledCourses(supabase),
    listStudentSupportTickets(supabase, userId),
  ]);

  const parts = partitionTickets(tickets);
  const list =
    activeTab === "resolved"
      ? parts.resolved
      : activeTab === "all"
        ? parts.all
        : parts.current;

  return (
    <>
      <PageHeader
        eyebrow="We're here"
        title="Support Center"
        description="Send a request, track its progress, and review replies from the academy team."
      />

      <div className="pt-support-grid">
        <div className="pt-support-main">
          <section
            className="pt-panel"
            aria-labelledby="support-form-heading"
          >
            <PortalCardHeader>
              <SectionHead
                id="support-form-heading"
                icon={MessageSquareText}
                title="New support request"
                description="The team replies in this portal. You'll also see ticket updates listed below."
              />
            </PortalCardHeader>
            <PortalCardBody>
              <SupportForm
                courses={courses.map((c) => ({
                  id: c.course.id,
                  title: c.course.title,
                }))}
                defaults={formDefaults}
              />
            </PortalCardBody>
          </section>

          <section className="pt-panel" aria-labelledby="my-tickets-heading">
            <PortalCardHeader>
              <SectionHead
                id="my-tickets-heading"
                icon={Ticket}
                title="Your tickets"
                description="Only you can see requests submitted from your account."
              />
            </PortalCardHeader>
            <PortalCardBody>
              <div className="pt-ticket-tabs" role="tablist" aria-label="Ticket filters">
                <Link
                  href="/portal/support?tab=current"
                  className="pt-ticket-tab"
                  data-active={activeTab === "current" ? "true" : "false"}
                >
                  Current
                  <span>{parts.current.length}</span>
                </Link>
                <Link
                  href="/portal/support?tab=resolved"
                  className="pt-ticket-tab"
                  data-active={activeTab === "resolved" ? "true" : "false"}
                >
                  Resolved
                  <span>{parts.resolved.length}</span>
                </Link>
                <Link
                  href="/portal/support?tab=all"
                  className="pt-ticket-tab"
                  data-active={activeTab === "all" ? "true" : "false"}
                >
                  All
                  <span>{parts.all.length}</span>
                </Link>
              </div>

              {list.length === 0 ? (
                <EmptyState
                  icon={Ticket}
                  title={
                    activeTab === "resolved"
                      ? "No resolved requests yet"
                      : "You have no active support requests"
                  }
                  message={
                    activeTab === "resolved"
                      ? "Resolved and closed tickets will appear here."
                      : "Create a request whenever you need help from the academy team."
                  }
                  compact
                />
              ) : (
                <ul className="pt-ticket-list-links">
                  {list.map((ticket) => (
                    <TicketRow key={ticket.id} ticket={ticket} />
                  ))}
                </ul>
              )}
            </PortalCardBody>
          </section>
        </div>

        <aside className="pt-support-side" aria-label="Support channels">
          <section className="pt-panel">
            <PortalCardHeader>
              <SectionHead
                icon={Bot}
                title="AI Assistant"
                description="Instant answers about courses, schedules, and the portal."
              />
            </PortalCardHeader>
            <PortalCardBody>
              <p className="pt-assist-note">
                Open the floating chat button at the bottom-right of any portal
                page for quick guidance anytime.
              </p>
              <div className="pt-assist-actions">
                <span className="pt-badge" data-tone="cyan">
                  Available 24/7
                </span>
                <span className="pt-badge" data-tone="muted">
                  Bottom-right chat
                </span>
              </div>
            </PortalCardBody>
          </section>

          <section className="pt-panel">
            <PortalCardHeader>
              <SectionHead icon={LifeBuoy} title="Other channels" />
            </PortalCardHeader>
            <PortalCardBody>
              <ul className="pt-channel-list">
                <li>
                  <a
                    className="pt-channel-item"
                    href="https://www.facebook.com/aivanza.academy/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span
                      className="pt-channel-icon"
                      data-tone="facebook"
                      aria-hidden="true"
                    >
                      <ExternalLink size={17} />
                    </span>
                    <span className="pt-channel-copy">
                      <strong>Facebook page</strong>
                      <span>Message the academy on Facebook</span>
                    </span>
                    <ExternalLink size={14} aria-hidden="true" />
                  </a>
                </li>
                <li>
                  <a
                    className="pt-channel-item"
                    href="mailto:team@aivanzaacademy.com"
                  >
                    <span className="pt-channel-icon" aria-hidden="true">
                      <MessageSquareText size={17} />
                    </span>
                    <span className="pt-channel-copy">
                      <strong>Email support</strong>
                      <span>team@aivanzaacademy.com</span>
                    </span>
                  </a>
                </li>
              </ul>
            </PortalCardBody>
          </section>
        </aside>
      </div>
    </>
  );
}
