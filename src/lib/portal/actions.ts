"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerUserClient } from "@/lib/supabase/server";
import { studentHasActiveCourseAccess } from "@/lib/portal/queries";
import { isValidSupportCategory } from "@/lib/portal/support";

export type ActionResult = { ok: true } | { ok: false; message: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Refresh every surface that shows course / module progress. */
function revalidateCoursePaths(courseSlug: string) {
  revalidatePath("/portal");
  revalidatePath("/portal", "layout");
  revalidatePath("/portal/courses");
  revalidatePath(`/portal/courses/${courseSlug}`);
  revalidatePath(`/portal/courses/${courseSlug}`, "layout");
  revalidatePath(`/portal/courses/${courseSlug}/lessons`, "layout");
}

/**
 * Marks a lesson complete for the signed-in student. RLS is the enforcement
 * layer: the insert policy requires user_id = auth.uid() AND
 * can_access_lesson(auth.uid(), lesson_id), so unauthorized or unpublished
 * lessons are rejected by the database, not just the UI.
 */
export async function markLessonComplete(
  lessonId: string,
  courseSlug: string
): Promise<ActionResult> {
  if (!UUID_RE.test(lessonId)) {
    return { ok: false, message: "Invalid lesson." };
  }

  const supabase = await createSupabaseServerUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Please sign in again." };
  }

  const { error } = await supabase.from("lesson_progress").insert({
    user_id: user.id,
    lesson_id: lessonId,
  });

  // 23505 = already recorded; treat as success so the action is idempotent.
  if (error && error.code !== "23505") {
    return {
      ok: false,
      message: "We couldn't save your progress. Please try again.",
    };
  }

  revalidateCoursePaths(courseSlug);
  return { ok: true };
}

/** Removes a completion record (lets students un-mark a lesson). */
export async function unmarkLessonComplete(
  lessonId: string,
  courseSlug: string
): Promise<ActionResult> {
  if (!UUID_RE.test(lessonId)) {
    return { ok: false, message: "Invalid lesson." };
  }

  const supabase = await createSupabaseServerUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Please sign in again." };
  }

  const { error } = await supabase
    .from("lesson_progress")
    .delete()
    .eq("user_id", user.id)
    .eq("lesson_id", lessonId);

  if (error) {
    return {
      ok: false,
      message: "We couldn't update your progress. Please try again.",
    };
  }

  revalidateCoursePaths(courseSlug);
  return { ok: true };
}

/** Records that the signed-in student has read an announcement. */
export async function markAnnouncementRead(
  announcementId: string
): Promise<ActionResult> {
  if (!UUID_RE.test(announcementId)) {
    return { ok: false, message: "Invalid announcement." };
  }

  const supabase = await createSupabaseServerUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Please sign in again." };
  }

  const { error } = await supabase.from("announcement_reads").insert({
    user_id: user.id,
    announcement_id: announcementId,
  });

  if (error && error.code !== "23505") {
    return { ok: false, message: "Could not update read state." };
  }

  revalidatePath("/portal", "layout");
  return { ok: true };
}

export type SupportFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  ticketId?: string;
  referenceCode?: string;
};

/**
 * Submits a support request + first conversation message.
 * Rate limit: max 5 tickets per student per rolling 24h.
 */
