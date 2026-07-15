import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type {
  CourseAccessState,
  CourseLibraryItem,
  CourseProgress,
  CourseTierLabel,
  EnrolledCourse,
  PortalCourse,
  Tier,
} from "./types";

type RawCourseRow = {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  is_active: boolean;
  deleted_at: string | null;
  tier_access_mode?: string | null;
};

type MembershipTierRow = {
  id: string;
  code: string;
  label: string;
  is_active: boolean;
  sort_order: number;
};

function pickCatalogClient(userClient: SupabaseClient): SupabaseClient {
  // Prefer service role only as a server-side fallback when RLS is still
  // enrollment-scoped. Primary path is the user client + catalog RLS policy.
  return createSupabaseServiceClient() ?? userClient;
}

/**
 * Load published catalog courses for discovery.
 * Independent of enrollments — must return active courses the student can
 * *see* even when locked by tier.
 */
export async function listPublishedCatalogCourses(
  userClient: SupabaseClient
): Promise<RawCourseRow[]> {
  const clients: SupabaseClient[] = [];
  const service = createSupabaseServiceClient();
  // Try user client first (catalog RLS). Service role as fallback.
  clients.push(userClient);
  if (service) clients.push(service);

  let lastError: string | null = null;

  for (const client of clients) {
    const withMode = await client
      .from("courses")
      .select(
        "id, title, description, slug, is_active, deleted_at, tier_access_mode"
      )
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("title", { ascending: true });

    if (!withMode.error) {
      return (withMode.data ?? []) as RawCourseRow[];
    }

    lastError = withMode.error.message;

    // Column may not exist pre-migration.
    if (
      withMode.error.message?.includes("tier_access_mode") ||
      withMode.error.code === "42703"
    ) {
      const withoutMode = await client
        .from("courses")
        .select("id, title, description, slug, is_active, deleted_at")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("title", { ascending: true });

      if (!withoutMode.error) {
        return (withoutMode.data ?? []) as RawCourseRow[];
      }
      lastError = withoutMode.error.message;
    }
  }

  console.error("listPublishedCatalogCourses", lastError);
  return [];
}

export async function listMembershipTiers(
  userClient: SupabaseClient
): Promise<MembershipTierRow[]> {
  const client = pickCatalogClient(userClient);

  const { data, error } = await client
    .from("membership_tiers")
    .select("id, code, label, is_active, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    if (
      error.code === "42P01" ||
      error.message?.includes("membership_tiers") ||
      error.code === "PGRST205"
    ) {
      // Pre-migration fallback labels — codes match payments/enrollments.
      return [
        {
          id: "basic",
          code: "basic",
          label: "Basic",
          is_active: true,
          sort_order: 10,
        },
        {
          id: "plus",
          code: "plus",
          label: "Plus",
          is_active: true,
          sort_order: 20,
        },
        {
          id: "pro",
          code: "pro",
          label: "Pro",
          is_active: true,
          sort_order: 30,
        },
      ];
    }
    console.error("listMembershipTiers", error.message);
    return [];
  }

  return (data ?? []) as MembershipTierRow[];
}

