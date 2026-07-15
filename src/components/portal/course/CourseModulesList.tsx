"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  PlayCircle,
} from "lucide-react";
import type { PortalModule } from "@/lib/portal/types";
import { buildModuleProgress } from "@/lib/portal/progress";

type ModuleState = "completed" | "in_progress" | "not_started" | "preparing";

function moduleState(mod: PortalModule): ModuleState {
  if (mod.lessons.length === 0) return "preparing";
  if (mod.lessons.every((l) => l.completed)) return "completed";
  if (mod.lessons.some((l) => l.completed)) return "in_progress";
  return "not_started";
}

function stateLabel(state: ModuleState) {
  switch (state) {
    case "completed":
      return "Completed";
    case "in_progress":
      return "In progress";
    case "preparing":
      return "Content preparing";
    default:
      return "Not started";
  }
}

export function CourseModulesList({
  courseSlug,
  modules,
  currentModuleId,
}: {
  courseSlug: string;
  modules: PortalModule[];
  currentModuleId?: string | null;
}) {
  const defaultOpen = useMemo(() => {
    const ids = new Set<string>();
    // Open current module; if none, open first incomplete with lessons
    if (currentModuleId) ids.add(currentModuleId);
    const firstIncomplete = modules.find(
      (m) =>
        m.lessons.length > 0 && !m.lessons.every((l) => l.completed)
    );
    if (firstIncomplete) ids.add(firstIncomplete.id);
    // Don't auto-open completed-only list
    if (ids.size === 0 && modules[0]) ids.add(modules[0].id);
    return ids;
  }, [modules, currentModuleId]);

  const [openIds, setOpenIds] = useState<Set<string>>(defaultOpen);

  const completedCount = modules.filter(
    (m) => m.lessons.length > 0 && m.lessons.every((l) => l.completed)
  ).length;

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setOpenIds(new Set(modules.map((m) => m.id)));
  }

  function collapseAll() {
    setOpenIds(new Set());
  }

  return (
    <section className="co-modules" aria-labelledby="co-modules-heading">
      <header className="co-modules-head">
        <div className="co-modules-head-copy">
          <h2 id="co-modules-heading" className="co-modules-title">
            Modules
          </h2>
          <p className="co-modules-sub">
            {modules.length} module{modules.length === 1 ? "" : "s"}
            {modules.length > 0
              ? ` · ${completedCount} completed`
              : ""}
          </p>
        </div>
        {modules.length >= 2 ? (
          <div
            className="co-modules-actions"
            role="group"
            aria-label="Module list controls"
          >
            <button type="button" className="co-modules-btn" onClick={expandAll}>
              Expand all
            </button>
            <button
              type="button"
              className="co-modules-btn"
              onClick={collapseAll}
            >
              Collapse all
            </button>
          </div>
        ) : null}
      </header>

      <div className="co-module-list">
        {modules.map((mod) => {
          const open = openIds.has(mod.id);
          const state = moduleState(mod);
          const mp = buildModuleProgress(mod);
          const isCurrent = mod.id === currentModuleId;
          const firstIncomplete = mod.lessons.find((l) => !l.completed);
          const firstLesson = mod.lessons[0];

          return (
            <article
              key={mod.id}
              className="co-module"
              data-state={state}
              data-open={open ? "true" : "false"}
              data-current={isCurrent ? "true" : "false"}
            >
              <h3 className="co-module-heading">
                <button
                  type="button"
                  className="co-module-trigger"
                  aria-expanded={open}
                  aria-controls={`co-module-panel-${mod.id}`}
                  id={`co-module-btn-${mod.id}`}
                  onClick={() => toggle(mod.id)}
                >
                  <span
                    className="co-module-chevron"
                    data-open={open ? "true" : "false"}
                    aria-hidden="true"
                  >
                    <ChevronDown size={16} strokeWidth={2.25} />
                  </span>

                  <span
                    className="co-module-num"
                    data-state={state}
                    aria-hidden="true"
                  >
                    {state === "completed" ? (
                      <CheckCircle2 size={15} strokeWidth={2.25} />
                    ) : (
                      mod.module_number
                    )}
                  </span>

                  <span className="co-module-main">
                    <span className="co-module-title-row">
                      <span className="co-module-title">{mod.title}</span>
                      {isCurrent ? (
                        <span className="co-module-pill current">Current</span>
                      ) : null}
                      <span className="co-module-pill" data-state={state}>
                        {stateLabel(state)}
                      </span>
                    </span>
                    <span className="co-module-meta">
                      {state === "preparing" ? (
                        <>
                          <Clock3 size={12} aria-hidden="true" />
                          Content preparing
                        </>
                      ) : (
                        <>
                          {mp.completedModuleLessons} of {mp.totalModuleLessons}{" "}
                          completed
                          {mp.totalModuleLessons > 0
                            ? ` · ${mp.moduleProgressPercentage}%`
                            : ""}
                        </>
                      )}
                    </span>
                  </span>

                  {/* Compact horizontal count — never stacked number/label */}
                  <span
                    className="co-module-lessons"
                    data-state={state}
                    aria-label={
                      mod.lessons.length === 1
                        ? "1 lesson"
                        : `${mod.lessons.length} lessons`
                    }
                  >
                    <BookOpen size={13} strokeWidth={2.25} aria-hidden="true" />
                    <span className="co-module-lessons-text">
                      {mod.lessons.length === 0
                        ? "0 lessons"
                        : `${mod.lessons.length} lesson${
                            mod.lessons.length === 1 ? "" : "s"
                          }`}
                    </span>
                  </span>
                </button>
              </h3>

              <div
                id={`co-module-panel-${mod.id}`}
                role="region"
                aria-labelledby={`co-module-btn-${mod.id}`}
                hidden={!open}
                className="co-module-panel"
              >
                {mod.lessons.length === 0 ? (
                  <div className="co-module-empty">
                    <Clock3 size={16} aria-hidden="true" />
                    <div>
                      <strong>Lessons are being prepared</strong>
                      <p>Content for this module will be available soon.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <ol className="co-lesson-list">
                      {mod.lessons.map((lesson, idx) => (
                        <li key={lesson.id}>
                          <Link
                            href={`/portal/courses/${courseSlug}/lessons/${lesson.id}`}
                            className="co-lesson-link"
                            data-done={lesson.completed ? "true" : "false"}
                          >
                            <span className="co-lesson-icon" aria-hidden="true">
                              {lesson.completed ? (
                                <CheckCircle2 size={16} />
                              ) : (
                                <Circle size={15} />
                              )}
                            </span>
                            <span className="co-lesson-copy">
                              <span className="co-lesson-index">
                                {lesson.lesson_number || idx + 1}
                              </span>
                              <span className="co-lesson-title">
                                {lesson.title}
                              </span>
                            </span>
                            {lesson.completed ? (
                              <span className="co-lesson-done">Done</span>
                            ) : null}
                          </Link>
                        </li>
                      ))}
                    </ol>
                    {firstIncomplete || firstLesson ? (
                      <div className="co-module-footer">
                        <Link
                          href={`/portal/courses/${courseSlug}/lessons/${
                            (firstIncomplete ?? firstLesson).id
                          }`}
                          className="pt-btn pt-btn-soft pt-btn-sm"
                        >
                          {state === "completed" ? (
                            "Review module"
                          ) : state === "in_progress" ? (
                            <>
                              <PlayCircle size={15} aria-hidden="true" />
                              Continue module
                            </>
                          ) : (
                            <>
                              <PlayCircle size={15} aria-hidden="true" />
                              Start module
                            </>
                          )}
                        </Link>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
