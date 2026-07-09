import Reveal from "./Reveal";
import { IconSun, IconWrench, IconActivity } from "./Icons";

export default function About() {
  return (
    <section id="about">
      <div className="wrap">
        <Reveal className="section-head">
          <span className="eyebrow">About the Bootcamp</span>
          <h2>Practical AI Training for the Future of Work and Business</h2>
        </Reveal>
        <Reveal className="about-body">
          <p>
            The AI Specialist Starter Bootcamp is a beginner-friendly 2-day
            training program designed to help students, freelancers,
            professionals, and business owners understand and apply AI in
            real-world tasks.
          </p>
          <p>
            Instead of focusing only on theory, this bootcamp teaches practical
            AI skills that learners can use for communication, productivity,
            business operations, portfolio building, automation, and digital
            workflows.
          </p>
        </Reveal>
        <div className="card-grid cols-3 about-cards">
          <Reveal className="glass-card">
            <div className="icon-chip">
              <IconSun />
            </div>
            <h3>Learn AI from Zero</h3>
            <p>
              Start with clear, jargon-free foundations. No technical background
              or coding experience required.
            </p>
          </Reveal>
          <Reveal className="glass-card">
            <div className="icon-chip">
              <IconWrench />
            </div>
            <h3>Create Practical Outputs</h3>
            <p>
              Walk away with real, usable outputs — not just notes. Every lesson
              builds toward something you keep.
            </p>
          </Reveal>
          <Reveal className="glass-card">
            <div className="icon-chip">
              <IconActivity />
            </div>
            <h3>Apply AI to Real Life</h3>
            <p>
              Use AI for work, business, portfolio building, and everyday
              productivity — starting day one.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
