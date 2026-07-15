import Link from "next/link";
import { ArrowRight, BookOpen, Sparkles } from "lucide-react";
import type { CourseLibraryItem, EnrolledCourse } from "@/lib/portal/types";
import { formatDate, tierLabel } from "@/lib/portal/format";
import { TypeBadge } from "./ui";
import { courseContinueHref, CourseProgressCard } from "./CourseProgressCard";
import { LockedByTierCard } from "./LockedByTierCard";

function toEnrolled(item: CourseLibraryItem): EnrolledCourse {
  const p = item.progress;
  return {
    enrollmentId: item.enrollmentId ?? item.course.id,
    enrollmentTier: (item.enrollmentTier ??
      "basic") as EnrolledCourse["enrollmentTier"],
    startedAt: "",
    course: item.course,
    coverImage: item.coverImage,
    progress: p ?? {
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
    },
  };
}

export function CourseLibraryCard({
  item,
  featured = false,
  studentTier = null,
  studentPlanLabel = null,
}: {
  item: CourseLibraryItem;
  featured?: boolean;
  studentTier?: string | null;
  studentPlanLabel?: string | null;
}) {
  if (item.accessState === "enrolled_accessible" && item.progress) {
    return (
      <CourseProgressCard course={toEnrolled(item)} featured={featured} />
    );
  }

  if (item.accessState === "eligible_not_enrolled") {
    return (
      <article className="pt-course-card pt-course-card-eligible">
        <div className="pt-course-thumb" aria-hidden="true">
          {item.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.coverImage} alt="" loading="lazy" />
          ) : (
            <span className="pt-course-thumb-fallback">
              <BookOpen size={22} />
            </span>
          )}
        </div>
        <div className="pt-course-body">
          <div className="pt-course-meta">
            <TypeBadge label="In your plan" tone="cyan" />
            <TypeBadge label={item.requiredTierSummary} tone="muted" />
          </div>
          <h3 className="pt-course-title">{item.course.title}</h3>
          {item.course.description ? (
            <p className="pt-course-blurb">{item.course.description}</p>
          ) : (
            <p className="pt-course-stats">
              Eligible with your membership. Contact support to activate access.
            </p>
          )}
        </div>
        <div className="pt-course-action">
          <Link href="/portal/support" className="pt-btn pt-btn-soft pt-btn-sm">
            <Sparkles size={15} aria-hidden="true" />
            Request access
          </Link>
        </div>
      </article>
    );
  }

  if (
    item.accessState === "locked_by_tier" ||
    item.accessState === "unavailable"
  ) {
    return (
      <LockedByTierCard
        item={item}
        studentPlanLabel={studentPlanLabel}
        studentTier={studentTier}
      />
    );
  }

  return null;
}

export { courseContinueHref, CourseProgressCard };
export type { EnrolledCourse };

export function enrolledCardFromLibrary(
  item: CourseLibraryItem
): EnrolledCourse | null {
  if (item.accessState !== "enrolled_accessible" || !item.progress) return null;
  return toEnrolled(item);
}

export function formatLibraryTier(item: CourseLibraryItem) {
  return item.eligibleTiers
    .map((t) => t.label || tierLabel(t.code) || t.code)
    .join(", ");
}

export function libraryContinueHref(item: CourseLibraryItem) {
  if (item.accessState !== "enrolled_accessible" || !item.progress) return null;
  return courseContinueHref(toEnrolled(item));
}

export function formatLastActivity(item: CourseLibraryItem) {
  const at = item.progress?.lastActivityAt;
  return at ? formatDate(at) : null;
}

export function LibraryContinueButton({ item }: { item: CourseLibraryItem }) {
  const href = libraryContinueHref(item);
  if (!href || !item.progress) return null;
  const p = item.progress;
  const done =
    p.totalCourseModules > 0 &&
    p.completedCourseModules >= p.totalCourseModules &&
    p.overallCourseProgressExact >= 99.5;
  return (
    <Link href={href} className="pt-btn pt-btn-primary pt-btn-sm">
      {done
        ? "Review course"
        : p.completedCourseLessons > 0
          ? "Continue course"
          : "Start course"}
      <ArrowRight size={15} aria-hidden="true" />
    </Link>
  );
}
