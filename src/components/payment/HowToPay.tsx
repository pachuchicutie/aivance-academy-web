const STEPS = [
  {
    n: "01",
    title: "Choose a payment method",
    body: "Pick a bank transfer or e-wallet from the list below.",
  },
  {
    n: "02",
    title: "Send the exact amount",
    body: "Transfer ₱1,999 or scan the QR code. Use the exact amount.",
  },
  {
    n: "03",
    title: "Save your reference number",
    body: "Keep the transaction / reference number from your bank or wallet.",
  },
  {
    n: "04",
    title: "Submit your proof",
    body: "Fill in your details, attach a receipt screenshot, and send for review.",
  },
];

export default function HowToPay() {
  return (
    <section className="pay-section" aria-labelledby="how-to-pay-heading">
      <div className="pay-section-head">
        <span className="eyebrow">Manual payment</span>
        <h2 id="how-to-pay-heading">How to pay</h2>
        <p>
          Payments are reviewed by our team. Course access unlocks only after
          confirmation, never automatically from this page.
        </p>
      </div>
      <ol className="pay-steps-grid">
        {STEPS.map((step) => (
          <li key={step.n} className="pay-step-card">
            <span className="pay-step-n">{step.n}</span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
