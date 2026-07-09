import Reveal from "./Reveal";
import {
  IconTarget,
  IconSliders,
  IconBuilding,
  IconBriefcase,
  IconGrad,
} from "./Icons";

const WHO = [
  {
    icon: IconTarget,
    title: "Beginners",
    desc: "Start from zero with guided, jargon-free lessons.",
  },
  {
    icon: IconSliders,
    title: "Freelancers",
    desc: "Add AI skills that widen the services you can offer.",
  },
  {
    icon: IconBuilding,
    title: "Business Owners",
    desc: "Use AI to support inquiries, sales, and operations.",
  },
  {
    icon: IconBriefcase,
    title: "Professionals",
    desc: "Boost productivity and future-proof your career.",
  },
  {
    icon: IconGrad,
    title: "Students & Portfolio Builders",
    desc: "Create outputs you can showcase and build on.",
  },
];

export default function WhoFor() {
  return (
    <section id="who">
      <div className="wrap">
        <Reveal className="section-head">
          <span className="eyebrow">Who It’s For</span>
          <h2>Built for Beginners and Future-Ready Learners</h2>
        </Reveal>
        <div className="who-grid">
          {WHO.map(({ icon: Icon, title, desc }) => (
            <Reveal key={title} className="glass-card who-card">
              <div className="icon-chip">
                <Icon />
              </div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
