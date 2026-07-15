"use client";

import { useEffect, useState } from "react";
import Brand from "./Brand";

const NAV_LINKS = [
  { href: "#home", label: "Home" },
  { href: "#about", label: "About" },
  { href: "#learn", label: "What You’ll Learn" },
  { href: "#schedule", label: "Schedule" },
  { href: "#who", label: "Who It’s For" },
  { href: "#contact", label: "Contact" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  // Close the drawer when the viewport grows into desktop nav.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (mq.matches) setOpen(false);
    };
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Lock background scroll while the mobile menu is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <header className="site-header">
      <div className="wrap nav">
        <Brand />
        <nav className="nav-desktop" aria-label="Primary">
          <ul className="nav-links">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="nav-cta">
          <a className="btn btn-primary btn-nav-reserve" href="#schedule">
            Reserve Your Seat
          </a>
          <button
            className="menu-btn"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobileNav"
            onClick={() => setOpen((v) => !v)}
            type="button"
          >
            <span className="menu-btn-icon" aria-hidden="true">
              {open ? "✕" : "☰"}
            </span>
          </button>
        </div>
      </div>
      <div
        className={`mobile-nav${open ? " open" : ""}`}
        id="mobileNav"
        hidden={!open}
      >
        <ul>
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} onClick={() => setOpen(false)}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <a
          className="btn btn-primary btn-mobile-reserve"
          href="#schedule"
          onClick={() => setOpen(false)}
        >
          Reserve Your Seat
        </a>
      </div>
    </header>
  );
}
