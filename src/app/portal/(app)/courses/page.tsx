import Link from "next/link";
import { BookOpen, Lock, Sparkles } from "lucide-react";
import { getStudentCourseLibrary } from "@/lib/portal/course-access";
import { getEnrolledCourses, getPortalContext } from "@/lib/portal/queries";
import { CourseLibraryCard } from "@/components/portal/CourseLibraryCard";
import { EmptyState, PageHeader, TypeBadge } from "@/components/portal/ui";
import type { CourseLibraryItem } from "@/lib/portal/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Courses | AIvanza Academy",
};

function isCompleted(item: CourseLibraryItem) {
  const p = item.progress;
  if (item.accessState !== "enrolled_accessible" || !p) return false;
  // Module-weighted: all published modules must be 100% (empty modules never count as complete).
  return (
    p.totalCourseModules > 0 &&
    p.completedCourseModules >= p.totalCourseModules &&
    p.overallCourseProgressExact >= 99.5
  );
}

export default async function MyCoursesPage() {
  const { supabase, profile, membership } = await getPortalContext();
  const enrolled = await getEnrolledCourses(supabase);
  const library = await getStudentCourseLibrary(
    supabase,
    profile.tier,
    enrolled
  );

  const continueLearning = library.filter(
    (c) => c.accessState === "enrolled_accessible" && !isCompleted(c)
  );
  const completed = library.filter(isCompleted);
  const eligible = library.filter(
    (c) => c.accessState === "eligible_not_enrolled"
  );
  const locked = library.filter((c) => c.accessState === "locked_by_tier");
  const unavailable = library.filter((c) => c.accessState === "unavailable");

  const hasAny = library.length > 0;

  // Canonical plan label from membership_tiers via resolveStudentMembershipPlan.
  // Never invent "Your Current Plan" or similar placeholders.
  const planLabel = membership?.planLabel ?? null;

  return (
    <>
      <PageHeader
        eyebrow="Learning"
        title="My Courses"
        description="Continue your enrolled courses and explore programs available on other membership tiers."
      />

      {!hasAny ? (
        <EmptyState
          icon={BookOpen}
          title="No courses published yet"
          message="When academy courses are published, they will appear here, including plans you can upgrade into."
          action={{ href: "/portal/support", label: "Contact support" }}
        />
      ) : (
        <>
          {continueLearning.length > 0 ? (
            <section
              className="pt-panel"
              aria-labelledby="continue-learning-heading"
            >
              <h2 id="continue-learning-heading" className="pt-panel-title">
                Continue learning
              </h2>
              <div className="pt-panel-body">
                <p className="pt-section-note">
                  Your active enrolled courses with real course-wide progress.
                </p>
                <div className="pt-course-list">
                  {continueLearning.map((item) => (
                    <CourseLibraryCard
                      key={item.course.id}
                      item={item}
                      studentPlanLabel={planLabel}
                      studentTier={profile.tier}
                      featured={
                        continueLearning.length === 1 && locked.length === 0
                      }
                    />
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {eligible.length > 0 ? (
            <section className="pt-panel" aria-labelledby="eligible-heading">
              <h2 id="eligible-heading" className="pt-panel-title">
                <span className="pt-panel-title-row">
                  <Sparkles size={16} aria-hidden="true" />
                  Available in your plan
                </span>
              </h2>
              <div className="pt-panel-body">
                <p className="pt-section-note">
                  These courses match your membership tier. Contact support if
                  you need enrollment activated.
                </p>
                <div className="pt-course-list">
                  {eligible.map((item) => (
                    <CourseLibraryCard
                      key={item.course.id}
                      item={item}
                      studentPlanLabel={planLabel}
                      studentTier={profile.tier}
                    />
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {locked.length > 0 ? (
            <section
              className="pt-panel pt-panel-locked-section"
              aria-labelledby="explore-higher-heading"
            >
              <div className="pt-locked-section-head">
                <div className="pt-locked-section-icon" aria-hidden="true">
                  <Lock size={18} strokeWidth={2.25} />
                </div>
                <div className="pt-locked-section-copy">
                  <div className="pt-locked-section-title-row">
                    <h2 id="explore-higher-heading" className="pt-panel-title">
                      Explore Higher-Tier Courses
                    </h2>
                    {planLabel ? (
                      <TypeBadge
                        label={`Current plan: ${planLabel}`}
                        tone="muted"
                      />
                    ) : (
                      <TypeBadge
                        label="Current membership tier unavailable"
                        tone="muted"
                      />
                    )}
                  </div>
                  <p className="pt-section-note pt-section-note-locked">
                    {planLabel ? (
                      <>
                        These programs are not included in your{" "}
                        <strong>{planLabel}</strong>. Upgrade to an eligible
                        plan to unlock their modules, lessons, and resources.
                      </>
                    ) : (
                      <>
                        We couldn&apos;t confirm your current plan. Please{" "}
                        <Link href="/portal/support">contact support</Link> if
                        this looks wrong. These courses remain locked until an
                        eligible membership is active.
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="pt-panel-body">
                <div className="pt-locked-list">
                  {locked.map((item) => (
                    <CourseLibraryCard
                      key={item.course.id}
                      item={item}
                      studentPlanLabel={planLabel}
                      studentTier={profile.tier}
                    />
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {completed.length > 0 ? (
            <section className="pt-panel">
              <h2 className="pt-panel-title">Completed</h2>
              <div className="pt-panel-body">
                <div className="pt-course-list">
                  {completed.map((item) => (
                    <CourseLibraryCard
                      key={item.course.id}
                      item={item}
                      studentPlanLabel={planLabel}
                      studentTier={profile.tier}
                    />
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {unavailable.length > 0 ? (
            <section className="pt-panel">
              <h2 className="pt-panel-title">Unavailable</h2>
              <div className="pt-panel-body">
                <div className="pt-course-list">
                  {unavailable.map((item) => (
                    <CourseLibraryCard
                      key={item.course.id}
                      item={item}
                      studentPlanLabel={planLabel}
                      studentTier={profile.tier}
                    />
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {continueLearning.length === 0 &&
          completed.length === 0 &&
          eligible.length === 0 &&
          locked.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No active course yet"
              message="You don't have an enrolled course yet. Your course will appear under Continue learning after payment and access are confirmed."
              action={{ href: "/portal/support", label: "Contact support" }}
            />
          ) : null}
        </>
      )}
    </>
  );
}
