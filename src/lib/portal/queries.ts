import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerUserClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  healStudentProfileTier,
  normalizeTier,
  resolveStudentMembershipPlan,
  resolveStudentMembershipTier,
  type StudentMembershipPlan,
} from "./membership";
import {
  buildCourseProgress,
  buildModuleProgress,
} from "./progress";
import type {
  CourseProgress,
  CourseResource,
  EnrolledCourse,
  PortalAnnouncement,
  PortalCommunity,
  PortalCourse,
  PortalLesson,
  PortalLiveSession,
  PortalModule,
  PortalProfile,
  ResourceAttachment,
  ResourceLink,
  Tier,
} from "./types";

export { buildCourseProgress, buildModuleProgress };

export type PortalContext = {
  supabase: SupabaseClient;
  userId: string;
  profile: PortalProfile;
  /** Canonical membership from profile/enrollments/payments + membership_tiers */
  membership: StudentMembershipPlan | null;
};

const MODULE_BASE_SELECT =
  "id, course_id, title, description, image_url, module_number, sort_order, required_tier, is_active, deleted_at, resource_links, attachments";

const LESSON_BASE_SELECT =
  "id, module_id, title, description, lesson_number, sort_order, is_active, deleted_at, resource_links, attachments";

type RawLessonRow = {
  id: string;
  module_id?: string;
  title: string;
  description: string | null;
  lesson_number: number;
  sort_order: number | null;
  is_active: boolean;
  deleted_at: string | null;
  resource_links: ResourceLink[] | null;
  attachments: ResourceAttachment[] | null;
};

type RawModuleRow = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  module_number: number;
  sort_order: number | null;
  required_tier: Tier;
  is_active: boolean;
  deleted_at: string | null;
  resource_links: ResourceLink[] | null;
  attachments: ResourceAttachment[] | null;
  lessons: RawLessonRow[] | null;
};

function moduleOrder(m: { sort_order: number | null; module_number: number }) {
  return m.sort_order ?? m.module_number;
}

function lessonOrder(l: { sort_order: number | null; lesson_number: number }) {
  return l.sort_order ?? l.lesson_number;
}

function visibleLessons(rows: RawLessonRow[] | null) {
  return (rows ?? [])
    .filter((l) => l.is_active && !l.deleted_at)
    .sort((a, b) => lessonOrder(a) - lessonOrder(b));
}

function visibleModules(rows: RawModuleRow[] | null) {
  return (rows ?? [])
    .filter((m) => m.is_active && !m.deleted_at)
    .sort((a, b) => moduleOrder(a) - moduleOrder(b));
}

/**
 * Authenticated portal context. Redirects to login when signed out and to
 * the account-status screen when the account is not active.
 */
export async function getPortalContext(): Promise<PortalContext> {
  const supabase = await createSupabaseServerUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/portal/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, tier, status, batch")
    .eq("id", user.id)
    .maybeSingle<PortalProfile>();

  const base: PortalProfile = profile ?? {
    id: user.id,
    full_name:
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : null,
    email: user.email ?? null,
    role: "student",
    tier: null,
    status: "active",
    batch: null,
  };

  const profileForResolve: PortalProfile = {
    ...base,
    tier: normalizeTier(base.tier),
  };

  // Canonical membership: code + membership_tiers display name (never placeholders).
  const membership = await resolveStudentMembershipPlan(
    supabase,
    profileForResolve
  );
  const resolvedTier =
    (membership?.code
      ? normalizeTier(membership.code)
      : await resolveStudentMembershipTier(supabase, profileForResolve)) ??
    null;

  // Persist missing/outdated student tier so Settings/Admin stay accurate.
  if (base.role === "student") {
    await healStudentProfileTier(base, resolvedTier);
  }

  return {
    supabase,
    userId: user.id,
    profile: {
      ...base,
      tier: resolvedTier,
    },
    membership,
  };
}

