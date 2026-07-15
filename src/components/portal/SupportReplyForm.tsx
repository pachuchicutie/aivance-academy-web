"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import {
  replyToSupportTicket,
  type SupportReplyState,
} from "@/lib/portal/actions";

const INITIAL: SupportReplyState = { status: "idle" };

export function SupportReplyForm({
  ticketId,
  closed,
}: {
  ticketId: string;
  closed?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    replyToSupportTicket,
    INITIAL
  );

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  if (closed) {
    return (
      <p className="pt-assist-note">
        This ticket is closed. Open a new support request if you still need
        help.
      </p>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="pt-form pt-reply-form">
      <input type="hidden" name="ticket_id" value={ticketId} />
      <label className="pt-field">
        <span>Your reply</span>
        <textarea
          name="body"
          required
          minLength={1}
          maxLength={5000}
          rows={4}
          placeholder="Add more details or ask a follow-up question…"
          disabled={pending}
        />
      </label>
      {state.status === "error" && state.message ? (
        <p className="pt-form-error" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" && state.message ? (
        <p className="pt-form-success" role="status">
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
          {pending ? "Sending…" : "Send reply"}
        </button>
      </div>
    </form>
  );
}
