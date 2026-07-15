import Link from "next/link";
import { BookOpen, Lock, MessageCircle } from "lucide-react";
import type { CourseLibraryItem } from "@/lib/portal/types";
import {
  lockedAriaLabel,
  lockedSupportHref,
  lockedUpgradeMessage,
} from "@/lib/portal/course-access-copy";

/**
 * Dedicated LOCKED_BY_TIER discovery card.
 * Structurally different from CourseProgressCard (enrolled/active).
 * Never shows progress, Continue, or player links.
 */
export function LockedByTierCard({
  item,
  studentPlanLabel,
  studentTier,
}: {
  item: CourseLibraryItem;
  studentPlanLabel?: string | null;
  studentTier?: string | null;
}) {
  const planForCopy = studentPlanLabel ?? studentTier ?? item.enrollmentTier;
  const copy = lockedUpgradeMessage(item, planForCopy);
  const aria = lockedAriaLabel(item, planForCopy);
  const supportHref = lockedSupportHref(item);

  return (
    <article
      className="pt-locked-by-tier"
      data-access="locked_by_tier"
      data-state={item.accessState}
      aria-label={aria}
    >
      {/* LEFT | lock / access panel */}
      <div className="pt-lbt-access" aria-hidden="true">
        <div className="pt-lbt-art">
          {item.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.coverImage} alt="" loading="lazy" />
          ) : (
            <BookOpen size={28} strokeWidth={1.6} className="pt-lbt-book" />
          )}
          <span className="pt-lbt-art-pattern" />
          <span className="pt-lbt-art-veil" />
          <span className="pt-lbt-lock-core">
            <Lock size={22} strokeWidth={2.4} />
          </span>
        </div>
        <span className="pt-lbt-locked-label">
          <Lock size={12} strokeWidth={2.5} />
          Locked
        </span>
      </div>

      {/* MIDDLE | content */}
      <div className="pt-lbt-content">
        <div className="pt-lbt-badges">
          <span className="pt-lbt-pill pt-lbt-pill-muted">
            <Lock size={11} aria-hidden="true" />
            Not included
          </span>
          <span className="pt-lbt-pill pt-lbt-pill-tier">
            {copy.requiredAccessLabel}
          </span>
        </div>

        <h3 className="pt-lbt-title">{item.course.title}</h3>

        {item.course.description ? (
          <p className="pt-lbt-desc">{item.course.description}</p>
        ) : null}

        <p className="pt-lbt-plan">{copy.planLine}</p>
        <p className="pt-lbt-upgrade">{copy.upgradeLine}</p>
      </div>

      {/* RIGHT | required access + CTA */}
      <div className="pt-lbt-action">
        <div className="pt-lbt-required">
          <span className="pt-lbt-required-kicker">Required access</span>
          <strong className="pt-lbt-required-value">
            {copy.requiredAccessLabel}
          </strong>
        </div>
        <Link href={supportHref} className="pt-btn pt-btn-lbt-cta pt-btn-sm">
          <MessageCircle size={15} aria-hidden="true" />
          Ask About Upgrading
        </Link>
        <p className="pt-lbt-cta-note">
          Support can discuss plans. Access is not granted instantly.
        </p>
      </div>
    </article>
  );
}
