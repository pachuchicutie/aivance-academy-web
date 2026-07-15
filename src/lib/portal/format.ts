import type { PortalLiveSession } from "./types";

const PH_TIME_ZONE = "Asia/Manila";

export function formatSessionDate(iso: string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: PH_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatSessionTime(iso: string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: PH_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function formatSessionDay(iso: string) {
  const date = new Date(iso);
  return {
    month: new Intl.DateTimeFormat("en-PH", {
      timeZone: PH_TIME_ZONE,
      month: "short",
    })
      .format(date)
      .toUpperCase(),
    day: new Intl.DateTimeFormat("en-PH", {
      timeZone: PH_TIME_ZONE,
      day: "numeric",
    }).format(date),
  };
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: PH_TIME_ZONE,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatDateTime(iso: string) {
  return `${formatSessionDate(iso)} · ${formatSessionTime(iso)} PHT`;
}

export type LiveState = "upcoming" | "starting_soon" | "live" | "ended";

export function getSessionLiveState(
  session: PortalLiveSession,
  now = Date.now()
): LiveState {
  const start = new Date(session.starts_at).getTime();
  const end = start + session.duration_minutes * 60_000;

  if (now >= start && now <= end) return "live";
  if (now < start && start - now <= 30 * 60_000) return "starting_soon";
  if (now < start) return "upcoming";
  return "ended";
}

/** First display name, safe against missing/odd values. */
export function firstName(fullName: string | null | undefined) {
  const cleaned = (fullName ?? "").trim();
  if (!cleaned) return null;
  const first = cleaned.split(/\s+/)[0];
  return first.length > 24 ? `${first.slice(0, 24)}…` : first;
}

export function displayName(
  fullName: string | null | undefined,
  email: string | null | undefined
) {
  const cleaned = (fullName ?? "").trim();
  if (cleaned) return cleaned;
  const mail = (email ?? "").trim();
  if (mail.includes("@")) return mail.split("@")[0];
  return "Student";
}

export function initials(
  fullName: string | null | undefined,
  email: string | null | undefined
) {
  const base = (fullName ?? "").trim() || (email ?? "").trim() || "S";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
}

export function tierLabel(tier: string | null | undefined) {
  const raw = (tier ?? "").trim().toLowerCase();
  if (!raw) return null;
  switch (raw) {
    case "basic":
    case "starter":
    case "standard":
      return "Basic";
    case "plus":
      return "Plus";
    case "pro":
      return "Pro";
    case "advanced":
      return "Advanced";
    default:
      // Dynamic catalog codes (e.g. future tiers) — title-case the code.
      return raw
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ");
  }
}

export function sessionTypeLabel(type: PortalLiveSession["session_type"]) {
  switch (type) {
    case "live_class":
      return "Live class";
    case "qna":
      return "Q&A";
    case "workshop":
      return "Workshop";
    case "orientation":
      return "Orientation";
    default:
      return "Session";
  }
}
