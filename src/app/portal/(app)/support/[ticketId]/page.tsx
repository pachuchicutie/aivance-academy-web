import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getPortalContext } from "@/lib/portal/queries";
import {
  getStudentSupportTicket,
  listTicketMessages,
} from "@/lib/portal/support-queries";
import { markSupportTicketRead } from "@/lib/portal/actions";
import {
  SUPPORT_STATUS_LABELS,
  SUPPORT_STATUS_TONES,
  supportCategoryLabel,
} from "@/lib/portal/support";
import { formatDate } from "@/lib/portal/format";
import {
  PortalCardBody,
  PortalCardHeader,
  SectionHead,
  TypeBadge,
} from "@/components/portal/ui";
import { SupportReplyForm } from "@/components/portal/SupportReplyForm";

export const dynamic = "force-dynamic";

export default async function SupportTicketDetailPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;
  const { supabase, userId } = await getPortalContext();

  const ticket = await getStudentSupportTicket(supabase, userId, ticketId);
  if (!ticket) notFound();

  // Persist read cursor so nav badges clear.
  await markSupportTicketRead(ticket.id);

  const messages = await listTicketMessages(supabase, ticket.id);

  return (
    <>
      <nav className="pt-breadcrumb" aria-label="Breadcrumb">
        <Link href="/portal/support">
          <ChevronLeft size={14} aria-hidden="true" />
          Support Center
        </Link>
      </nav>

      <section className="pt-panel">
        <PortalCardHeader>
          <div className="pt-ticket-detail-head">
            <div>
              <span className="pt-eyebrow">
                {ticket.reference_code ?? "Support ticket"}
              </span>
              <h1 className="pt-ticket-detail-title">{ticket.subject}</h1>
              <p className="pt-ticket-meta">
                {supportCategoryLabel(ticket.category)} · Opened{" "}
                {formatDate(ticket.created_at)} · Updated{" "}
                {formatDate(ticket.last_activity_at ?? ticket.updated_at)}
              </p>
            </div>
            <TypeBadge
              label={SUPPORT_STATUS_LABELS[ticket.status] ?? ticket.status}
              tone={SUPPORT_STATUS_TONES[ticket.status] ?? "muted"}
            />
          </div>
        </PortalCardHeader>
        <PortalCardBody>
          <div className="pt-thread" aria-label="Conversation">
            {messages.length === 0 ? (
              <article className="pt-thread-msg" data-role="student">
                <header>
                  <strong>You</strong>
                  <time dateTime={ticket.created_at}>
                    {formatDate(ticket.created_at)}
                  </time>
                </header>
                <p>{ticket.message}</p>
              </article>
            ) : (
              messages.map((msg) => (
                <article
                  key={msg.id}
                  className="pt-thread-msg"
                  data-role={msg.author_role}
                >
                  <header>
                    <strong>
                      {msg.author_role === "student"
                        ? "You"
                        : msg.author_name || "Academy team"}
                    </strong>
                    <time dateTime={msg.created_at}>
                      {formatDate(msg.created_at)}
                    </time>
                  </header>
                  <p>{msg.body}</p>
                </article>
              ))
            )}
          </div>
        </PortalCardBody>
      </section>

      <section className="pt-panel">
        <PortalCardHeader>
          <SectionHead
            title="Reply"
            description={
              ticket.status === "closed"
                ? "This conversation is closed."
                : ticket.status === "resolved"
                  ? "Resolved. Reply if this did not solve your issue and we'll reopen it."
                  : "Add details or answer questions from the academy team."
            }
          />
        </PortalCardHeader>
        <PortalCardBody>
          <SupportReplyForm
            ticketId={ticket.id}
            closed={ticket.status === "closed"}
          />
        </PortalCardBody>
      </section>
    </>
  );
}
