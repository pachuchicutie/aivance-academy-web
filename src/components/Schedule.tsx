import Reveal from "./Reveal";
import SeatMeter from "./SeatMeter";
import { IconCalendar, IconClock, IconInfo } from "./Icons";
import { BATCHES, paymentPath, type BatchId } from "@/lib/batches";
import {
  formatSeatLine,
  getBatchSeatStatus,
  type SeatStats,
} from "@/lib/seats";

function statusForBatch(id: BatchId, stats: SeatStats, otherFilled: number, limit: number) {
  if (stats.filled >= stats.seatLimit) {
    return { label: "Fully Booked", className: "status full" };
  }
  if (stats.remaining <= 5) {
    return { label: "Almost Full", className: "status next" };
  }
  if (id === "1") {
    return { label: "Open for Enrollment", className: "status open" };
  }
  // Batch 2
  if (otherFilled >= limit) {
    return { label: "Open for Enrollment", className: "status open" };
  }
  return { label: "Next Available Batch", className: "status next" };
}

export default async function Schedule() {
  const seats = await getBatchSeatStatus();
  const b1 = seats.batches["1"];
  const b2 = seats.batches["2"];

  const cards: Array<{ id: BatchId; stats: SeatStats }> = [
    { id: "1", stats: b1 },
    { id: "2", stats: b2 },
  ];

  return (
    <section id="schedule">
      <div className="wrap">
        <Reveal className="section-head">
          <span className="eyebrow">Schedule</span>
          <h2>Choose Your Preferred Batch</h2>
          <p>
            To make sure all students are properly accommodated, each batch is
            limited to {seats.seatLimit} seats only. Seat status updates from
            real reservations.
          </p>
        </Reveal>
        <div className="batch-grid">
          {cards.map(({ id, stats }) => {
            const batch = BATCHES[id];
            const other = id === "1" ? b2.filled : b1.filled;
            const status = statusForBatch(id, stats, other, seats.seatLimit);
            const isFull = stats.filled >= stats.seatLimit;

            return (
              <Reveal as="article" className="batch-card" key={id}>
                <div className="batch-head">
                  <h3>{batch.name}</h3>
                  <span className={status.className}>{status.label}</span>
                </div>
                <div className="batch-meta">
                  <div className="qi-row">
                    <IconCalendar />
                    <span>
                      <b>{batch.dates}</b>{" "}
                      <span className="mono">· {batch.days}</span>
                    </span>
                  </div>
                  <div className="qi-row">
                    <IconClock />
                    <span>{batch.time}</span>
                  </div>
                </div>
                <div className="batch-price">
                  <span className="amount">{batch.priceLabel}</span>
                  <span className="cap">{stats.seatLimit} SEATS ONLY</span>
                </div>
                <div className="seat-block">
                  <div className="mono-line">
                    <span>SEAT STATUS</span>
                    <b>{formatSeatLine(stats)}</b>
                  </div>
                  <SeatMeter filled={stats.filled} total={stats.seatLimit} />
                  <p className="seat-remaining">
                    {isFull
                      ? "No seats left in this batch."
                      : `${stats.remaining} seat${stats.remaining === 1 ? "" : "s"} remaining`}
                  </p>
                </div>
                {isFull ? (
                  <span className="btn btn-ghost batch-full-btn" aria-disabled="true">
                    Batch full
                  </span>
                ) : (
                  <a className="btn btn-primary" href={paymentPath(id)}>
                    Reserve for {batch.name}
                  </a>
                )}
              </Reveal>
            );
          })}
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
