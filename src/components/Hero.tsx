import HeroParticles from "./HeroParticles";
import HeroVideo from "./HeroVideo";
import SeatMeter from "./SeatMeter";
import { IconCalendar, IconUsers } from "./Icons";
import { formatSeatLine, getBatchSeatStatus } from "@/lib/seats";

export default async function Hero() {
  const seats = await getBatchSeatStatus();
  const batch1 = seats.batches["1"];

  return (
    <section className="hero" id="home">
      <svg
        className="circuit"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <g stroke="rgba(90,160,255,.12)" strokeWidth="1" fill="none">
          <path d="M0 120 H240 l40 40 H520" />
          <path d="M1200 220 H960 l-40 -40 H700" />
          <path d="M0 620 H180 l50 -50 H430" />
          <path d="M1200 680 H1020 l-36 -36 H820" />
          <path d="M90 0 V90 l40 40 V260" />
          <path d="M1130 800 V690 l-34 -34 V520" />
        </g>
        <g fill="rgba(90,200,255,.35)">
          <circle cx="520" cy="160" r="3" />
          <circle cx="700" cy="180" r="3" />
          <circle cx="430" cy="570" r="3" />
          <circle cx="820" cy="644" r="3" />
          <circle cx="130" cy="260" r="3" />
          <circle cx="1096" cy="520" r="3" />
        </g>
      </svg>
      <HeroParticles />

      <div className="wrap hero-grid">
        <div>
          <span className="badge">2-Day AI Specialist Starter Bootcamp</span>
          <h1>
            Advance Your Future with <em>Practical AI Skills</em>
          </h1>
          <p className="hero-sub">
            AIvanza Academy helps Filipinos learn how to use AI tools,
            automation, landing pages, sales trackers, and business workflows
            for business, career growth, portfolio building, and everyday
            productivity.
          </p>
          <div className="hero-ctas">
            <a className="btn btn-primary" href="#schedule">
              Reserve Your Seat
            </a>
            <a className="btn btn-ghost" href="#learn">
              View Curriculum
            </a>
          </div>
          <p className="trust-line">
            <b>Beginner-Friendly</b> &nbsp;•&nbsp; <b>Practical Outputs</b>{" "}
            &nbsp;•&nbsp; <b>Business &amp; Career Ready</b>
          </p>
        </div>

        <div className="hero-visual">
          <HeroVideo />

          <aside className="quick-info" aria-label="Bootcamp quick info">
            <div className="qi-top">
              <span className="qi-label">Bootcamp Quick Info</span>
              <span className="qi-price">
                ₱1,999<small>Beginner Rate</small>
              </span>
            </div>
            <div className="qi-row">
              <IconCalendar />
              <span>
                <b>Batch 1:</b> July 17–18, 2026{" "}
                <span className="mono">· Fri–Sat · 9:00 AM – 2:00 PM</span>
              </span>
            </div>
            <div className="qi-row">
              <IconCalendar />
              <span>
                <b>Batch 2:</b> July 24–25, 2026{" "}
                <span className="mono">· Fri–Sat · 9:00 AM – 2:00 PM</span>
              </span>
            </div>
            <div className="qi-row">
              <IconUsers />
              <span>
                <b>{seats.seatLimit} seats per batch only</b>
              </span>
            </div>
            <div className="qi-seats">
              <div className="mono-line">
                <span>BATCH 1 SEAT STATUS</span>
                <b>
                  {batch1.filled} / {batch1.seatLimit} filled
                </b>
              </div>
              <SeatMeter filled={batch1.filled} total={batch1.seatLimit} />
              <p className="qi-note">
                Live seat count · {formatSeatLine(batch1)}. Small batch size so
                every student is properly accommodated.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
