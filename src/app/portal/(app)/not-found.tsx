import Link from "next/link";
import { Compass } from "lucide-react";

export default function PortalNotFound() {
  return (
    <div className="pt-empty">
      <span className="pt-empty-icon" aria-hidden="true">
        <Compass size={20} />
      </span>
      <strong>This page isn&apos;t available</strong>
      <p>
        It may have been unpublished, or your enrollment doesn&apos;t include
        it. If you think that&apos;s a mistake, contact the academy team.
      </p>
      <Link href="/portal" className="pt-btn pt-btn-primary pt-btn-sm">
        Back to dashboard
      </Link>
    </div>
  );
}
