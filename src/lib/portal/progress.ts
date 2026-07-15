import type { CourseProgress, ModuleProgress, PortalModule } from "./types";

/**
 * Module-local progress (accordion headers only — never for course cards).
 *
 * Empty modules: 0% (never treated as complete).
 */
export function buildModuleProgress(module: PortalModule): ModuleProgress {
  const totalModuleLessons = module.lessons.length;
  const completedModuleLessons = module.lessons.filter((l) => l.completed)
    .length;
  return {
    moduleId: module.id,
    totalModuleLessons,
    completedModuleLessons,
    moduleProgressPercentage:
      totalModuleLessons > 0
        ? Math.round((completedModuleLessons / totalModuleLessons) * 100)
        : 0,
  };
}

/**
 * Exact 0–100 module progress (no rounding) for course aggregation.
 * Empty published modules contribute 0.
 */
function moduleProgressExact(module: PortalModule): number {
  const total = module.lessons.length;
  if (total === 0) return 0;
  const done = module.lessons.filter((l) => l.completed).length;
  return (done / total) * 100;
}

function isModuleCompleted(module: PortalModule): boolean {
  const total = module.lessons.length;
  if (total === 0) return false;
  return module.lessons.every((l) => l.completed);
}

function isModuleStarted(module: PortalModule): boolean {
  return module.lessons.some((l) => l.completed);
}

/**
 * Canonical OVERALL COURSE progress — module-weighted.
 *
 * Business rule (product requirement):
 *   overall = (sum of each published module's progress %) / total published modules
 *
 * Each published module has equal weight.
 * Empty published modules contribute 0% and remain in the denominator.
 * Draft/hidden/deleted modules must already be excluded from `courseModules`.
 *
 * This is NOT lessonsCompleted / lessonsTotal (that is module-level or supporting context).
 */
export function buildCourseProgress(
  courseModules: PortalModule[],
  completedIds: Set<string>,
  progressDates: Map<string, string>,
  nextFromModules?: PortalModule[],
  courseId?: string
): CourseProgress {
  // Ensure lesson.completed flags match the completion set when callers pass raw trees.
  const modules: PortalModule[] = courseModules.map((m) => ({
    ...m,
    lessons: m.lessons.map((l) => ({
      ...l,
      completed: completedIds.has(l.id) || l.completed,
    })),
  }));

  const totalCourseModules = modules.length;
  let sumModuleProgress = 0;
  let completedCourseModules = 0;
  let startedCourseModules = 0;

  for (const mod of modules) {
    sumModuleProgress += moduleProgressExact(mod);
    if (isModuleCompleted(mod)) completedCourseModules += 1;
    if (isModuleStarted(mod)) startedCourseModules += 1;
  }

  const overallCourseProgressExact =
    totalCourseModules > 0 ? sumModuleProgress / totalCourseModules : 0;

  // Clamp and present safely
  const clamped = Math.min(100, Math.max(0, overallCourseProgressExact));
  const overallCourseProgressPercentage = Math.round(clamped);

  const orderedCourseLessons = modules.flatMap((m) => m.lessons);
  const totalCourseLessons = orderedCourseLessons.length;
  const completedCourseLessons = orderedCourseLessons.filter((l) =>
    completedIds.has(l.id)
  ).length;

  // Next incomplete lesson: full ordered sequence (skip empty modules naturally).
  const nextPool = (nextFromModules ?? modules).flatMap((m) =>
    m.lessons.map((l) => ({
      ...l,
      completed: completedIds.has(l.id) || l.completed,
    }))
  );
  const next = nextPool.find((l) => !completedIds.has(l.id) && !l.completed) ??
    nextPool.find((l) => !completedIds.has(l.id)) ??
    null;

  let lastActivityAt: string | null = null;
  for (const lesson of orderedCourseLessons) {
    const at = progressDates.get(lesson.id);
    if (at && (!lastActivityAt || at > lastActivityAt)) {
      lastActivityAt = at;
    }
  }

  return {
    courseId,
    totalCourseModules,
    completedCourseModules,
    startedCourseModules,
    totalCourseLessons,
    completedCourseLessons,
    overallCourseProgressPercentage,
    overallCourseProgressExact: clamped,
    courseProgressPercentage: overallCourseProgressPercentage,
    nextIncompleteLessonId: next?.id ?? null,
    nextIncompleteLessonTitle: next?.title ?? null,
    lastActivityAt,
    contentPending: totalCourseModules === 0,
  };
}

/**
 * Aggregate module-weighted progress across multiple enrolled courses.
 * Every published module across all courses has equal weight.
 */
export function aggregateEnrolledCourseProgress(
  courses: Array<{ progress: CourseProgress }>
): {
  overallProgressPercentage: number;
  overallProgressExact: number;
  totalModules: number;
  completedModules: number;
  completedLessons: number;
  totalLessons: number;
  contentPending: boolean;
} {
  let sumModuleProgress = 0;
  let totalModules = 0;
  let completedModules = 0;
  let completedLessons = 0;
  let totalLessons = 0;

  for (const c of courses) {
    const p = c.progress;
    totalModules += p.totalCourseModules;
    completedModules += p.completedCourseModules;
    completedLessons += p.completedCourseLessons;
    totalLessons += p.totalCourseLessons;
    // exact * modules = sum of that course's module percentages
    sumModuleProgress += p.overallCourseProgressExact * p.totalCourseModules;
  }

  const exact = totalModules > 0 ? sumModuleProgress / totalModules : 0;
  const clamped = Math.min(100, Math.max(0, exact));

  return {
    overallProgressPercentage: Math.round(clamped),
    overallProgressExact: clamped,
    totalModules,
    completedModules,
    completedLessons,
    totalLessons,
    contentPending: totalModules === 0,
  };
}

/** Human supporting copy for course-level cards. */
export function formatCourseProgressSummary(progress: CourseProgress): string {
  if (progress.contentPending || progress.totalCourseModules === 0) {
    return "Course content is being prepared.";
  }
  const mods = `${progress.completedCourseModules} of ${progress.totalCourseModules} module${
    progress.totalCourseModules === 1 ? "" : "s"
  } completed`;
  const lessons =
    progress.completedCourseLessons === 1
      ? "1 lesson completed"
      : `${progress.completedCourseLessons} lessons completed`;
  return `${mods} · ${lessons}`;
}
