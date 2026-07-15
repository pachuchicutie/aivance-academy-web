"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Bell,
  BookOpen,
  CalendarDays,
  ChevronUp,
  FolderOpen,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Settings,
  Shield,
  Users,
  X,
} from "lucide-react";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-client";
import { displayName, initials, tierLabel } from "@/lib/portal/format";
import { AssistantWidget } from "./assistant/AssistantWidget";

export type ShellProfile = {
  id: string;
  fullName: string | null;
  email: string | null;
  role?: "student" | "admin" | null;
  /** Internal tier code (basic | plus | pro | …) */
  tier: string | null;
  /** Public short name from membership_tiers.label e.g. "Basic" */
  planDisplayName?: string | null;
  /** Sentence form e.g. "Basic Tier" when needed */
  planLabel?: string | null;
  reduceMotion?: boolean;
};

const NAV = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/courses", label: "My Courses", icon: BookOpen },
  { href: "/portal/sessions", label: "Live Sessions", icon: CalendarDays },
  { href: "/portal/announcements", label: "Announcements", icon: Bell },
  { href: "/portal/communities", label: "Communities", icon: Users },
  { href: "/portal/resources", label: "Resources", icon: FolderOpen },
  { href: "/portal/support", label: "Support", icon: LifeBuoy },
];

