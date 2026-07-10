import Link from "next/link";
import Brand from "@/components/Brand";

export default function PaymentFooter() {
  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <Brand href="/" />
            <p>Empowering Filipinos to advance with AI.</p>
          </div>
          <ul className="foot-links">
            <li>
              <Link href="/#schedule">Choose Batch</Link>
            </li>
            <li>
              <a href="mailto:hello@aivanzaacademy.com">Message Us</a>
            </li>
          </ul>
        </div>
        <div className="foot-base">
          <span>© 2026 AIVANZA ACADEMY</span>
          <span>MANUAL PAYMENT · PENDING REVIEW</span>
        </div>
      </div>
    </footer>
  );
}