export async function submitSupportRequest(
  _prev: SupportFormState,
  formData: FormData
): Promise<SupportFormState> {
  const subject = String(formData.get("subject") ?? "").trim();
  const category = String(formData.get("category") ?? "general").trim();
  const message = String(formData.get("message") ?? "").trim();
  const courseId = String(formData.get("course_id") ?? "").trim();

  if (subject.length < 5 || subject.length > 150) {
    return {
      status: "error",
      message: "Please add a short subject (5–150 characters).",
    };
  }
  if (!isValidSupportCategory(category)) {
    return { status: "error", message: "Please pick a valid category." };
  }
  if (message.length < 10 || message.length > 5000) {
    return {
      status: "error",
      message: "Please describe your request (10–5000 characters).",
    };
  }
  if (courseId && !UUID_RE.test(courseId)) {
    return { status: "error", message: "Invalid course reference." };
  }

  const supabase = await createSupabaseServerUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "error", message: "Please sign in again." };
  }

  if (courseId) {
    // Same access rules as Courses page / Support dropdown (RLS-scoped).
    const linked = await studentHasActiveCourseAccess(supabase, courseId);
    if (!linked) {
      return {
        status: "error",
        message: "That course is not linked to your account.",
      };
    }
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("support_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);

  if ((count ?? 0) >= 5) {
    return {
      status: "error",
      message:
        "You've reached today's limit for support requests. The team is reviewing your earlier messages.",
    };
  }

  const { data: ticket, error } = await supabase
    .from("support_requests")
    .insert({
      user_id: user.id,
      subject,
      category,
      message,
      course_id: courseId || null,
      status: "open",
      priority: "normal",
    })
    .select("id, reference_code")
    .single();

  if (error || !ticket) {
    console.error("submitSupportRequest insert", error?.message, error?.code);
    return {
      status: "error",
      message: "We couldn't send your request right now. Please try again.",
    };
  }

  const { error: msgError } = await supabase.from("support_messages").insert({
    ticket_id: ticket.id,
    author_id: user.id,
    author_role: "student",
    body: message,
    is_internal: false,
  });

  if (msgError) {
    // Ticket row exists; message seed failed — still treat as submitted.
    console.error("submitSupportRequest message", msgError.message);
  }

  revalidatePath("/portal/support");
  revalidatePath("/portal", "layout");
  return {
    status: "success",
    message:
      "Your support request has been submitted. Our academy team will review it and reply here.",
    ticketId: ticket.id as string,
    referenceCode: (ticket.reference_code as string | null) ?? undefined,
  };
}

export type SupportReplyState = {
  status: "idle" | "success" | "error";
  message?: string;
};

/** Student public reply on an owned ticket. */
export async function replyToSupportTicket(
  _prev: SupportReplyState,
  formData: FormData
): Promise<SupportReplyState> {
  const ticketId = String(formData.get("ticket_id") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!UUID_RE.test(ticketId)) {
    return { status: "error", message: "Invalid ticket." };
  }
  if (body.length < 1 || body.length > 5000) {
    return {
      status: "error",
      message: "Please enter a reply (1–5000 characters).",
    };
  }

  const supabase = await createSupabaseServerUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", message: "Please sign in again." };
  }

  const { data: ticket } = await supabase
    .from("support_requests")
    .select("id, status, user_id")
    .eq("id", ticketId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!ticket) {
    return { status: "error", message: "Ticket not found." };
  }
  if (ticket.status === "closed") {
    return {
      status: "error",
      message: "This ticket is closed and cannot accept new replies.",
    };
  }

  const { error } = await supabase.from("support_messages").insert({
    ticket_id: ticketId,
    author_id: user.id,
    author_role: "student",
    body,
    is_internal: false,
  });

  if (error) {
    console.error("replyToSupportTicket", error.message);
    return {
      status: "error",
      message: "We couldn't post your reply. Please try again.",
    };
  }

  await supabase.rpc("mark_support_ticket_read", { p_ticket_id: ticketId });

  revalidatePath("/portal/support");
  revalidatePath(`/portal/support/${ticketId}`);
  revalidatePath("/portal", "layout");
  return { status: "success", message: "Your reply was sent." };
}

export async function markSupportTicketRead(
  ticketId: string
): Promise<ActionResult> {
  if (!UUID_RE.test(ticketId)) {
    return { ok: false, message: "Invalid ticket." };
  }
  const supabase = await createSupabaseServerUserClient();
  const { error } = await supabase.rpc("mark_support_ticket_read", {
    p_ticket_id: ticketId,
  });
  if (error) {
    console.error("markSupportTicketRead", error.message);
    return { ok: false, message: "Could not update read state." };
  }
  revalidatePath("/portal/support");
  revalidatePath(`/portal/support/${ticketId}`);
  revalidatePath("/portal", "layout");
  return { ok: true };
}