function toPortalModules(
  rows: RawModuleRow[] | null,
  completedIds: Set<string>
): PortalModule[] {
  return visibleModules(rows).map((m) => ({
    id: m.id,
    course_id: m.course_id,
    title: m.title,
    description: m.description,
    image_url: m.image_url,
    module_number: m.module_number,
    sort_order: m.sort_order,
    required_tier: m.required_tier,
    lessons: visibleLessons(m.lessons).map((l) => ({
      id: l.id,
      title: l.title,
      description: l.description,
      lesson_number: l.lesson_number,
      sort_order: l.sort_order,
      completed: completedIds.has(l.id),
    })),
  }));
}

/**
 * Load modules + lessons for course progress.
 * Uses two queries (not nested embeds) so every lesson is included.
 * Prefer service-role client so tier RLS on modules does not shrink the
 * course-wide denominator to only the student's currently unlocked module(s).
 * Call only after the student has a verified enrollment in the course(s).
 */
async function loadRawModulesWithLessons(
  client: SupabaseClient,
  courseIds: string[]
): Promise<RawModuleRow[]> {
  if (!courseIds.length) return [];

  const { data: modules, error: modError } = await client
    .from("modules")
    .select(MODULE_BASE_SELECT)
    .in("course_id", courseIds);

  if (modError) {
    console.error("loadRawModulesWithLessons modules", modError.message);
    return [];
  }
  if (!modules?.length) return [];

  const moduleIds = modules.map((m) => m.id as string);
  const { data: lessons, error: lessonError } = await client
    .from("lessons")
    .select(LESSON_BASE_SELECT)
    .in("module_id", moduleIds);

  if (lessonError) {
    console.error("loadRawModulesWithLessons lessons", lessonError.message);
  }

  const lessonsByModule = new Map<string, RawLessonRow[]>();
  for (const row of lessons ?? []) {
    const mid = row.module_id as string;
    const list = lessonsByModule.get(mid) ?? [];
    list.push(row as RawLessonRow);
    lessonsByModule.set(mid, list);
  }

  return modules.map((m) => ({
    ...(m as Omit<RawModuleRow, "lessons">),
    lessons: lessonsByModule.get(m.id as string) ?? [],
  }));
}

/**
 * Full published course tree for progress totals.
 * After enrollment is confirmed, prefer service role so module tier RLS does
 * not make overall progress look like "1/4" from a single unlocked module.
 */
async function loadCourseStructureForProgress(
  userClient: SupabaseClient,
  courseIds: string[]
): Promise<RawModuleRow[]> {
  const service = createSupabaseServiceClient();
  if (service) {
    const full = await loadRawModulesWithLessons(service, courseIds);
    if (full.length) return full;
  }
  // Fallback: user-scoped modules (may under-count when higher-tier modules exist)
  return loadRawModulesWithLessons(userClient, courseIds);
}

export async function getLessonProgressMap(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("lesson_progress")
    .select("lesson_id, completed_at");

  const completedIds = new Set<string>();
  const progressDates = new Map<string, string>();
  for (const row of data ?? []) {
    completedIds.add(row.lesson_id as string);
    progressDates.set(row.lesson_id as string, row.completed_at as string);
  }
  return { completedIds, progressDates };
}

/**
 * Normalize a PostgREST many-to-one embed that may arrive as an object or a
 * single-element array depending on schema cache / relationship inference.
 */
function unwrapRelation<T extends object>(value: unknown): T | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === "object" ? (first as T) : null;
  }
  if (typeof value === "object") return value as T;
  return null;
}

/**
 * True when the signed-in student has a non-expired active enrollment for the
 * course. Uses the same rules as the Courses page / Support course dropdown
 * (RLS scopes rows to auth.uid() — do not double-filter user_id).
 */
export async function studentHasActiveCourseAccess(
  supabase: SupabaseClient,
  courseId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("enrollments")
    .select("id, expires_at")
    .eq("course_id", courseId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "studentHasActiveCourseAccess",
      error.message,
      error.code,
      courseId
    );
    // Fall back to the full enrolled list used by the Courses UI.
    const enrolled = await getEnrolledCourses(supabase);
    return enrolled.some((c) => c.course.id === courseId);
  }

  if (!data) {
    // Consistent with the Support dropdown source of truth.
    const enrolled = await getEnrolledCourses(supabase);
    return enrolled.some((c) => c.course.id === courseId);
  }

  if (data.expires_at && new Date(data.expires_at as string) <= new Date()) {
    return false;
  }
  return true;
}

