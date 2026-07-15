"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Send } from "lucide-react";
import {
  submitSupportRequest,
  type SupportFormState,
} from "@/lib/portal/actions";
import { SUPPORT_CATEGORIES } from "@/lib/portal/support";

const INITIAL: SupportFormState = { status: "idle" };

export function SupportForm({
  courses,
  compact = false,
  defaults,
}: {
  courses: { id: string; title: string }[];
  compact?: boolean;
  /** Prefill from upgrade / deep links (query string). */
  defaults?: {
    subject?: string;
    category?: string;
    message?: string;
  };
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    submitSupportRequest,
    INITIAL
  );
  const [formKey, setFormKey] = useState(0);
  const [dismissedTicketId, setDismissedTicketId] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (state.status === "success" && state.ticketId) {
      router.refresh();
    }
  }, [state, router]);

  const showSuccess =
    state.status === "success" &&
    state.ticketId &&
    state.ticketId !== dismissedTicketId;

  if (showSuccess && state.status === "success") {
    return (
      <div className="pt-support-success" role="status">
        <CheckCircle2 size={22} aria-hidden="true" />
        <strong>Request submitted</strong>
        <p>{state.message}</p>
        {state.referenceCode ? (
          <p className="pt-ticket-ref">Reference: {state.referenceCode}</p>
        ) : null}
        <div className="pt-form-actions">
          {state.ticketId ? (
            <Link
              href={`/portal/support/${state.ticketId}`}
              className="pt-btn pt-btn-soft"
            >
              Open ticket
            </Link>
          ) : null}
          <button
            type="button"
            className="pt-btn pt-btn-ghost"
            onClick={() => {
              if (state.status === "success" && state.ticketId) {
                setDismissedTicketId(state.ticketId);
              }
              setFormKey((k) => k + 1);
              router.refresh();
            }}
          >
            Submit another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form key={formKey} action={formAction} className="pt-form">
      <div className={compact ? "pt-form-stack" : "pt-form-row"}>
        <label className="pt-field">
          <span>Subject</span>
          <input
            type="text"
            name="subject"
            required
            minLength={5}
            maxLength={150}
            placeholder="What do you need help with?"
            defaultValue={defaults?.subject ?? ""}
            disabled={pending}
          />
        </label>
        <label className="pt-field">
          <span>Category</span>
          <div className="pt-select-wrap">
            <select
              name="category"
              defaultValue={defaults?.category ?? "general"}
              disabled={pending}
              className="pt-select"
            >
              {SUPPORT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </label>
      </div>

      {courses.length > 0 ? (
        <label className="pt-field">
          <span>Related course (optional)</span>
          <div className="pt-select-wrap">
            <select
              name="course_id"
              defaultValue=""
              disabled={pending}
              className="pt-select"
            >
              <option value="">Not course-specific</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>
        </label>
      ) : null}

      <label className="pt-field">
        <span>Message</span>
        <textarea
          name="message"
          required
          minLength={10}
          maxLength={5000}
          rows={7}
          placeholder="Describe your question or issue. Include any details that could help the team respond faster."
          defaultValue={defaults?.message ?? ""}
          disabled={pending}
        />
      </label>

      {state.status === "error" && state.message ? (
        <p className="pt-form-error" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="pt-form-actions">
        <button
          type="submit"
          className="pt-btn pt-btn-soft"
          disabled={pending}
        >
          <Send size={15} aria-hidden="true" />
          {pending ? "Sending…" : "Send request"}
        </button>
      </div>
    </form>
  );
}
