export const SUPPORT_CATEGORIES = [
  { value: "general", label: "General" },
  { value: "account", label: "Account Access" },
  { value: "course_access", label: "Course Access" },
  { value: "payment", label: "Payment or Enrollment" },
  { value: "content", label: "Lesson or Course Content" },
  { value: "live_session", label: "Live Session" },
  { value: "technical", label: "Technical Issue" },
  { value: "community", label: "Community" },
  { value: "ai_assistant", label: "AI Assistant" },
  { value: "other", label: "Other" },
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]["value"];

export const SUPPORT_CATEGORY_VALUES = new Set(
  SUPPORT_CATEGORIES.map((c) => c.value)
);

/** Accept legacy category values still present in older rows. */
export function isValidSupportCategory(value: string) {
  return SUPPORT_CATEGORY_VALUES.has(value as SupportCategory) || value === "course";
}

export type SupportTicketStatus =
  | "open"
  | "in_progress"
  | "waiting_for_student"
  | "resolved"
  | "closed";

export const SUPPORT_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  waiting_for_student: "Waiting for You",
  resolved: "Resolved",
  closed: "Closed",
};

export const SUPPORT_STATUS_TONES: Record<
  SupportTicketStatus,
  "cyan" | "gold" | "violet" | "success" | "muted"
> = {
  open: "cyan",
  in_progress: "gold",
  waiting_for_student: "violet",
  resolved: "success",
  closed: "muted",
};

export function supportCategoryLabel(value: string) {
  const hit = SUPPORT_CATEGORIES.find((c) => c.value === value);
  if (hit) return hit.label;
  if (value === "course") return "Course content";
  return value;
}

export function isActiveSupportStatus(status: string) {
  return (
    status === "open" ||
    status === "in_progress" ||
    status === "waiting_for_student"
  );
}

export type SupportTicket = {
  id: string;
  reference_code: string | null;
  subject: string;
  category: string;
  message: string;
  status: SupportTicketStatus;
  course_id: string | null;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  student_last_read_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  has_unread?: boolean;
};

export type SupportMessage = {
  id: string;
  ticket_id: string;
  author_id: string | null;
  author_role: "student" | "admin" | "support_agent" | "system";
  body: string;
  is_internal: boolean;
  created_at: string;
  author_name?: string | null;
};
