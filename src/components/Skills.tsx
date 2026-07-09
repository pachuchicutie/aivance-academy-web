import Reveal from "./Reveal";
import {
  IconCode,
  IconZapSmall,
  IconChart,
  IconMonitor,
  IconSettings,
  IconBriefcase,
} from "./Icons";

const SKILLS = [
  { icon: IconCode, title: "Prompt Engineering Basics" },
  { icon: IconZapSmall, title: "AI Productivity" },
  { icon: IconChart, title: "AI for Business" },
  { icon: IconMonitor, title: "No-Code Creation" },
  { icon: IconSettings, title: "Automation Foundations" },
  { icon: IconBriefcase, title: "Portfolio Building" },
];

export default function Skills() {
  return (
    <section>
      <div className="wrap">
        <Reveal className="section-head">
          <span className="eyebrow">Skills</span>
          <h2>Skills You Can Apply Immediately</h2>
        </Reveal>
        <div className="card-grid cols-6">
          {SKILLS.map(({ icon: Icon, title }) => (
            <Reveal key={title} className="glass-card skill-card">
              <div className="icon-chip">
                <Icon />
              </div>
              <h3>{title}</h3>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
