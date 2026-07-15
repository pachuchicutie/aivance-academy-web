"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server logs carry the technical details; nothing sensitive client-side.
    console.error("Portal section failed to load", error.digest ?? "");
  }, [error]);

  return (
    <div className="pt-empty" role="alert">
      <span className="pt-empty-icon" aria-hidden="true">
        <AlertTriangle size={20} />
      </span>
      <strong>We couldn&apos;t load this section right now.</strong>
      <p>Please try again in a moment.</p>
      <button type="button" className="pt-btn pt-btn-primary pt-btn-sm" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
