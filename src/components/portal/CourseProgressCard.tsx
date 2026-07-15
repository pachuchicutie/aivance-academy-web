import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import type { EnrolledCourse } from "@/lib/portal/types";
import { formatCourseProgressSummary } from "@/lib/portal/progress";
import { formatDate, tierLabel } from "@/lib/portal/format";
import { ProgressBar, TypeBadge } from "./ui";

export function courseContinueHref(course: EnrolledCourse) {
  if (course.progress.nextIncompleteLessonId) {
    return `/portal/courses/${course.course.slug}/lessons/${course.progress.nextIncompleteLessonId}`;
  }
  return `/portal/courses/${course.course.slug}`;
}

export function CourseProgressCard({
  course,
  featured = false,
}: {
  course: EnrolledCourse;
  featured?: boolean;
}) {
  const { progress } = course;
  const overallPct = progress.overallCourseProgressPercentage;
  const done =
    progress.totalCourseModules > 0 &&
    progress.completedCourseModules >= progress.totalCourseModules &&
    progress.overallCourseProgressExact >= 99.5;
  const continueHref = courseContinueHref(course);
  const tier = tierLabel(course.enrollmentTier);
  const summary = formatCourseProgressSummary(progress);

  return (
    <article
      className={
        featured ? "pt-course-card pt-course-card-featured" : "pt-course-card"
      }
      data-access="enrolled"
    >
      <div className="pt-course-thumb" aria-hidden="true">
        {course.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={course.coverImage} alt="" loading="lazy" />
        ) : (
          <span className="pt-course-thumb-fallback">
            <BookOpen size={22} />
          </span>
        )}
      </div>

      <div className="pt-course-body">
        <div className="pt-course-meta">
          {tier ? <TypeBadge label={`${tier} tier`} tone="cyan" /> : null}
          {done ? <TypeBadge label="Completed" tone="gold" /> : null}
        </div>
        <h3 className="pt-course-title">
          <Link href={`/portal/courses/${course.course.slug}`}>
            {course.course.title}
          </Link>
        </h3>

        {progress.contentPending || progress.totalCourseModules === 0 ? (
          <p className="pt-course-stats">
            Course content is being prepared. Modules will appear here when
            published.
          </p>
        ) : (
          <>
            <div className="pt-course-progress-row">
              <ProgressBar
                percent={overallPct}
                label={`${course.course.title} overall course progress`}
                tone={done ? "gold" : "cyan"}
              />
              <span className="pt-course-percent">{overallPct}%</span>
            </div>
            <p className="pt-course-stats">
              {summary}
              {progress.lastActivityAt ? (
                <span>
                  {" "}
                  · Last activity {formatDate(progress.lastActivityAt)}
                </span>
              ) : null}
            </p>
            {!done && progress.nextIncompleteLessonTitle ? (
              <p
                className="pt-course-next"
                title={progress.nextIncompleteLessonTitle}
              >
                Up next: {progress.nextIncompleteLessonTitle}
              </p>
            ) : null}
          </>
        )}
      </div>

      <div className="pt-course-action">
        <Link href={continueHref} className="pt-btn pt-btn-primary pt-btn-sm">
          {done
            ? "Review course"
            : progress.completedCourseLessons > 0
              ? "Continue course"
              : "Start course"}
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
