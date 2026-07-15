import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  FolderOpen,
  Layers3,
  LifeBuoy,
  Lock,
  PlayCircle,
} from "lucide-react";
import { resolveCourseAccessForStudent } from "@/lib/portal/course-access";
import {
  getCourseOverview,
  getEnrolledCourses,
  getPortalContext,
} from "@/lib/portal/queries";
import { formatCourseProgressSummary } from "@/lib/portal/progress";
import { tierLabel } from "@/lib/portal/format";
import { EmptyState, ProgressBar, TypeBadge } from "@/components/portal/ui";
import { CourseModulesList } from "@/components/portal/course/CourseModulesList";

export const dynamic = "force-dynamic";

export default async function CourseOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { supabase, profile } = await getPortalContext();
  const enrolled = await getEnrolledCourses(supabase);
  const access = await resolveCourseAccessForStudent(
    supabase,
    slug,
    profile.tier,
    enrolled
  );

  if (!access) {
    notFound();
  }

  // Locked / eligible preview — public metadata only, no modules/lessons.
  if (access.accessState !== "enrolled_accessible") {
    const locked = access.accessState === "locked_by_tier";
    return (
      <div className="co-page">
        <nav className="co-back" aria-label="Breadcrumb">
          <Link href="/portal/courses" className="co-back-link">
            <ChevronLeft size={16} aria-hidden="true" />
            Back to My Courses
          </Link>
        </nav>

        <section className="co-hero co-hero-locked">
          <div className="co-hero-inner">
            <div className="co-hero-badges">
              <TypeBadge
                label={
                  locked
                    ? "Locked"
                    : access.accessState === "eligible_not_enrolled"
                      ? "In your plan"
                      : "Unavailable"
                }
                tone={locked ? "muted" : "cyan"}
              />
              <TypeBadge label={access.requiredTierSummary} tone="gold" />
            </div>
            <h1 className="co-hero-title">{access.course.title}</h1>
            {access.course.description ? (
              <p className="co-hero-desc">{access.course.description}</p>
            ) : null}

            <div className="pt-locked-callout" role="status">
              <Lock size={18} aria-hidden="true" />
              <div>
                <strong>
                  {locked
                    ? "This course requires a different membership tier"
                    : access.accessState === "eligible_not_enrolled"
                      ? "Eligible with your plan. Enrollment is not active yet."
                      : "This course is not currently available"}
                </strong>
                <p>
                  {locked
                    ? `${access.requiredTierSummary}. Modules, lessons, and resources stay protected until you upgrade.`
                    : access.accessState === "eligible_not_enrolled"
                      ? "Contact support to activate enrollment for this course. Content unlocks after access is confirmed."
                      : "Check back later or contact support for more information."}
                </p>
              </div>
            </div>

            <div className="co-hero-actions">
              <Link href="/portal/courses" className="pt-btn pt-btn-ghost">
                Back to My Courses
              </Link>
              <Link href="/portal/support" className="pt-btn pt-btn-soft">
                <LifeBuoy size={16} aria-hidden="true" />
                Contact support
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const overview = await getCourseOverview(supabase, slug);
  if (!overview) {
    notFound();
  }

  const { course, modules, progress, resources, enrollmentTier } = overview;
  const done =
    progress.totalCourseModules > 0 &&
    progress.completedCourseModules >= progress.totalCourseModules &&
    progress.overallCourseProgressExact >= 99.5;
  const continueHref = progress.nextIncompleteLessonId
    ? `/portal/courses/${course.slug}/lessons/${progress.nextIncompleteLessonId}`
    : done
      ? `/portal/courses/${course.slug}`
      : null;
  const tier = tierLabel(enrollmentTier);
  const overallPct = progress.overallCourseProgressPercentage;
  const summary = formatCourseProgressSummary(progress);

  const currentModuleId =
    modules.find((m) =>
      m.lessons.some((l) => l.id === progress.nextIncompleteLessonId)
    )?.id ??
    modules.find(
      (m) =>
        m.lessons.length > 0 && !m.lessons.every((l) => l.completed)
    )?.id ??
    null;

  return (
    <div className="co-page">
      <nav className="co-back" aria-label="Breadcrumb">
        <Link href="/portal/courses" className="co-back-link">
          <ChevronLeft size={16} aria-hidden="true" />
          Back to My Courses
        </Link>
      </nav>

      <section className="co-hero" aria-labelledby="co-course-title">
        <div className="co-hero-inner">
          <div className="co-hero-main">
            <div className="co-hero-badges">
              {tier ? (
                <TypeBadge label={`${tier} tier`} tone="cyan" />
              ) : null}
              {done ? <TypeBadge label="Completed" tone="gold" /> : null}
            </div>

            <h1 id="co-course-title" className="co-hero-title">
              {course.title}
            </h1>
            {course.description ? (
              <p className="co-hero-desc">{course.description}</p>
            ) : null}

            {progress.contentPending || progress.totalCourseModules === 0 ? (
              <p className="co-hero-stats">Course content is being prepared.</p>
            ) : (
              <div className="co-progress-block">
                <div className="co-progress-label-row">
                  <span className="co-progress-label">Overall progress</span>
                  <span className="co-progress-pct">{overallPct}%</span>
                </div>
                <ProgressBar
                  percent={overallPct}
                  label={`${course.title} overall course progress`}
                  tone={done ? "gold" : "cyan"}
                />
                <p className="co-hero-stats">{summary}</p>
              </div>
            )}

            {!progress.contentPending && progress.totalCourseModules > 0 ? (
              <div className="co-metric-row" aria-label="Course summary">
                <div className="co-metric">
                  <Layers3 size={15} aria-hidden="true" />
                  <span>
                    <strong>{progress.totalCourseModules}</strong> modules
                  </span>
                </div>
                <div className="co-metric">
                  <CheckCircle2 size={15} aria-hidden="true" />
                  <span>
                    <strong>{progress.completedCourseModules}</strong> completed
                  </span>
                </div>
                <div className="co-metric">
                  <BookOpen size={15} aria-hidden="true" />
                  <span>
                    <strong>{progress.completedCourseLessons}</strong> lessons
                    done
                  </span>
                </div>
              </div>
            ) : null}

            {continueHref && !done ? (
              <div className="co-hero-actions">
                <Link href={continueHref} className="pt-btn pt-btn-primary">
                  {progress.completedCourseLessons > 0
                    ? "Continue learning"
                    : "Start course"}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
                {progress.nextIncompleteLessonTitle ? (
                  <p className="co-up-next" title={progress.nextIncompleteLessonTitle}>
                    <PlayCircle size={14} aria-hidden="true" />
                    Up next: {progress.nextIncompleteLessonTitle}
                  </p>
                ) : null}
              </div>
            ) : done ? (
              <div className="co-hero-actions">
                <Link
                  href={
                    modules.find((m) => m.lessons[0])?.lessons[0]
                      ? `/portal/courses/${course.slug}/lessons/${
                          modules.find((m) => m.lessons[0])!.lessons[0].id
                        }`
                      : `/portal/courses/${course.slug}`
                  }
                  className="pt-btn pt-btn-soft"
                >
                  Review course
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {modules.length === 0 ? (
        <section className="co-modules-panel">
          <EmptyState
            icon={BookOpen}
            message="Modules for this course will appear here once they're published for your tier."
            compact
          />
        </section>
      ) : (
        <CourseModulesList
          courseSlug={course.slug}
          modules={modules}
          currentModuleId={currentModuleId}
        />
      )}

      {resources.length > 0 ? (
        <section className="co-resources" aria-labelledby="co-resources-heading">
          <div className="co-resources-head">
            <h2 id="co-resources-heading">Course resources</h2>
            <p>
              {Math.min(resources.length, 12)} resource
              {resources.length === 1 ? "" : "s"}
            </p>
          </div>
          <ul className="co-resource-list">
            {resources.slice(0, 12).map((resource, index) => (
              <li key={`${resource.url}-${index}`}>
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="co-resource-link"
                >
                  <FolderOpen size={16} aria-hidden="true" />
                  <span className="co-resource-copy">
                    <strong>{resource.title}</strong>
                    <span>
                      {[resource.moduleTitle, resource.lessonTitle]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
