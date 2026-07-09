"use client";

import { useState } from "react";
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

  return (
    <header>
      <div className="wrap nav">
        <Brand />
        <nav aria-label="Primary">
          <ul className="nav-links">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="nav-cta">
          <a className="btn btn-primary" href="#schedule">
            Reserve Your Seat
          </a>
          <button
            className="menu-btn"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            type="button"
          >
            ☰
          </button>
        </div>
      </div>
      <div className={`mobile-nav${open ? " open" : ""}`} id="mobileNav">
        <ul>
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} onClick={() => setOpen(false)}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