/** Active, authorized enrollments with real lesson-level progress. */
export async function getEnrolledCourses(
  supabase: SupabaseClient
): Promise<EnrolledCourse[]> {
  const { data: enrollments, error } = await supabase
    .from("enrollments")
    .select(
      "id, course_id, tier, status, started_at, expires_at, course:courses(id, title, description, slug)"
    )
    .eq("status", "active")
    .order("started_at", { ascending: false });

  if (error || !enrollments?.length) return [];

  type EnrollmentRow = {
    id: string;
    course_id: string;
    tier: Tier;
    status: string;
    started_at: string;
    expires_at: string | null;
    course: unknown;
  };

  const active = (enrollments as EnrollmentRow[]).filter((e) => {
    if (!e.course_id) return false;
    if (e.expires_at && new Date(e.expires_at) <= new Date()) return false;
    // Keep rows even if the embed is missing — course_id is the access key.
    return true;
  });

  const courseIds = active.map((e) => e.course_id).filter(Boolean);
  if (!courseIds.length) return [];

  // Full course structure for overall progress (all published modules/lessons).
  // User-scoped modules for "Up next" (tier-unlocked content only).
  const [structureRows, accessibleRows, { completedIds, progressDates }] =
    await Promise.all([
      loadCourseStructureForProgress(supabase, courseIds),
      loadRawModulesWithLessons(supabase, courseIds),
      getLessonProgressMap(supabase),
    ]);

  return active
    .map((e) => {
      const embedded = unwrapRelation<PortalCourse>(e.course);
      // enrollment.course_id is canonical — never trust a malformed embed id
      const course: PortalCourse = {
        id: e.course_id,
        title: embedded?.title ?? "Course",
        description: embedded?.description ?? null,
        slug: embedded?.slug ?? "",
      };
      if (!course.id) return null;

      const fullModules = toPortalModules(
        structureRows.filter((m) => m.course_id === course.id),
        completedIds
      );
      const accessibleModules = toPortalModules(
        accessibleRows.filter((m) => m.course_id === course.id),
        completedIds
      );

      return {
        enrollmentId: e.id,
        enrollmentTier: e.tier,
        startedAt: e.started_at,
        course,
        coverImage:
          fullModules.find((m) => m.image_url)?.image_url ??
          accessibleModules.find((m) => m.image_url)?.image_url ??
          null,
        // Overall course progress = all published lessons across all modules
        progress: buildCourseProgress(
          fullModules,
          completedIds,
          progressDates,
          accessibleModules,
          course.id
        ),
      } satisfies EnrolledCourse;
    })
    .filter((row): row is EnrolledCourse => row !== null);
}

export type CourseOverview = {
  course: PortalCourse;
  enrollmentTier: Tier;
  modules: PortalModule[];
  progress: CourseProgress;
  resources: CourseResource[];
};

export async function getCourseOverview(
  supabase: SupabaseClient,
  slug: string
): Promise<CourseOverview | null> {
  const { data: course } = await supabase
    .from("courses")
    .select("id, title, description, slug")
    .eq("slug", slug)
    .maybeSingle<PortalCourse>();

  if (!course) return null;

  const [{ data: enrollment }, progressMaps] = await Promise.all([
    supabase
      .from("enrollments")
      .select("id, tier, status, expires_at")
      .eq("course_id", course.id)
      .eq("status", "active")
      .maybeSingle(),
    getLessonProgressMap(supabase),
  ]);

  if (!enrollment) return null;
  if (
    enrollment.expires_at &&
    new Date(enrollment.expires_at as string) <= new Date()
  ) {
    return null;
  }

  // Full structure for course-wide progress; accessible tree for navigation UI.
  const [structureRows, accessibleRows] = await Promise.all([
    loadCourseStructureForProgress(supabase, [course.id]),
    loadRawModulesWithLessons(supabase, [course.id]),
  ]);

  const fullModules = toPortalModules(
    structureRows,
    progressMaps.completedIds
  );
  const accessibleModules = toPortalModules(
    accessibleRows,
    progressMaps.completedIds
  );

  // Outline / navigation: prefer full published tree so every module appears;
  // fall back to RLS-accessible modules if structure load fails.
  const modulesForUi = fullModules.length ? fullModules : accessibleModules;

  return {
    course,
    enrollmentTier: enrollment.tier as Tier,
    modules: modulesForUi,
    progress: buildCourseProgress(
      fullModules.length ? fullModules : accessibleModules,
      progressMaps.completedIds,
      progressMaps.progressDates,
      accessibleModules.length ? accessibleModules : fullModules,
      course.id
    ),
    resources: collectResources(
      structureRows.length ? structureRows : accessibleRows,
      course
    ),
  };
}

