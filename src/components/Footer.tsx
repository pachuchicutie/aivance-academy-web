import Brand from "./Brand";

const FOOT_LINKS = [
  { href: "#home", label: "Home" },
  { href: "#about", label: "About" },
  { href: "#learn", label: "What You’ll Learn" },
  { href: "#schedule", label: "Schedule" },
  { href: "#who", label: "Who It’s For" },
  { href: "#contact", label: "Contact" },
];

export default function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <Brand />
            <p>Empowering Filipinos to advance with AI.</p>
          </div>
          <ul className="foot-links">
            {FOOT_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </div>
        <div className="foot-base">
          <span>© 2026 AIVANCE ACADEMY</span>
          <span>LEARN · BUILD · ADVANCE</span>
        </div>
      </div>
    </footer>
  );
}
