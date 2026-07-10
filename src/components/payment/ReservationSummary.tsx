import { BOOTCAMP, type BatchInfo } from "@/lib/batches";
import { IconCalendar, IconClock, IconUsers } from "@/components/Icons";
import type { SeatStats } from "@/lib/seats";
import { formatSeatLine } from "@/lib/seats";

type Props = {
  batch: BatchInfo;
  sticky?: boolean;
  seats?: SeatStats;
};

export default function ReservationSummary({ batch, sticky, seats }: Props) {
  const seatLimit = seats?.seatLimit ?? batch.seatLimit;
  const filled = seats?.filled ?? 0;
  const remaining = seats?.remaining ?? Math.max(seatLimit - filled, 0);

  return (
    <aside
      className={`pay-summary${sticky ? " pay-summary-sticky" : ""}`}
      aria-label="Reservation summary"
    >
      <span className="qi-label">Reservation summary</span>
      <h2 className="pay-summary-title">{BOOTCAMP.shortName}</h2>

      <div className="pay-summary-amount-block">
        <span className="pay-amount">{batch.priceLabel}</span>
        <span className="pay-tier-badge">{BOOTCAMP.tierLabel}</span>
      </div>

      <dl className="pay-summary-list">
        <div>
          <dt>Selected batch</dt>
          <dd>
            <b>{batch.name}</b>
            <span className="pay-summary-status">{batch.statusLabel}</span>
          </dd>
        </div>
        <div>
          <dt>Schedule</dt>
          <dd>
            <span className="qi-row pay-inline-row">
              <IconCalendar />
              <span>
                {batch.dates}{" "}
                <span className="mono">· {batch.days}</span>
              </span>
            </span>
            <span className="qi-row pay-inline-row">
              <IconClock />
              <span>{batch.time}</span>
            </span>
          </dd>
        </div>
        <div>
          <dt>Seats</dt>
          <dd>
            <span className="qi-row pay-inline-row">
              <IconUsers />
              <span>
                <b>
                  {filled} / {seatLimit}
                </b>{" "}
                filled
                {seats ? ` · ${remaining} left` : ` · max ${seatLimit}`}
              </span>
            </span>
            {seats ? (
              <span className="pay-summary-seat-line mono">
                {formatSeatLine(seats)}
              </span>
            ) : null}
          </dd>
        </div>
      </dl>

      <p className="pay-summary-note">
        No account needed to pay. After we confirm your payment, we&apos;ll
        email you a registration link to create your account and unlock Basic
        access.
      </p>
    </aside>
  );
}