async function loadCourseTierMap(
  userClient: SupabaseClient,
  courseIds: string[],
  tiers: MembershipTierRow[]
): Promise<Map<string, CourseTierLabel[]>> {
  const map = new Map<string, CourseTierLabel[]>();
  if (!courseIds.length) return map;

  const clients: SupabaseClient[] = [userClient];
  const service = createSupabaseServiceClient();
  if (service) clients.push(service);

  const tierById = new Map(tiers.map((t) => [t.id, t]));
  // Also map by code for fallback seed ids.
  const tierByCode = new Map(tiers.map((t) => [t.code.toLowerCase(), t]));

  for (const client of clients) {
    const { data, error } = await client
      .from("course_tier_access")
      .select("course_id, tier_id, membership_tiers(id, code, label)")
      .in("course_id", courseIds);

    if (error) {
      if (
        error.code === "42P01" ||
        error.message?.includes("course_tier_access") ||
        error.code === "PGRST205"
      ) {
        return map;
      }
      // Try simpler select without embed
      const simple = await client
        .from("course_tier_access")
        .select("course_id, tier_id")
        .in("course_id", courseIds);
      if (simple.error) {
        console.error("loadCourseTierMap", simple.error.message);
        continue;
      }
      for (const row of simple.data ?? []) {
        const courseId = row.course_id as string;
        const tier =
          tierById.get(row.tier_id as string) ??
          tierByCode.get(String(row.tier_id).toLowerCase());
        if (!tier) continue;
        const list = map.get(courseId) ?? [];
        if (!list.some((x) => x.id === tier.id)) {
          list.push({ id: tier.id, code: tier.code, label: tier.label });
        }
        map.set(courseId, list);
      }
      break;
    }

    for (const row of data ?? []) {
      const courseId = row.course_id as string;
      const embedded = row.membership_tiers as
        | { id: string; code: string; label: string }
        | { id: string; code: string; label: string }[]
        | null;
      const mt = Array.isArray(embedded) ? embedded[0] : embedded;
      const tier =
        (mt
          ? { id: mt.id, code: mt.code, label: mt.label }
          : null) ??
        tierById.get(row.tier_id as string) ??
        null;
      if (!tier) continue;
      const list = map.get(courseId) ?? [];
      if (!list.some((x) => x.id === tier.id || x.code === tier.code)) {
        list.push({ id: tier.id, code: tier.code, label: tier.label });
      }
      map.set(courseId, list);
    }
    break;
  }

  for (const [id, list] of map) {
    list.sort((a, b) => a.label.localeCompare(b.label));
    map.set(id, list);
  }

  return map;
}

/** Exact tier match against course eligibility (no invented inheritance). */
export function isStudentTierEligibleForCourse(
  mode: "all_tiers" | "selected_tiers",
  eligibleTiers: CourseTierLabel[],
  studentTier: string | null | undefined
): boolean {
  if (mode === "all_tiers") return true;
  if (!studentTier) return false;
  // selected_tiers with empty mapping = misconfigured → treat as not eligible
  if (!eligibleTiers.length) return false;
  const code = studentTier.toLowerCase();
  return eligibleTiers.some((t) => t.code.toLowerCase() === code);
}

export async function courseAllowsStudentTier(
  userClient: SupabaseClient,
  courseId: string,
  studentTier: string | null | undefined
): Promise<boolean> {
  const { data, error } = await userClient.rpc("course_allows_tier", {
    p_course_id: courseId,
    p_tier: studentTier ?? "",
  });

  if (error) {
    if (
      error.message?.includes("course_allows_tier") ||
      error.code === "PGRST202" ||
      error.code === "42883"
    ) {
      return true;
    }
    console.error("courseAllowsStudentTier", error.message);
    return false;
  }

  return data === true;
}

export function formatEligibleTiersSummary(
  mode: "all_tiers" | "selected_tiers",
  tiers: CourseTierLabel[]
): string {
  if (mode === "all_tiers") return "Available to All Tiers";
  if (!tiers.length) return "Membership required";
  if (tiers.length === 1) return `${tiers[0].label} Required`;
  if (tiers.length === 2) {
    return `${tiers[0].label} or ${tiers[1].label} Required`;
  }
  return `Available with ${tiers.length} plans`;
}

function emptyProgress(): CourseProgress {
  return {
    totalCourseModules: 0,
    completedCourseModules: 0,
    startedCourseModules: 0,
    totalCourseLessons: 0,
    completedCourseLessons: 0,
    overallCourseProgressPercentage: 0,
    overallCourseProgressExact: 0,
    courseProgressPercentage: 0,
    nextIncompleteLessonId: null,
    nextIncompleteLessonTitle: null,
    lastActivityAt: null,
    contentPending: true,
  };
}

function enrolledAsCatalogRow(e: EnrolledCourse): RawCourseRow {
  return {
    id: e.course.id,
    title: e.course.title,
    description: e.course.description,
    slug: e.course.slug,
    is_active: true,
    deleted_at: null,
    tier_access_mode: "all_tiers",
  };
}

/**
 * Build the full student course library: enrolled + eligible + locked catalog.
 * Progress only attaches to enrolled_accessible items.
 *
 * Catalog is loaded independently of enrollments so higher-tier courses remain
 * visible as locked discovery cards.
 */