export function StudentPortalShell({
  profile,
  unreadAnnouncements,
  unreadSupport = 0,
  children,
}: {
  profile: ShellProfile;
  unreadAnnouncements: number;
  unreadSupport?: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const wasOpen = useRef(false);

  const closeNav = useCallback(() => {
    setNavOpen(false);
    setProfileMenuOpen(false);
  }, []);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const onDoc = (event: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setProfileMenuOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [profileMenuOpen]);

  // Apply reduced-motion preference from saved student settings.
  useEffect(() => {
    const root = document.documentElement;
    if (profile.reduceMotion) {
      root.dataset.ptReduceMotion = "true";
    } else {
      delete root.dataset.ptReduceMotion;
    }
    return () => {
      delete root.dataset.ptReduceMotion;
    };
  }, [profile.reduceMotion]);

  // Drawer focus management: focus moves in on open, returns to the trigger
  // on close, Escape dismisses.
  useEffect(() => {
    if (!navOpen) {
      if (wasOpen.current) {
        wasOpen.current = false;
        // Defer so we don't cascade setState during the same commit as open→close.
        const id = window.setTimeout(() => menuButtonRef.current?.focus(), 0);
        return () => window.clearTimeout(id);
      }
      return;
    }

    wasOpen.current = true;
    const first = sidebarRef.current?.querySelector<HTMLElement>("a, button");
    first?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeNav();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen, closeNav]);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const supabase = createSupabaseAuthClient();
      await supabase.auth.signOut();
      router.replace("/portal/login");
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  }

  const name = displayName(profile.fullName, profile.email);
  const role = String(profile.role ?? "").trim().toLowerCase();
  // Prefer membership_tiers display name; map code via tierLabel; admins show Admin.
  const fromMembership =
    (profile.planDisplayName && profile.planDisplayName.trim()) ||
    (profile.planLabel
      ? profile.planLabel.replace(/\s+Tier$/i, "").trim()
      : null) ||
    null;
  const fromCode = tierLabel(profile.tier);
  const planName =
    fromMembership ||
    fromCode ||
    (role === "admin" ? "Admin" : null);
  const tierCode =
    (profile.tier ?? "").trim().toLowerCase() ||
    (role === "admin" && !fromCode ? "admin" : "") ||
    "unknown";
  const planAria = planName
    ? planName === "Admin"
      ? "Administrator account."
      : `Current membership plan: ${planName}.`
    : "";

  return (
    <div className="pt-shell">
      <div className="pt-mobile-header">
        <button
          ref={menuButtonRef}
          type="button"
          className="pt-icon-btn"
          aria-label={navOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={navOpen}
          aria-controls="portal-sidebar"
          onClick={() => setNavOpen((v) => !v)}
        >
          {navOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
        <Link href="/portal" className="pt-mobile-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.webp" alt="" width={28} height={28} />
          <span>AIvanza Academy</span>
        </Link>
        <span className="pt-avatar pt-avatar-sm" aria-hidden="true">
          {initials(profile.fullName, profile.email)}
        </span>
      </div>

      {navOpen ? (
        <div
          className="pt-backdrop"
          aria-hidden="true"
          onClick={closeNav}
        />
      ) : null}

      <aside
        id="portal-sidebar"
        ref={sidebarRef}
        className="pt-sidebar"
        data-open={navOpen ? "true" : "false"}
      >
        <Link href="/portal" className="pt-brand" onClick={closeNav}>
          <span className="pt-brand-mark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.webp" alt="AIvanza Academy logo" />
          </span>
          <span className="pt-brand-copy">
            <strong>AIvanza Academy</strong>
            <small>Student Portal</small>
          </span>
        </Link>

        <nav className="pt-nav" aria-label="Portal navigation">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/portal"
                ? pathname === "/portal"
                : pathname.startsWith(item.href);
            const badgeCount =
              item.href === "/portal/announcements"
                ? unreadAnnouncements
                : item.href === "/portal/support"
                  ? unreadSupport
                  : 0;
            const showBadge = badgeCount > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-active={active ? "true" : "false"}
                aria-current={active ? "page" : undefined}
                onClick={closeNav}
              >
                <Icon size={18} aria-hidden="true" />
                <span className="pt-nav-label">{item.label}</span>
                {showBadge ? (
                  <span className="pt-nav-badge">
                    {badgeCount > 9 ? "9+" : badgeCount}
                    <span className="pt-visually-hidden"> unread</span>
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="pt-sidebar-foot">
          <div className="pt-profile-menu" ref={profileMenuRef}>
            {profileMenuOpen ? (
              <div className="pt-profile-dropdown" role="menu">
                <Link
                  href="/portal/settings"
                  role="menuitem"
                  data-active={
                    pathname === "/portal/settings" ||
                    pathname.startsWith("/portal/settings/")
                      ? "true"
                      : "false"
                  }
                  onClick={() => {
                    setProfileMenuOpen(false);
                    closeNav();
                  }}
                >
                  <Settings size={15} aria-hidden="true" />
                  Account Settings
                </Link>
                <Link
                  href="/portal/security"
                  role="menuitem"
                  data-active={
                    pathname === "/portal/security" ||
                    pathname.startsWith("/portal/security/")
                      ? "true"
                      : "false"
                  }
                  onClick={() => {
                    setProfileMenuOpen(false);
                    closeNav();
                  }}
                >
                  <Shield size={15} aria-hidden="true" />
                  Security
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void signOut()}
                  disabled={signingOut}
                >
                  <LogOut size={15} aria-hidden="true" />
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            ) : null}
            <button
              type="button"
              className="pt-profile-card"
              aria-expanded={profileMenuOpen}
              aria-haspopup="menu"
              aria-label={`Open account menu for ${name}. ${planAria}`.trim()}
              onClick={() => setProfileMenuOpen((v) => !v)}
            >
              <span className="pt-avatar" aria-hidden="true">
                {initials(profile.fullName, profile.email)}
              </span>
              <span className="pt-profile-copy">
                <span className="pt-profile-name-row">
                  <strong title={name}>{name}</strong>
                  {planName ? (
                    <span
                      className="pt-plan-badge"
                      data-tier={tierCode}
                      title={`Membership: ${planName}`}
                      aria-hidden="true"
                    >
                      {planName}
                    </span>
                  ) : null}
                </span>
                <span
                  className="pt-profile-email"
                  title={profile.email ?? undefined}
                >
                  {profile.email ?? "No email on file"}
                </span>
              </span>
              <span className="pt-profile-end">
                <ChevronUp
                  size={16}
                  className="pt-profile-chevron"
                  data-open={profileMenuOpen ? "true" : "false"}
                  aria-hidden="true"
                />
              </span>
            </button>
          </div>
        </div>
      </aside>

      <div className="pt-main">
        <main className="pt-content" id="portal-content">
          {children}
        </main>
      </div>

      <AssistantWidget studentName={name} />
    </div>
  );
}