export type LessonContext = {
  course: PortalCourse;
  modules: PortalModule[];
  moduleTitle: string;
  moduleId: string;
  moduleNumber: number;
  lesson: PortalLesson;
  completed: boolean;
  progress: CourseProgress;
  previous: { id: string; title: string; moduleTitle: string } | null;
  next: { id: string; title: string; moduleTitle: string } | null;
};

export async function getLessonContext(
  supabase: SupabaseClient,
  courseSlug: string,
  lessonId: string
): Promise<LessonContext | null> {
  const overview = await getCourseOverview(supabase, courseSlug);
  if (!overview) return null;

  const flat = overview.modules.flatMap((m) =>
    m.lessons.map((l) => ({
      moduleId: m.id,
      moduleTitle: m.title,
      moduleNumber: m.module_number,
      ...l,
    }))
  );
  const index = flat.findIndex((l) => l.id === lessonId);
  if (index === -1) return null;

  // Lesson RLS (can_access_lesson) is the real gate; this fetch returns null
  // for unpublished or out-of-tier lessons even if an ID is guessed.
  const { data: lesson } = await supabase
    .from("lessons")
    .select(
      "id, module_id, title, description, content, image_url, video_url, resource_links, attachments, lesson_number, sort_order"
    )
    .eq("id", lessonId)
    .maybeSingle<PortalLesson>();

  if (!lesson) return null;

  const current = flat[index];
  const previous = index > 0 ? flat[index - 1] : null;
  const next = index < flat.length - 1 ? flat[index + 1] : null;

  return {
    course: overview.course,
    modules: overview.modules,
    moduleTitle: current.moduleTitle,
    moduleId: current.moduleId,
    moduleNumber: current.moduleNumber,
    lesson: {
      ...lesson,
      resource_links: lesson.resource_links ?? [],
      attachments: lesson.attachments ?? [],
    },
    completed: current.completed,
    progress: overview.progress,
    previous: previous
      ? {
          id: previous.id,
          title: previous.title,
          moduleTitle: previous.moduleTitle,
        }
      : null,
    next: next
      ? {
          id: next.id,
          title: next.title,
          moduleTitle: next.moduleTitle,
        }
      : null,
  };
}

function collectResources(
  rows: RawModuleRow[],
  course: PortalCourse
): CourseResource[] {
  const resources: CourseResource[] = [];

  for (const m of visibleModules(rows)) {
    for (const link of m.resource_links ?? []) {
      if (!link?.url) continue;
      resources.push({
        title: link.title || "Module resource",
        url: link.url,
        kind: "link",
        courseTitle: course.title,
        courseSlug: course.slug,
        moduleTitle: m.title,
        lessonTitle: null,
      });
    }
    for (const file of m.attachments ?? []) {
      if (!file?.url) continue;
      resources.push({
        title: file.title || "Module file",
        url: file.url,
        kind: "attachment",
        courseTitle: course.title,
        courseSlug: course.slug,
        moduleTitle: m.title,
        lessonTitle: null,
        mimeType: file.mime_type,
      });
    }
    for (const l of visibleLessons(m.lessons)) {
      for (const link of l.resource_links ?? []) {
        if (!link?.url) continue;
        resources.push({
          title: link.title || "Lesson resource",
          url: link.url,
          kind: "link",
          courseTitle: course.title,
          courseSlug: course.slug,
          moduleTitle: m.title,
          lessonTitle: l.title,
        });
      }
      for (const file of l.attachments ?? []) {
        if (!file?.url) continue;
        resources.push({
          title: file.title || "Lesson file",
          url: file.url,
          kind: "attachment",
          courseTitle: course.title,
          courseSlug: course.slug,
          moduleTitle: m.title,
          lessonTitle: l.title,
          mimeType: file.mime_type,
        });
      }
    }
  }

  return resources;
}

