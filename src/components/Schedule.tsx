import Reveal from "./Reveal";
import SeatMeter from "./SeatMeter";
import { IconCalendar, IconClock, IconInfo } from "./Icons";

export default function Schedule() {
  return (
    <section id="schedule">
      <div className="wrap">
        <Reveal className="section-head">
          <span className="eyebrow">Schedule</span>
          <h2>Choose Your Preferred Batch</h2>
          <p>
            To make sure all students are properly accommodated, each batch is
            limited to 25 seats only.
          </p>
        </Reveal>
        <div className="batch-grid">
          <Reveal as="article" className="batch-card">
            <div className="batch-head">
              <h3>Batch 1</h3>
              <span className="status open">Open for Enrollment</span>
            </div>
            <div className="batch-meta">
              <div className="qi-row">
                <IconCalendar />
                <span>
                  <b>July 17–18, 2026</b>{" "}
                  <span className="mono">· Friday–Saturday</span>
                </span>
              </div>
              <div className="qi-row">
                <IconClock />
                <span>9:00 AM – 2:00 PM</span>
              </div>
            </div>
            <div className="batch-price">
              <span className="amount">₱1,999</span>
              <span className="cap">25 SEATS ONLY</span>
            </div>
            <div className="seat-block">
              <div className="mono-line">
                <span>SEAT STATUS</span>
                <b>2 / 25 filled · 8%</b>
              </div>
              <SeatMeter filled={2} />
            </div>
            <a className="btn btn-primary" href="#contact">
              Reserve for Batch 1
            </a>
          </Reveal>

          <Reveal as="article" className="batch-card">
            <div className="batch-head">
              <h3>Batch 2</h3>
              <span className="status next">Next Available Batch</span>
            </div>
            <div className="batch-meta">
              <div className="qi-row">
                <IconCalendar />
                <span>
                  <b>July 24–25, 2026</b>{" "}
                  <span className="mono">· Friday–Saturday</span>
                </span>
              </div>
              <div className="qi-row">
                <IconClock />
                <span>9:00 AM – 2:00 PM</span>
              </div>
            </div>
            <div className="batch-price">
              <span className="amount">₱1,999</span>
              <span className="cap">25 SEATS ONLY</span>
            </div>
            <div className="seat-block">
              <div className="mono-line">
                <span>SEAT STATUS</span>
                <b>0 / 25 filled · 0%</b>
              </div>
              <SeatMeter filled={0} />
            </div>
            <a className="btn btn-primary" href="#contact">
              Reserve for Batch 2
            </a>
          </Reveal>
        </div>
        <Reveal className="enroll-note">
          <IconInfo size={17} />
          <span>
            If Batch 1 reaches full capacity, succeeding enrollees will
            automatically be assigned to Batch 2. If both batches are full,
            students may be placed on a waiting list for the next schedule.
          </span>
        </Reveal>
      </div>
    </section>
  );
}
