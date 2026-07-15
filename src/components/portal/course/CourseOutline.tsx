"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Circle,
  FileText,
  FolderOpen,
  List,
  X,
} from "lucide-react";
import { buildModuleProgress } from "@/lib/portal/progress";
import type { CourseProgress, PortalModule } from "@/lib/portal/types";
import { ProgressBar } from "@/components/portal/ui";

type OutlineModule = PortalModule & {
  totalModuleLessons: number;
  completedModuleLessons: number;
  moduleProgressPercentage: number;
  isComplete: boolean;
  isCurrent: boolean;
};

function storageKey(courseSlug: string) {
  return `aivance.course-outline.${courseSlug}`;
}

function readStoredOpen(courseSlug: string, fallback: string[]): Set<string> {
  if (typeof window === "undefined") return new Set(fallback);
  try {
    const raw = localStorage.getItem(storageKey(courseSlug));
    if (!raw) return new Set(fallback);
    const parsed = JSON.parse(raw) as { open?: string[] };
    // Respect an intentional empty list (Collapse all / user closed every module).
    if (Array.isArray(parsed.open)) {
      return new Set(parsed.open);
    }
  } catch {
    // ignore
  }
  return new Set(fallback);
}

export function CourseOutline({
  courseTitle,
  courseSlug,
  modules,
  progress,
  currentLessonId,
  currentModuleId,
  variant = "sidebar",
  onNavigate,
}: {
  courseTitle: string;
  courseSlug: string;
  modules: PortalModule[];
  progress: CourseProgress;
  currentLessonId: string;
  currentModuleId: string;
  variant?: "sidebar" | "drawer";
  onNavigate?: () => void;
}) {
  const baseId = useId();
  const listRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  const outlineModules: OutlineModule[] = useMemo(
    () =>
      modules.map((mod) => {
        const mp = buildModuleProgress(mod);
        return {
          ...mod,
          totalModuleLessons: mp.totalModuleLessons,
          completedModuleLessons: mp.completedModuleLessons,
          moduleProgressPercentage: mp.moduleProgressPercentage,
          isComplete:
            mp.totalModuleLessons > 0 &&
            mp.completedModuleLessons >= mp.totalModuleLessons,
          isCurrent: mod.id === currentModuleId,
        };
      }),
    [modules, currentModuleId]
  );

  const seedIds = useMemo(() => {
    const seed = [currentModuleId];
    const firstIncomplete = outlineModules.find((m) => !m.isComplete);
    if (firstIncomplete) seed.push(firstIncomplete.id);
    return seed;
  }, [currentModuleId, outlineModules]);

  // User-controlled open modules. Current module is opened by default and
  // when navigating into a new module, but the student can collapse it.
  const [openIds, setOpenIds] = useState<Set<string>>(() =>
    readStoredOpen(courseSlug, seedIds)
  );
  const prevModuleIdRef = useRef(currentModuleId);

  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey(courseSlug),
        JSON.stringify({ open: Array.from(openIds) })
      );
    } catch {
      // ignore storage failures
    }
  }, [openIds, courseSlug]);

  // When the student moves into a different module, open that module once.
  // Do not re-force open on every render (so Collapse works on the current one).
  useEffect(() => {
    if (prevModuleIdRef.current === currentModuleId) return;
    prevModuleIdRef.current = currentModuleId;
    setOpenIds((prev) => {
      if (prev.has(currentModuleId)) return prev;
      const next = new Set(prev);
      next.add(currentModuleId);
      return next;
    });
  }, [currentModuleId]);

  // Scroll active lesson into view inside the outline scroller only.
  useEffect(() => {
    if (!openIds.has(currentModuleId)) return;
    const el = activeRef.current;
    const root = listRef.current;
    if (!el || !root) return;
    const elTop = el.offsetTop;
    const elBottom = elTop + el.offsetHeight;
    const viewTop = root.scrollTop;
    const viewBottom = viewTop + root.clientHeight;
    if (elTop < viewTop + 24 || elBottom > viewBottom - 24) {
      root.scrollTo({
        top: Math.max(0, elTop - root.clientHeight * 0.35),
        behavior: "smooth",
      });
    }
  }, [currentLessonId, openIds, currentModuleId]);

  const toggle = useCallback((id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expandAll = () => {
    setOpenIds(new Set(outlineModules.map((m) => m.id)));
  };

  const collapseAll = () => {
    setOpenIds(new Set());
  };

  const showBulk = outlineModules.length >= 3;

  return (
    <div className="pt-course-outline" data-variant={variant}>
      <header className="pt-outline-header">
        <div className="pt-outline-header-top">
          <span className="pt-outline-kicker">
            <List size={14} aria-hidden="true" />
            Course outline
          </span>
          {variant === "drawer" && onNavigate ? (
            <button
              type="button"
              className="pt-outline-close"
              onClick={onNavigate}
              aria-label="Close course outline"
            >
              <X size={16} />
            </button>
          ) : null}
        </div>
        <h2 className="pt-outline-course-title" title={courseTitle}>
          {courseTitle}
        </h2>
        <div className="pt-outline-progress">
          <div className="pt-outline-progress-row">
            <ProgressBar
              percent={progress.overallCourseProgressPercentage}
              label={`${courseTitle} overall course progress`}
              tone={
                progress.totalCourseModules > 0 &&
                progress.completedCourseModules >= progress.totalCourseModules &&
                progress.overallCourseProgressExact >= 99.5
                  ? "gold"
                  : "cyan"
              }
            />
            <span className="pt-outline-percent">
              {progress.overallCourseProgressPercentage}%
            </span>
          </div>
          <p className="pt-outline-stats">
            {progress.contentPending || progress.totalCourseModules === 0
              ? "Course content is being prepared."
              : `${progress.completedCourseModules} of ${progress.totalCourseModules} module${
                  progress.totalCourseModules === 1 ? "" : "s"
                } completed${
                  progress.completedCourseLessons > 0
                    ? ` · ${progress.completedCourseLessons} lesson${
                        progress.completedCourseLessons === 1 ? "" : "s"
                      } completed`
                    : ""
                }`}
          </p>
        </div>
        {showBulk ? (
          <div className="pt-outline-bulk" role="group" aria-label="Outline controls">
            <button
              type="button"
              className="pt-outline-bulk-btn"
              onClick={expandAll}
            >
              Expand all
            </button>
            <button
              type="button"
              className="pt-outline-bulk-btn"
              onClick={collapseAll}
            >
              Collapse all
            </button>
          </div>
        ) : null}
      </header>

      <div className="pt-outline-scroll" ref={listRef}>
        {outlineModules.length === 0 ? (
          <p className="pt-outline-empty">
            No published modules yet for this course.
          </p>
        ) : (
          outlineModules.map((mod) => {
            const open = openIds.has(mod.id);
            const panelId = `${baseId}-panel-${mod.id}`;
            const headerId = `${baseId}-header-${mod.id}`;
            return (
              <section
                key={mod.id}
                className="pt-outline-module-card"
                data-current={mod.isCurrent ? "true" : "false"}
                data-complete={mod.isComplete ? "true" : "false"}
                data-open={open ? "true" : "false"}
              >
                <h3 className="pt-outline-module-heading">
                  <button
                    type="button"
                    id={headerId}
                    className="pt-outline-module-trigger"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => toggle(mod.id)}
                  >
                    <span
                      className="pt-outline-chevron"
                      data-open={open ? "true" : "false"}
                      aria-hidden="true"
                    >
                      <ChevronDown size={16} strokeWidth={2.25} />
                    </span>
                    <span
                      className="pt-outline-module-badge"
                      data-complete={mod.isComplete ? "true" : "false"}
                      aria-hidden="true"
                    >
                      {mod.isComplete ? (
                        <CheckCircle2 size={15} />
                      ) : (
                        mod.module_number
                      )}
                    </span>
                    <span className="pt-outline-module-copy">
                      <span className="pt-outline-module-label">
                        <span>Module {mod.module_number}</span>
                        {mod.isCurrent ? (
                          <em className="pt-outline-current-tag">Current</em>
                        ) : null}
                        {mod.isComplete ? (
                          <em className="pt-outline-done-tag">Done</em>
                        ) : null}
                      </span>
                      <strong className="pt-outline-module-title" title={mod.title}>
                        {mod.title}
                      </strong>
                      <span className="pt-outline-module-meta">
                        <span className="pt-outline-module-count">
                          {mod.completedModuleLessons}/{mod.totalModuleLessons}
                        </span>
                        <span>
                          {mod.completedModuleLessons === 1
                            ? "lesson"
                            : "lessons"}{" "}
                          · {mod.moduleProgressPercentage}%
                        </span>
                      </span>
                    </span>
                  </button>
                </h3>

                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={headerId}
                  hidden={!open}
                  className="pt-outline-module-panel"
                >
                  {mod.lessons.length === 0 ? (
                    <p className="pt-outline-module-empty">
                      Lessons in this module aren&apos;t published yet.
                    </p>
                  ) : (
                    <ol className="pt-outline-lesson-list">
                      {mod.lessons.map((lesson, idx) => {
                        const isCurrent = lesson.id === currentLessonId;
                        return (
                          <li key={lesson.id}>
                            <Link
                              ref={isCurrent ? activeRef : undefined}
                              href={`/portal/courses/${courseSlug}/lessons/${lesson.id}`}
                              className="pt-outline-lesson-row"
                              data-current={isCurrent ? "true" : "false"}
                              data-done={lesson.completed ? "true" : "false"}
                              aria-current={isCurrent ? "page" : undefined}
                              onClick={() => onNavigate?.()}
                            >
                              <span
                                className="pt-outline-lesson-icon"
                                aria-hidden="true"
                              >
                                {lesson.completed ? (
                                  <CheckCircle2 size={16} />
                                ) : isCurrent ? (
                                  <FileText size={16} />
                                ) : (
                                  <Circle size={15} />
                                )}
                              </span>
                              <span className="pt-outline-lesson-copy">
                                <span className="pt-outline-lesson-index">
                                  {lesson.lesson_number || idx + 1}
                                </span>
                                <span
                                  className="pt-outline-lesson-title"
                                  title={lesson.title}
                                >
                                  {lesson.title}
                                </span>
                              </span>
                              {lesson.completed ? (
                                <span className="pt-visually-hidden">
                                  Completed
                                </span>
                              ) : null}
                              {isCurrent ? (
                                <span className="pt-outline-now">Now</span>
                              ) : null}
                            </Link>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>
              </section>
            );
          })
        )}
      </div>

      <footer className="pt-outline-footer">
        <Link
          href={`/portal/courses/${courseSlug}`}
          className="pt-outline-footer-link"
          onClick={() => onNavigate?.()}
        >
          <BookOpen size={14} aria-hidden="true" />
          Course overview
        </Link>
        <Link
          href="/portal/resources"
          className="pt-outline-footer-link"
          onClick={() => onNavigate?.()}
        >
          <FolderOpen size={14} aria-hidden="true" />
          Resources
        </Link>
      </footer>
    </div>
  );
}

/** Mobile / tablet floating control + drawer host */
export function CourseOutlineMobile({
  courseTitle,
  courseSlug,
  modules,
  progress,
  currentLessonId,
  currentModuleId,
}: {
  courseTitle: string;
  courseSlug: string;
  modules: PortalModule[];
  progress: CourseProgress;
  currentLessonId: string;
  currentModuleId: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="pt-outline-fab"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <List size={16} aria-hidden="true" />
        Outline
        <span className="pt-outline-fab-meta">
          {progress.overallCourseProgressPercentage}%
        </span>
      </button>

      {open ? (
        <div className="pt-outline-drawer-root" role="presentation">
          <button
            type="button"
            className="pt-outline-drawer-backdrop"
            aria-label="Close outline"
            onClick={() => setOpen(false)}
          />
          <div
            className="pt-outline-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Course outline"
          >
            <CourseOutline
              courseTitle={courseTitle}
              courseSlug={courseSlug}
              modules={modules}
              progress={progress}
              currentLessonId={currentLessonId}
              currentModuleId={currentModuleId}
              variant="drawer"
              onNavigate={() => setOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
