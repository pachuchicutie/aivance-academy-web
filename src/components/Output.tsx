import Reveal from "./Reveal";
import { IconCheckSmall } from "./Icons";

const ITEMS = [
  "AI use case list",
  "Personal prompt library",
  "Landing page draft",
  "Customer inquiry flow",
  "Sales tracker",
  "Basic workflow map",
  "Final AI business system concept",
];

export default function Output() {
  return (
    <section>
      <div className="wrap">
        <Reveal className="output-panel">
          <div>
            <span className="eyebrow">Final Bootcamp Output</span>
            <h2>Build Your First AI-Powered Business Workflow</h2>
            <p className="lead">
              By the end of Day 2, you&apos;ll leave with a complete set of
              practical outputs — the starting system of your own AI-powered
              workflow.
            </p>
          </div>
          <ul className="checklist">
            {ITEMS.map((item) => (
              <li key={item}>
                <span className="check-dot">
                  <IconCheckSmall />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
