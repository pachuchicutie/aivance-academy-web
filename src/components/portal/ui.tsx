import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { ArrowRight } from "lucide-react";

type IconType = ComponentType<{
  size?: number | string;
  "aria-hidden"?: boolean | "true" | "false";
}>;

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="pt-page-header">
      <div>
        <span className="pt-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="pt-page-header-action">{action}</div> : null}
    </div>
  );
}

/**
 * Section header for major portal cards.
 * Always render inside a card — padding is applied by wrapping
 * with `PortalCardHeader` (or by placing this inside `.pt-panel-header`).
 */
export function SectionHead({
  icon: Icon,
  title,
  description,
  action,
  headingLevel = "h2",
  id,
}: {
  icon?: IconType;
  title: string;
  description?: string;
  action?: { href: string; label: string };
  headingLevel?: "h2" | "h3";
  id?: string;
}) {
  const Heading = headingLevel;
  return (
    <div className="pt-section-head">
      <div className="pt-section-head-copy">
        {Icon ? (
          <span className="pt-section-icon" aria-hidden="true">
            <Icon size={18} />
          </span>
        ) : null}
        <div>
          <Heading id={id}>{title}</Heading>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {action ? (
        <div className="pt-section-head-action">
          <Link href={action.href} className="pt-btn pt-btn-ghost pt-btn-sm">
            {action.label}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

/** Card chrome only — header/body provide internal padding. */
export function PortalCard({
  children,
  className,
  "aria-labelledby": ariaLabelledBy,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  "aria-labelledby"?: string;
  as?: "section" | "article" | "div";
}) {
  return (
    <Tag className={cx("pt-panel", className)} aria-labelledby={ariaLabelledBy}>
      {children}
    </Tag>
  );
}

/** Padded card header slot for SectionHead / simple titles. */
export function PortalCardHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx("pt-panel-header", className)}>{children}</div>;
}

/** Padded card body slot for lists, forms, empty states. */
export function PortalCardBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx("pt-panel-body", className)}>{children}</div>;
}

/**
 * Convenience: section card with standard header + body.
 * Use when the whole block is header + single content region.
 */
export function PortalSectionCard({
  icon,
  title,
  description,
  action,
  children,
  className,
  headingId,
}: {
  icon?: IconType;
  title: string;
  description?: string;
  action?: { href: string; label: string };
  children: ReactNode;
  className?: string;
  headingId?: string;
}) {
  return (
    <PortalCard className={className} aria-labelledby={headingId}>
      <PortalCardHeader>
        <SectionHead
          icon={icon}
          title={title}
          description={description}
          action={action}
          id={headingId}
        />
      </PortalCardHeader>
      <PortalCardBody>{children}</PortalCardBody>
    </PortalCard>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
  compact = false,
}: {
  icon?: IconType;
  title?: string;
  message: string;
  action?: { href: string; label: string };
  compact?: boolean;
}) {
  return (
    <div className={compact ? "pt-empty pt-empty-compact" : "pt-empty"}>
      {Icon ? (
        <span className="pt-empty-icon" aria-hidden="true">
          <Icon size={22} />
        </span>
      ) : null}
      {title ? <strong>{title}</strong> : null}
      <p>{message}</p>
      {action ? (
        <Link href={action.href} className="pt-btn pt-btn-ghost pt-btn-sm">
          {action.label}
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

export function ProgressBar({
  percent,
  label,
  tone = "cyan",
}: {
  percent: number;
  label: string;
  tone?: "cyan" | "violet" | "teal" | "gold";
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div
      className="pt-progress"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      data-tone={tone}
    >
      <span className="pt-progress-fill" style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function TypeBadge({
  label,
  tone,
}: {
  label: string;
  tone: "cyan" | "violet" | "teal" | "gold" | "muted" | "danger" | "success";
}) {
  return (
    <span className="pt-badge" data-tone={tone}>
      {label}
    </span>
  );
}