export async function getStudentCourseLibrary(
  userClient: SupabaseClient,
  studentTier: Tier | string | null,
  enrolled: EnrolledCourse[]
): Promise<CourseLibraryItem[]> {
  const [catalogRaw, tiers] = await Promise.all([
    listPublishedCatalogCourses(userClient),
    listMembershipTiers(userClient),
  ]);

  // Union: never drop enrolled courses if catalog query under-returned.
  const byId = new Map<string, RawCourseRow>();
  for (const c of catalogRaw) byId.set(c.id, c);
  for (const e of enrolled) {
    if (!byId.has(e.course.id)) {
      byId.set(e.course.id, enrolledAsCatalogRow(e));
    }
  }

  const catalog = Array.from(byId.values());
  const enrolledByCourseId = new Map(
    enrolled.map((e) => [e.course.id, e] as const)
  );

  const courseIds = catalog.map((c) => c.id);
  const tiersByCourse = await loadCourseTierMap(userClient, courseIds, tiers);

  const covers = new Map<string, string | null>();
  for (const e of enrolled) {
    covers.set(e.course.id, e.coverImage);
  }

  const missingCovers = courseIds.filter((id) => !covers.has(id));
  if (missingCovers.length) {
    const client = pickCatalogClient(userClient);
    const { data: moduleCovers } = await client
      .from("modules")
      .select(
        "course_id, image_url, sort_order, module_number, is_active, deleted_at"
      )
      .in("course_id", missingCovers)
      .eq("is_active", true)
      .is("deleted_at", null);
    const best = new Map<string, { url: string; order: number }>();
    for (const m of moduleCovers ?? []) {
      if (!m.image_url) continue;
      const order =
        (m.sort_order as number | null) ?? (m.module_number as number);
      const prev = best.get(m.course_id as string);
      if (!prev || order < prev.order) {
        best.set(m.course_id as string, {
          url: m.image_url as string,
          order,
        });
      }
    }
    for (const [id, v] of best) covers.set(id, v.url);
  }

  const items: CourseLibraryItem[] = [];

  for (const raw of catalog) {
    const course: PortalCourse = {
      id: raw.id,
      title: raw.title,
      description: raw.description,
      slug: raw.slug,
    };

    const mode: "all_tiers" | "selected_tiers" =
      raw.tier_access_mode === "selected_tiers"
        ? "selected_tiers"
        : "all_tiers";

    const eligibleTiers =
      mode === "all_tiers"
        ? tiers.map((t) => ({ id: t.id, code: t.code, label: t.label }))
        : (tiersByCourse.get(raw.id) ?? []);

    const enrolledRow = enrolledByCourseId.get(raw.id);
    let accessState: CourseAccessState;

    if (raw.deleted_at) {
      accessState = "unavailable";
    } else if (!raw.is_active && !enrolledRow) {
      accessState = "unavailable";
    } else if (enrolledRow) {
      // Valid enrollment always grants content access.
      accessState = "enrolled_accessible";
    } else if (
      isStudentTierEligibleForCourse(mode, eligibleTiers, studentTier)
    ) {
      accessState = "eligible_not_enrolled";
    } else {
      accessState = "locked_by_tier";
    }

    // selected_tiers with no mapped tiers and not enrolled → locked (misconfig or restricted)
    if (
      !enrolledRow &&
      mode === "selected_tiers" &&
      eligibleTiers.length === 0
    ) {
      accessState = "locked_by_tier";
    }

    items.push({
      course,
      coverImage: covers.get(raw.id) ?? null,
      accessState,
      tierAccessMode: mode,
      eligibleTiers,
      requiredTierSummary: formatEligibleTiersSummary(mode, eligibleTiers),
      enrollmentId: enrolledRow?.enrollmentId ?? null,
      enrollmentTier: enrolledRow?.enrollmentTier ?? null,
      progress:
        accessState === "enrolled_accessible" && enrolledRow
          ? enrolledRow.progress
          : null,
    });
  }

  const rank: Record<CourseAccessState, number> = {
    enrolled_accessible: 0,
    eligible_not_enrolled: 1,
    locked_by_tier: 2,
    unavailable: 3,
  };

  items.sort((a, b) => {
    const d = rank[a.accessState] - rank[b.accessState];
    if (d !== 0) return d;
    return a.course.title.localeCompare(b.course.title);
  });

  return items;
}