export async function getAllResources(
  supabase: SupabaseClient
): Promise<CourseResource[]> {
  const courses = await getEnrolledCourses(supabase);
  if (!courses.length) return [];

  const courseIds = courses.map((c) => c.course.id);
  const rows = await loadCourseStructureForProgress(supabase, courseIds);
  return courses.flatMap((c) =>
    collectResources(
      rows.filter((m) => m.course_id === c.course.id),
      c.course
    )
  );
}

export async function getAnnouncements(
  supabase: SupabaseClient,
  limit = 20
): Promise<PortalAnnouncement[]> {
  const { data: rows } = await supabase
    .from("announcements")
    .select("id, title, body, type, published_at, created_at")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  const announcements = rows ?? [];
  if (!announcements.length) return [];

  const { data: reads } = await supabase
    .from("announcement_reads")
    .select("announcement_id")
    .in(
      "announcement_id",
      announcements.map((a) => a.id)
    );

  const readIds = new Set((reads ?? []).map((r) => r.announcement_id));
  return announcements.map((a) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    type: a.type,
    published_at: a.published_at,
    created_at: a.created_at,
    read: readIds.has(a.id),
  }));
}

export async function getAnnouncement(
  supabase: SupabaseClient,
  id: string
): Promise<PortalAnnouncement | null> {
  const { data } = await supabase
    .from("announcements")
    .select("id, title, body, type, published_at, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  const { data: read } = await supabase
    .from("announcement_reads")
    .select("announcement_id")
    .eq("announcement_id", id)
    .maybeSingle();

  return { ...data, read: Boolean(read) } as PortalAnnouncement;
}

const SESSION_SELECT =
  "id, title, description, mentor_name, session_type, starts_at, duration_minutes, meeting_url, status, course_id";

export function sessionEndsAt(session: PortalLiveSession) {
  return (
    new Date(session.starts_at).getTime() +
    session.duration_minutes * 60_000
  );
}

export async function getUpcomingSessions(
  supabase: SupabaseClient,
  limit = 3
): Promise<PortalLiveSession[]> {
  const { data } = await supabase
    .from("live_sessions")
    .select(SESSION_SELECT)
    .neq("status", "cancelled")
    .gte(
      "starts_at",
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    )
    .order("starts_at", { ascending: true })
    .limit(limit * 3);

  const now = Date.now();
  return ((data ?? []) as PortalLiveSession[])
    .filter((s) => sessionEndsAt(s) >= now && s.status === "scheduled")
    .slice(0, limit);
}

export async function getAllSessions(
  supabase: SupabaseClient
): Promise<{ upcoming: PortalLiveSession[]; past: PortalLiveSession[] }> {
  const { data } = await supabase
    .from("live_sessions")
    .select(SESSION_SELECT)
    .order("starts_at", { ascending: false })
    .limit(60);

  const now = Date.now();
  const upcoming: PortalLiveSession[] = [];
  const past: PortalLiveSession[] = [];

  for (const session of (data ?? []) as PortalLiveSession[]) {
    if (session.status === "scheduled" && sessionEndsAt(session) >= now) {
      upcoming.push(session);
    } else {
      past.push(session);
    }
  }

  upcoming.sort(
    (a, b) =>
      new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );

  return { upcoming, past };
}

export async function getCommunities(
  supabase: SupabaseClient
): Promise<PortalCommunity[]> {
  const { data } = await supabase
    .from("communities")
    .select("id, name, description, platform, external_url, mentor_name")
    .order("created_at", { ascending: true });

  return (data ?? []) as PortalCommunity[];
}

export async function getUnreadAnnouncementCount(supabase: SupabaseClient) {
  const announcements = await getAnnouncements(supabase, 50);
  return announcements.filter((a) => !a.read).length;
}
