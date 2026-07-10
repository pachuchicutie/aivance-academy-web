"use client";

import { useState } from "react";
import Link from "next/link";
import Brand from "@/components/Brand";

const NAV_LINKS = [
  { href: "/#home", label: "Home" },
  { href: "/#schedule", label: "Schedule" },
  { href: "/#contact", label: "Contact" },
];

export default function PaymentHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header>
      <div className="wrap nav">
        <Brand href="/" />
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
          <Link className="btn btn-ghost" href="/#schedule">
            Change Batch
          </Link>
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
          <li>
            <Link href="/#schedule" onClick={() => setOpen(false)}>
              Change Batch
            </Link>
          </li>
        </ul>
      </div>
    </header>
  );
}
