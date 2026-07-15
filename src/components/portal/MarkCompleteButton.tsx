"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, RotateCcw } from "lucide-react";
import {
  markLessonComplete,
  unmarkLessonComplete,
} from "@/lib/portal/actions";

/**
 * Mark complete / undo. Progress bars and outline counts only update after
 * a successful server action + router.refresh() — never optimistic progress.
 */
export function MarkCompleteButton({
  lessonId,
  courseSlug,
  completed,
}: {
  lessonId: string;
  courseSlug: string;
  completed: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function markComplete() {
    setError(null);
    startTransition(async () => {
      const result = await markLessonComplete(lessonId, courseSlug);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // Server persisted + revalidated; refresh RSC tree (dashboard, courses,
      // overview, outline) without logout.
      router.refresh();
    });
  }

  function markIncomplete() {
    setError(null);
    startTransition(async () => {
      const result = await unmarkLessonComplete(lessonId, courseSlug);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="pt-complete-wrap" key={`${lessonId}-${completed}`}>
      {completed ? (
        <div className="pt-complete-done" role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>{pending ? "Updating…" : "Lesson Completed"}</span>
          <button
            type="button"
            className="pt-complete-undo"
            onClick={markIncomplete}
            disabled={pending}
          >
            <RotateCcw size={13} aria-hidden="true" />
            Undo
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="pt-btn pt-btn-primary pt-complete-btn"
          onClick={markComplete}
          disabled={pending}
          aria-busy={pending}
          aria-live="polite"
        >
          <CheckCircle2 size={15} aria-hidden="true" />
          {pending ? "Saving Progress…" : "Mark as Complete"}
        </button>
      )}
      {error ? (
        <p className="pt-form-error" role="alert">
          {error}{" "}
          <button
            type="button"
            className="pt-link-btn"
            onClick={completed ? markIncomplete : markComplete}
          >
            Retry
          </button>
        </p>
      ) : null}
    </div>
  );
}
