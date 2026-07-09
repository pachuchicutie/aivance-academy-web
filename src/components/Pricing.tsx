import Reveal from "./Reveal";
import { IconCheck } from "./Icons";

export default function Pricing() {
  return (
    <section>
      <div className="wrap pricing-wrap">
        <Reveal className="pricing-copy">
          <span className="eyebrow">Enrollment</span>
          <h2>Start Learning AI for Only ₱1,999</h2>
          <p>
            Join the AIvance Academy 2-Day AI Specialist Starter Bootcamp and
            gain practical AI skills for business, career growth, portfolio
            building, and everyday productivity.
          </p>
        </Reveal>
        <Reveal className="price-box">
          <span className="qi-label">Beginner Bootcamp Rate</span>
          <div className="price-big">
            ₱1,999 <small>/ full bootcamp</small>
          </div>
          <ul>
            <li>
              <IconCheck />
              Includes 2-day live bootcamp
            </li>
            <li>
              <IconCheck />
              Beginner-friendly lessons
            </li>
            <li>
              <IconCheck />
              Practical outputs and guided exercises
            </li>
            <li>
              <IconCheck />
              Limited to 25 seats per batch only
            </li>
          </ul>
          <a className="btn btn-primary" href="#schedule">
            Reserve Your Seat Now
          </a>
        </Reveal>
      </div>
    </section>
  );
}
