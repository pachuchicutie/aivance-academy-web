import type { CourseLibraryItem, CourseTierLabel } from "./types";
import { toPlanLabel } from "./membership";
import { tierLabel } from "./format";

/**
 * Accept a tier code ("basic") or human label ("Basic" / "Basic Tier").
 * Returns a clean display name (e.g. "Basic") or null — never placeholders.
 */
export function currentPlanLabel(
  studentTierOrName: string | null | undefined
): string | null {
  if (studentTierOrName == null || String(studentTierOrName).trim() === "") {
    return null;
  }
  const raw = String(studentTierOrName).trim();
  const lower = raw.toLowerCase();
  if (
    lower.includes("your current") ||
    lower.includes("current plan") ||
    lower === "membership tier" ||
    lower === "plan tier" ||
    lower === "plan"
  ) {
    return null;
  }

  const fromCode = tierLabel(raw);
  const candidate = fromCode ?? raw.replace(/\s+tier$/i, "").trim();
  if (!candidate || candidate.toLowerCase() === "plan") return null;
  return candidate;
}

/** Sentence-ready plan label: "Basic Tier". Null when unknown. */
export function currentPlanPhrase(
  studentTierOrName: string | null | undefined
): string | null {
  const name = currentPlanLabel(studentTierOrName);
  return toPlanLabel(name);
}

/** Natural language list of eligible tier display names (no internal codes). */
export function formatEligibleTierList(tiers: CourseTierLabel[]): string {
  const names = tiers
    .map((t) => {
      const label = (t.label || tierLabel(t.code) || "").trim();
      if (!label) return null;
      const lower = label.toLowerCase();
      if (
        lower.includes("your current") ||
        lower === "plan" ||
        lower === "current plan"
      ) {
        return null;
      }
      return label;
    })
    .filter((n): n is string => Boolean(n));

  if (!names.length) return "an eligible membership tier";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} or ${names[1]}`;
  return "an eligible membership tier";
}

export type LockedCardCopy = {
  planLine: string;
  upgradeLine: string;
  requiredAccessLabel: string;
  hasPlan: boolean;
  planPhrase: string | null;
  eligiblePhrase: string;
};

/**
 * Reliable tier sentence formatter for locked discovery cards.
 * Never produces "your current your current plan Tier".
 */
export function lockedUpgradeMessage(
  item: CourseLibraryItem,
  studentPlan: string | null | undefined
): LockedCardCopy {
  const planPhrase = currentPlanPhrase(studentPlan);
  const eligible = formatEligibleTierList(item.eligibleTiers);

  let upgradeLine: string;
  if (item.tierAccessMode === "all_tiers") {
    upgradeLine =
      "Contact support to confirm enrollment for this course’s modules, lessons, and resources.";
  } else if (item.eligibleTiers.length === 1) {
    upgradeLine = `Upgrade to ${eligible} to unlock this course’s modules, lessons, and resources.`;
  } else if (item.eligibleTiers.length === 2) {
    upgradeLine = `Upgrade to ${eligible} to unlock this course’s modules, lessons, and resources.`;
  } else {
    upgradeLine =
      "Upgrade to an eligible membership tier to unlock this course’s modules, lessons, and resources.";
  }

  return {
    hasPlan: Boolean(planPhrase),
    planPhrase,
    eligiblePhrase: eligible,
    planLine: planPhrase
      ? `Not included in your ${planPhrase}.`
      : "Not included in your confirmed membership plan.",
    upgradeLine,
    requiredAccessLabel:
      item.tierAccessMode === "all_tiers"
        ? "All membership tiers"
        : eligible,
  };
}

export function lockedAriaLabel(
  item: CourseLibraryItem,
  studentPlan: string | null | undefined
): string {
  const copy = lockedUpgradeMessage(item, studentPlan);
  const planBit = copy.planPhrase
    ? `Not included in ${copy.planPhrase}.`
    : "Not included in your plan.";
  return `${item.course.title}. Locked. ${planBit} Requires ${copy.requiredAccessLabel}.`;
}

/** Support deep-link for upgrade inquiries (locked courses are not enrolled). */
export function lockedSupportHref(item: CourseLibraryItem): string {
  const params = new URLSearchParams();
  params.set("category", "course_access");
  params.set(
    "subject",
    `Upgrade inquiry: ${item.course.title}`.slice(0, 150)
  );
  params.set(
    "message",
    `I'd like to ask about upgrading so I can access "${item.course.title}".`
  );
  return `/portal/support?${params.toString()}`;
}
