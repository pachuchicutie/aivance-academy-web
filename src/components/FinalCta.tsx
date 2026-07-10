import Reveal from "./Reveal";

export default function FinalCta() {
  return (
    <section className="final-cta" id="contact">
      <Reveal className="wrap">
        <span className="eyebrow" style={{ justifyContent: "center" }}>
          Next Step
        </span>
        <h2>Ready to Advance with AI?</h2>
        <p>
          Secure your spot in the next AIvanza Academy bootcamp and start
          building practical AI skills with guided, beginner-friendly learning.
        </p>
        <div className="hero-ctas">
          <a className="btn btn-primary" href="#schedule">
            Reserve Your Seat
          </a>
          <a className="btn btn-ghost" href="mailto:hello@aivanzaacademy.com">
            Message Us
          </a>
        </div>
      </Reveal>
    </section>
  );
}
