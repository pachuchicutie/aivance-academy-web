type Props = {
  label?: string;
  hint?: string;
};

/** Scroll cue between payment-page sections. */
export default function PayDownCue({
  label = "Continue",
  hint = "Scroll down for the next step",
}: Props) {
  return (
    <div className="pay-down-cue" aria-hidden="true">
      <span className="pay-down-cue-line" />
      <div className="pay-down-cue-mid">
        <span className="pay-down-cue-icon" title={label}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
        {hint ? <span className="pay-down-cue-hint">{hint}</span> : null}
      </div>
      <span className="pay-down-cue-line" />
    </div>
  );
}
