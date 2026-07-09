type SeatMeterProps = {
  filled: number;
  total?: number;
};

export default function SeatMeter({ filled, total = 25 }: SeatMeterProps) {
  return (
    <div
      className="seat-meter"
      role="img"
      aria-label={`${filled} of ${total} seats filled`}
    >
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < filled ? "filled" : undefined} />
      ))}
    </div>
  );
}
