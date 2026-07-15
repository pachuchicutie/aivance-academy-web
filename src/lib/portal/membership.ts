import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { PortalProfile, Tier } from "./types";

const TIER_RANK: Record<string, number> = {
  basic: 1,
  plus: 2,
  pro: 3,
};

/** Placeholder / mock strings that must never render as a real plan name. */
const FORBIDDEN_PLAN_PHRASES = [
  "your current plan",
  "your current plan tier",
  "current plan tier",
  "current plan",
  "membership tier",
  "plan tier",
  "your plan",
];

export type StudentMembershipPlan = {
  /** membership_tiers.id when the catalog row exists */
  tierId: string | null;
  /** Internal code only (basic | plus | pro | dynamic). Never show alone as plan name. */
  code: string;
  /** Human label from membership_tiers.label (e.g. "Basic") */
  displayName: string;
  /** Sentence-ready label (e.g. "Basic Tier") */
  planLabel: string;
  description: string | null;
  status: "active" | "unavailable";
  rank: number;
};

type MembershipTierRow = {
  id: string;
  code: string;
  label: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
};

/** Normalize free-form tier strings to the canonical enum when known. */
export function normalizeTier(value: unknown): Tier | null {
  if (value == null) return null;
  const raw = String(value).trim().toLowerCase();
  if (raw === "basic" || raw === "plus" || raw === "pro") return raw;
  if (raw === "starter" || raw === "standard") return "basic";
  return null;
}

export function tierRank(tier: string | null | undefined) {
  if (!tier) return 0;
  return TIER_RANK[String(tier).trim().toLowerCase()] ?? 0;
}

export function bestTier(
  ...tiers: Array<string | null | undefined>
): Tier | null {
  let best: Tier | null = null;
  for (const t of tiers) {
    const n = normalizeTier(t);
    if (!n) continue;
    if (!best || tierRank(n) > tierRank(best)) best = n;
  }
  return best;
}

function isForbiddenPlanName(value: string): boolean {
  const lower = value.trim().toLowerCase();
  if (!lower) return true;
  return FORBIDDEN_PLAN_PHRASES.some(
    (p) => lower === p || lower.includes(p)
  );
}

/**
 * Build a sentence-ready plan label from a display name.
 * "Basic" → "Basic Tier"; "Basic Tier" stays "Basic Tier".
 * Never invents a name when input is missing/placeholder.
 */
export function toPlanLabel(
  displayName: string | null | undefined
): string | null {
  if (displayName == null) return null;
  const cleaned = String(displayName).trim();
  if (!cleaned || isForbiddenPlanName(cleaned)) return null;
  if (/\btier\b/i.test(cleaned)) return cleaned;
  return `${cleaned} Tier`;
}

/**
 * Load active membership_tiers rows (server-side). Prefers service role so
 * catalog is available even when student RLS is tight.
 */
export async function loadMembershipTierCatalog(
  userClient: SupabaseClient
): Promise<MembershipTierRow[]> {
  const service = createSupabaseServiceClient();
  const client = service ?? userClient;

  const { data, error } = await client
    .from("membership_tiers")
    .select("id, code, label, description, is_active, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    if (
      error.code === "42P01" ||
      error.message?.includes("membership_tiers") ||
      error.code === "PGRST205"
    ) {
      // Pre-migration safety: known product codes only — labels are real names.
      return [
        {
          id: "basic",
          code: "basic",
          label: "Basic",
          description: "Entry-level academy access",
          is_active: true,
          sort_order: 10,
        },
        {
          id: "plus",
          code: "plus",
          label: "Plus",
          description: "Expanded courses and resources",
          is_active: true,
          sort_order: 20,
        },
        {
          id: "pro",
          code: "pro",
          label: "Pro",
          description: "Complete academy access",
          is_active: true,
          sort_order: 30,
        },
      ];
    }
    console.error("loadMembershipTierCatalog", error.message);
    return [];
  }

  return (data ?? []) as MembershipTierRow[];
}

