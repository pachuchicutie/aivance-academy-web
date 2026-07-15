import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isActiveSupportStatus,
  type SupportMessage,
  type SupportTicket,
  type SupportTicketStatus,
} from "./support";

type TicketRow = Omit<SupportTicket, "has_unread" | "status"> & {
  status: string;
};

function mapTicket(
  row: TicketRow,
  unread = false
): SupportTicket {
  return {
    ...row,
    status: row.status as SupportTicketStatus,
    has_unread: unread,
  };
}

export async function listStudentSupportTickets(
  supabase: SupabaseClient,
  userId: string
): Promise<SupportTicket[]> {
  const { data, error } = await supabase
    .from("support_requests")
    .select(
      "id, reference_code, subject, category, message, status, course_id, created_at, updated_at, last_activity_at, student_last_read_at, resolved_at, closed_at"
    )
    .eq("user_id", userId)
    .order("last_activity_at", { ascending: false });

  if (error) {
    console.error("listStudentSupportTickets", error.message);
    return [];
  }

  const tickets = (data ?? []) as TicketRow[];
  if (tickets.length === 0) return [];

  const ids = tickets.map((t) => t.id);
  const { data: msgs } = await supabase
    .from("support_messages")
    .select("ticket_id, author_role, created_at, is_internal")
    .in("ticket_id", ids)
    .eq("is_internal", false)
    .in("author_role", ["admin", "support_agent", "system"]);

  const latestAdminByTicket = new Map<string, string>();
  for (const m of msgs ?? []) {
    const prev = latestAdminByTicket.get(m.ticket_id);
    if (!prev || m.created_at > prev) {
      latestAdminByTicket.set(m.ticket_id, m.created_at);
    }
  }

  return tickets.map((t) => {
    const lastAdmin = latestAdminByTicket.get(t.id);
    const unread = Boolean(
      lastAdmin &&
        (!t.student_last_read_at || lastAdmin > t.student_last_read_at)
    );
    return mapTicket(t, unread);
  });
}

export async function getStudentSupportTicket(
  supabase: SupabaseClient,
  userId: string,
  ticketId: string
): Promise<SupportTicket | null> {
  const { data, error } = await supabase
    .from("support_requests")
    .select(
      "id, reference_code, subject, category, message, status, course_id, created_at, updated_at, last_activity_at, student_last_read_at, resolved_at, closed_at"
    )
    .eq("id", ticketId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return mapTicket(data as TicketRow);
}

export async function listTicketMessages(
  supabase: SupabaseClient,
  ticketId: string
): Promise<SupportMessage[]> {
  const { data, error } = await supabase
    .from("support_messages")
    .select("id, ticket_id, author_id, author_role, body, is_internal, created_at")
    .eq("ticket_id", ticketId)
    .eq("is_internal", false)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("listTicketMessages", error.message);
    return [];
  }

  const rows = (data ?? []) as SupportMessage[];
  const authorIds = [
    ...new Set(rows.map((r) => r.author_id).filter(Boolean) as string[]),
  ];

  if (authorIds.length === 0) return rows;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", authorIds);

  const nameById = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      (p.full_name as string | null) ||
        (p.email as string | null) ||
        "Academy team",
    ])
  );

  return rows.map((r) => ({
    ...r,
    author_name:
      r.author_role === "student"
        ? nameById.get(r.author_id ?? "") ?? "You"
        : r.author_role === "system"
          ? "System"
          : nameById.get(r.author_id ?? "") ?? "Academy team",
  }));
}

export async function getStudentSupportUnreadCount(
  supabase: SupabaseClient
): Promise<number> {
  const { data, error } = await supabase.rpc("student_support_unread_count");
  if (error) {
    console.error("student_support_unread_count", error.message);
    return 0;
  }
  return Number(data ?? 0) || 0;
}

export function partitionTickets(tickets: SupportTicket[]) {
  const current = tickets.filter((t) => isActiveSupportStatus(t.status));
  const waiting = tickets.filter((t) => t.status === "waiting_for_student");
  const resolved = tickets.filter(
    (t) => t.status === "resolved" || t.status === "closed"
  );
  return { current, waiting, resolved, all: tickets };
}
