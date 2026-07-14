import Link from "next/link";
import Brand from "@/components/Brand";
import { IconFacebook } from "@/components/Icons";

const FACEBOOK_URL = "https://www.facebook.com/aivanza.academy/";

export default function PaymentFooter() {
  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <Brand href="/" />
            <p>Empowering Filipinos to advance with AI.</p>
            <a
              className="foot-social"
              href={FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="AIvanza Academy on Facebook"
            >
              <IconFacebook size={18} />
              Facebook
            </a>
          </div>
          <ul className="foot-links">
            <li>
              <Link href="/#schedule">Choose Batch</Link>
            </li>
            <li>
              <a
                href={FACEBOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Message Us
              </a>
            </li>
            <li>
              <a
                href={FACEBOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Facebook
              </a>
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