export async function resolveCourseAccessForStudent(
  userClient: SupabaseClient,
  courseSlug: string,
  studentTier: Tier | string | null,
  enrolled: EnrolledCourse[]
): Promise<CourseLibraryItem | null> {
  const library = await getStudentCourseLibrary(
    userClient,
    studentTier,
    enrolled
  );
  const hit = library.find((c) => c.course.slug === courseSlug);
  if (hit) return hit;

  // Direct slug lookup when catalog list missed the course (still resolve lock state).
  const clients: SupabaseClient[] = [userClient];
  const service = createSupabaseServiceClient();
  if (service) clients.push(service);

  type CourseLookup = {
    id: string;
    title: string;
    description: string | null;
    slug: string;
    is_active: boolean;
    deleted_at: string | null;
    tier_access_mode?: string | null;
  };

  for (const client of clients) {
    let row: CourseLookup | null = null;

    const withMode = await client
      .from("courses")
      .select(
        "id, title, description, slug, is_active, deleted_at, tier_access_mode"
      )
      .eq("slug", courseSlug)
      .maybeSingle();

    if (!withMode.error && withMode.data) {
      row = withMode.data as CourseLookup;
    } else if (
      withMode.error?.message?.includes("tier_access_mode") ||
      withMode.error?.code === "42703"
    ) {
      const without = await client
        .from("courses")
        .select("id, title, description, slug, is_active, deleted_at")
        .eq("slug", courseSlug)
        .maybeSingle();
      if (!without.error && without.data) {
        row = without.data as CourseLookup;
      }
    }

    if (!row || row.deleted_at) continue;
    if (!row.is_active) {
      return {
        course: {
          id: row.id,
          title: row.title,
          description: row.description,
          slug: row.slug,
        },
        coverImage: null,
        accessState: "unavailable",
        tierAccessMode: "all_tiers",
        eligibleTiers: [],
        requiredTierSummary: "Unavailable",
        enrollmentId: null,
        enrollmentTier: null,
        progress: null,
      };
    }

    const tiers = await listMembershipTiers(userClient);
    const map = await loadCourseTierMap(userClient, [row.id], tiers);
    const mode: "all_tiers" | "selected_tiers" =
      row.tier_access_mode === "selected_tiers"
        ? "selected_tiers"
        : "all_tiers";
    const eligibleTiers =
      mode === "all_tiers"
        ? tiers.map((t) => ({ id: t.id, code: t.code, label: t.label }))
        : (map.get(row.id) ?? []);

    const enrolledRow = enrolled.find((e) => e.course.id === row!.id);
    const accessState: CourseAccessState = enrolledRow
      ? "enrolled_accessible"
      : isStudentTierEligibleForCourse(mode, eligibleTiers, studentTier)
        ? "eligible_not_enrolled"
        : "locked_by_tier";

    return {
      course: {
        id: row.id,
        title: row.title,
        description: row.description,
        slug: row.slug,
      },
      coverImage: enrolledRow?.coverImage ?? null,
      accessState,
      tierAccessMode: mode,
      eligibleTiers,
      requiredTierSummary: formatEligibleTiersSummary(mode, eligibleTiers),
      enrollmentId: enrolledRow?.enrollmentId ?? null,
      enrollmentTier: enrolledRow?.enrollmentTier ?? null,
      progress: enrolledRow?.progress ?? null,
    };
  }

  return null;
}

export function enrolledAccessibleOnly(
  library: CourseLibraryItem[]
): CourseLibraryItem[] {
  return library.filter((c) => c.accessState === "enrolled_accessible");
}

export function libraryItemToEnrolled(
  item: CourseLibraryItem
): EnrolledCourse | null {
  if (item.accessState !== "enrolled_accessible" || !item.enrollmentId) {
    return null;
  }
  return {
    enrollmentId: item.enrollmentId,
    enrollmentTier: (item.enrollmentTier ?? "basic") as Tier,
    startedAt: "",
    course: item.course,
    coverImage: item.coverImage,
    progress: item.progress ?? emptyProgress(),
  };
}