function titleCaseCode(code: string): string {
  return code
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

function planFromCode(
  code: string,
  catalog: MembershipTierRow[]
): StudentMembershipPlan | null {
  const normalized = String(code).trim().toLowerCase();
  if (!normalized || isForbiddenPlanName(normalized)) return null;

  const row = catalog.find((t) => t.code.toLowerCase() === normalized);
  const displayName = row?.label?.trim() || titleCaseCode(normalized);
  if (!displayName || isForbiddenPlanName(displayName)) return null;

  const planLabel = toPlanLabel(displayName);
  if (!planLabel) return null;

  return {
    tierId: row?.id ?? null,
    code: row?.code ?? normalized,
    displayName,
    planLabel,
    description: row?.description ?? null,
    status: "active",
    rank: row?.sort_order ?? tierRank(normalized),
  };
}

/**
 * Resolve membership tier code from real evidence.
 * Priority: profile.tier → active enrollment tiers → confirmed payment tiers.
 * Active students with membership evidence but missing tier string → basic.
 * Admins also resolve from enrollments/payments (student-portal testing),
 * but never get an invented Basic default when nothing is recorded.
 */
export async function resolveStudentMembershipTier(
  supabase: SupabaseClient,
  profile: PortalProfile
): Promise<Tier | null> {
  const profileTier = normalizeTier(profile.tier);
  const status = String(profile.status ?? "active").trim().toLowerCase();

  const [{ data: enrollments }, { data: payments }] = await Promise.all([
    supabase
      .from("enrollments")
      .select("tier, status")
      .eq("user_id", profile.id)
      .eq("status", "active"),
    supabase
      .from("payments")
      .select("tier, status")
      .eq("user_id", profile.id)
      .eq("status", "confirmed"),
  ]);

  const enrollmentTierList = (enrollments ?? [])
    .map((e) => normalizeTier(e.tier))
    .filter(Boolean) as Tier[];
  const paymentTiersList = (payments ?? [])
    .map((p) => normalizeTier(p.tier))
    .filter(Boolean) as Tier[];

  const enrollmentTier = bestTier(...enrollmentTierList);
  const paymentTier = bestTier(...paymentTiersList);

  const resolved = bestTier(profileTier, enrollmentTier, paymentTier);
  if (resolved) return resolved;

  // Membership evidence without a tier string → Basic (students only).
  if (
    profile.role === "student" &&
    (enrollmentTierList.length > 0 || paymentTiersList.length > 0)
  ) {
    return "basic";
  }

  // Active portal students are academy members — default Basic.
  if (status === "active" && profile.role === "student") {
    return "basic";
  }

  return null;
}

/**
 * Canonical server-side student membership for UI + access.
 * displayName / planLabel always come from membership_tiers when available.
 * Returns null when no valid tier can be proven — never fabricates a name.
 */
export async function resolveStudentMembershipPlan(
  supabase: SupabaseClient,
  profile: PortalProfile
): Promise<StudentMembershipPlan | null> {
  const [code, catalog] = await Promise.all([
    resolveStudentMembershipTier(supabase, profile),
    loadMembershipTierCatalog(supabase),
  ]);

  if (!code) return null;
  return planFromCode(code, catalog);
}

/**
 * Persist a missing/outdated profile.tier so Settings/Admin stay correct.
 * Uses service role (students cannot update tier via RLS). Safe no-op if unavailable.
 */
export async function healStudentProfileTier(
  profile: PortalProfile,
  resolved: Tier | null
): Promise<void> {
  if (!resolved) return;
  if (profile.role !== "student") return;

  const current = normalizeTier(profile.tier);
  if (current === resolved) return;
  // Never downgrade an existing higher tier.
  if (current && tierRank(current) >= tierRank(resolved)) return;

  const service = createSupabaseServiceClient();
  if (!service) return;

  const { error } = await service
    .from("profiles")
    .update({
      tier: resolved,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id)
    .eq("role", "student");

  if (error) {
    console.error("healStudentProfileTier", error.message);
  }
}
