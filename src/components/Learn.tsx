import Reveal from "./Reveal";
import { IconCheck } from "./Icons";

export default function Learn() {
  return (
    <section id="learn">
      <div className="wrap">
        <Reveal className="section-head">
          <span className="eyebrow">What You’ll Learn</span>
          <h2>A 2-Day Bootcamp Designed for Practical AI Application</h2>
          <p>
            The bootcamp is structured to help beginners build a strong
            foundation first, then apply AI to practical business systems,
            automation workflows, and real-world productivity tasks.
          </p>
        </Reveal>
        <div className="day-grid">
          <Reveal as="article" className="day-card">
            <span className="day-chip">Day 01 · Foundations</span>
            <h3>AI Foundations and No-Code Creation</h3>
            <p>
              On Day 1, you will learn how AI works, how to use Large Language
              Models properly, and how to create useful outputs through better
              prompting. You will also learn how to turn ideas into a simple
              landing page using no-code AI-assisted creation. No coding
              experience is required.
            </p>
            <ul>
              <li>
                <IconCheck />
                How AI and Large Language Models work in simple terms
              </li>
              <li>
                <IconCheck />
                How to use AI assistants effectively
              </li>
              <li>
                <IconCheck />
                How to write better prompts for better results
              </li>
              <li>
                <IconCheck />
                How to use AI for business, work, portfolio building, and daily
                productivity
              </li>
              <li>
                <IconCheck />
                How to plan a simple landing page
              </li>
              <li>
                <IconCheck />
                How to create a landing page draft without coding
              </li>
            </ul>
            <div className="day-output">
              <span className="mono-tag">Output</span>
              <b>AI prompt library + landing page draft</b>
            </div>
          </Reveal>

          <Reveal as="article" className="day-card">
            <span className="day-chip">Day 02 · Systems</span>
            <h3>AI Automation and Business Systems</h3>
            <p>
              On Day 2, you will learn how AI can support real business
              operations through automation tools, customer inquiry flows, sales
              trackers, basic CRM concepts, ecommerce workflows, APIs, and
              webhooks.
            </p>
            <ul>
              <li>
                <IconCheck />
                How AI can support customer inquiries
              </li>
              <li>
                <IconCheck />
                How to create a simple customer support flow
              </li>
              <li>
                <IconCheck />
                How to organize sales and customer data
              </li>
              <li>
                <IconCheck />
                How sales trackers help monitor business activity
              </li>
              <li>
                <IconCheck />
                How basic CRM workflows help manage leads and follow-ups
              </li>
              <li>
                <IconCheck />
                How APIs and webhooks connect different tools
              </li>
              <li>
                <IconCheck />
                How to organize prompts, systems, and workflows for future use
              </li>
            </ul>
            <div className="day-output">
              <span className="mono-tag">Output</span>
              <b>Customer inquiry flow + sales tracker + AI business workflow</b>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
