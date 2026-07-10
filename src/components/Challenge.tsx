import Reveal from "./Reveal";
import { IconGrid, IconAlert, IconZap } from "./Icons";

export default function Challenge() {
  return (
    <section>
      <div className="wrap">
        <Reveal className="section-head">
          <span className="eyebrow">The Challenge</span>
          <h2>
            AI Is Moving Fast — But Most People Don’t Know Where to Start
          </h2>
          <p>
            Many people want to use AI but feel overwhelmed by too many tools,
            technical terms, and scattered tutorials. AIvanza Academy simplifies
            the learning path by teaching AI step by step and focusing on
            practical outputs.
          </p>
        </Reveal>
        <div className="card-grid cols-3">
          <Reveal className="glass-card">
            <div className="icon-chip">
              <IconGrid />
            </div>
            <h3>Too Many Tools</h3>
            <p>
              New AI tools launch every week. Without guidance, it’s hard to
              know which ones actually matter.
            </p>
          </Reveal>
          <Reveal className="glass-card">
            <div className="icon-chip">
              <IconAlert />
            </div>
            <h3>No Clear System</h3>
            <p>
              Scattered tutorials don’t add up to a skill. You need a
              step-by-step path from basics to application.
            </p>
          </Reveal>
          <Reveal className="glass-card">
            <div className="icon-chip">
              <IconZap />
            </div>
            <h3>No Practical Output</h3>
            <p>
              Watching videos isn’t the same as building. Learning should end
              with something you can use or show.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
