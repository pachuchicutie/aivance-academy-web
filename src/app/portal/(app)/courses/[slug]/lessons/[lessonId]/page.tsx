import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Download,
  ExternalLink,
} from "lucide-react";
import { getLessonContext, getPortalContext } from "@/lib/portal/queries";
import { isEmptyHtml, sanitizeHtml } from "@/lib/portal/sanitize";
import { resolveVideo } from "@/lib/portal/video";
import { MarkCompleteButton } from "@/components/portal/MarkCompleteButton";
import {
  CourseOutline,
  CourseOutlineMobile,
} from "@/components/portal/course/CourseOutline";

export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}) {
  const { slug, lessonId } = await params;
  const { supabase } = await getPortalContext();
  const context = await getLessonContext(supabase, slug, lessonId);

  if (!context) {
    notFound();
  }

  const {
    course,
    modules,
    moduleTitle,
    moduleId,
    moduleNumber,
    lesson,
    completed,
    progress,
    previous,
    next,
  } = context;
  const video = resolveVideo(lesson.video_url);
  const content = sanitizeHtml(lesson.content);
  const hasContent = !isEmptyHtml(content);

  return (
    <div className="pt-course-player">
      <div className="pt-course-player-main">
        <nav className="pt-breadcrumb pt-breadcrumb-rich" aria-label="Breadcrumb">
          <Link
            href={`/portal/courses/${course.slug}`}
            className="pt-breadcrumb-back"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Back to course
          </Link>
          <div className="pt-breadcrumb-trail">
            <Link href="/portal/courses">My Courses</Link>
            <ChevronRight size={13} aria-hidden="true" />
            <Link href={`/portal/courses/${course.slug}`} title={course.title}>
              {course.title}
            </Link>
            <ChevronRight size={13} aria-hidden="true" />
            <span className="pt-breadcrumb-muted" title={moduleTitle}>
              {moduleTitle}
            </span>
            <ChevronRight size={13} aria-hidden="true" />
            <span aria-current="page" title={lesson.title}>
              {lesson.title}
            </span>
          </div>
        </nav>

        <article className="pt-lesson-surface">
          <header className="pt-lesson-header">
            <div className="pt-lesson-header-meta">
              <div className="pt-lesson-header-meta-left">
                <span className="pt-eyebrow">
                  Module {moduleNumber} · {moduleTitle}
                </span>
              </div>
              <div className="pt-lesson-header-meta-right">
                {/* Status from real completion only — locked lessons never reach this page */}
                {completed ? (
                  <span
                    className="pt-lesson-status-pill"
                    data-status="completed"
                    data-done="true"
                  >
                    <CheckCircle2 size={13} strokeWidth={2.25} aria-hidden="true" />
                    Completed
                  </span>
                ) : (
                  <span
                    className="pt-lesson-status-pill"
                    data-status="in_progress"
                  >
                    <CircleDot size={13} strokeWidth={2.25} aria-hidden="true" />
                    In progress
                  </span>
                )}
              </div>
            </div>
            <h1>{lesson.title}</h1>
            {lesson.description ? (
              <p className="pt-lesson-objective">{lesson.description}</p>
            ) : null}
          </header>

          {video?.kind === "youtube" || video?.kind === "vimeo" ? (
            <div className="pt-video-frame">
              <iframe
                src={video.src}
                title={`Video: ${lesson.title}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          ) : video?.kind === "file" ? (
            <div className="pt-video-frame">
              <video src={video.src} controls preload="metadata" />
            </div>
          ) : null}

          {lesson.image_url && !video ? (
            <div className="pt-lesson-image">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lesson.image_url} alt="" loading="lazy" />
            </div>
          ) : null}

          {hasContent ? (
            <div
              className="pt-lesson-content"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ) : !video ? (
            <p className="pt-lesson-placeholder">
              This lesson&apos;s content hasn&apos;t been published yet. Check
              back soon or ask in your community.
            </p>
          ) : null}

          {video?.kind === "link" ? (
            <a
              href={video.href}
              target="_blank"
              rel="noopener noreferrer"
              className="pt-btn pt-btn-ghost"
            >
              <ExternalLink size={15} aria-hidden="true" />
              Open lesson video
            </a>
          ) : null}

          {lesson.resource_links.length > 0 ||
          lesson.attachments.length > 0 ? (
            <section className="pt-lesson-resources">
              <h2>Lesson resources</h2>
              <ul className="pt-resource-list">
                {lesson.resource_links.map((link, index) => (
                  <li key={`link-${index}`}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pt-resource-link"
                    >
                      <ExternalLink size={15} aria-hidden="true" />
                      <span className="pt-resource-copy">
                        <strong>{link.title || "Resource link"}</strong>
                      </span>
                    </a>
                  </li>
                ))}
                {lesson.attachments.map((file, index) => (
                  <li key={`file-${index}`}>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pt-resource-link"
                      download
                    >
                      <Download size={15} aria-hidden="true" />
                      <span className="pt-resource-copy">
                        <strong>{file.title || "Attachment"}</strong>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </article>

        {/* Three-region footer: prev | centered complete | next */}
        <footer
          className="pt-lesson-footer"
          data-has-prev={previous ? "true" : "false"}
          data-has-next={next ? "true" : "false"}
        >
          <div className="pt-lesson-nav-block">
            <div className="pt-lesson-nav-side is-prev">
              {previous ? (
                <Link
                  href={`/portal/courses/${course.slug}/lessons/${previous.id}`}
                  className="pt-lesson-nav-card is-prev"
                >
                  <span className="pt-lesson-nav-dir">
                    <ArrowLeft size={14} aria-hidden="true" />
                    Previous
                  </span>
                  <strong title={previous.title}>{previous.title}</strong>
                  <em title={previous.moduleTitle}>{previous.moduleTitle}</em>
                </Link>
              ) : null}
            </div>

            <div className="pt-lesson-complete-slot">
              <MarkCompleteButton
                lessonId={lesson.id}
                courseSlug={course.slug}
                completed={completed}
              />
            </div>

            <div className="pt-lesson-nav-side is-next">
              {next ? (
                <Link
                  href={`/portal/courses/${course.slug}/lessons/${next.id}`}
                  className="pt-lesson-nav-card is-next"
                >
                  <span className="pt-lesson-nav-dir">
                    Next
                    <ArrowRight size={14} aria-hidden="true" />
                  </span>
                  <strong title={next.title}>{next.title}</strong>
                  <em title={next.moduleTitle}>{next.moduleTitle}</em>
                </Link>
              ) : (
                <Link
                  href={`/portal/courses/${course.slug}`}
                  className="pt-lesson-nav-card is-next is-course-return"
                >
                  <span className="pt-lesson-nav-dir">
                    Return to course
                    <ArrowRight size={14} aria-hidden="true" />
                  </span>
                  <strong>Course overview</strong>
                  <em title={course.title}>{course.title}</em>
                </Link>
              )}
            </div>
          </div>
        </footer>
      </div>

      <aside className="pt-course-player-outline" aria-label="Course outline">
        <CourseOutline
          courseTitle={course.title}
          courseSlug={course.slug}
          modules={modules}
          progress={progress}
          currentLessonId={lesson.id}
          currentModuleId={moduleId}
        />
      </aside>

      <CourseOutlineMobile
        courseTitle={course.title}
        courseSlug={course.slug}
        modules={modules}
        progress={progress}
        currentLessonId={lesson.id}
        currentModuleId={moduleId}
      />
    </div>
  );
}
