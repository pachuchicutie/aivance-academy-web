"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { PaymentMethodPublic } from "@/lib/payment-types";
import { methodTypeLabel } from "@/lib/payment-types";

type Props = {
  initialMethods: PaymentMethodPublic[];
  initialError: string | null;
  selectedId: string | null;
  onSelect: (method: PaymentMethodPublic) => void;
};

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = value;
      el.setAttribute("readonly", "");
      el.style.position = "absolute";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

export default function PaymentMethodsList({
  initialMethods,
  initialError,
  selectedId,
  onSelect,
}: Props) {
  const [methods, setMethods] = useState(initialMethods);
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const eWallets = methods.filter((m) => m.method_type === "e_wallet");
    const banks = methods.filter((m) => m.method_type === "bank");
    const other = methods.filter((m) => m.method_type === "other");
    return { eWallets, banks, other, all: methods };
  }, [methods]);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payment-methods", { cache: "no-store" });
      const data = (await res.json()) as {
        methods?: PaymentMethodPublic[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Unable to load payment methods.");
        setMethods([]);
        return;
      }
      const next = data.methods ?? [];
      setMethods(next);
      setError(null);
      if (next[0] && (!selectedId || !next.some((m) => m.id === selectedId))) {
        onSelect(next[0]);
      }
    } catch {
      setError(
        "Unable to load payment methods. Check your connection and try again."
      );
      setMethods([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy(id: string, value: string) {
    const ok = await copyText(value);
    if (ok) {
      setCopiedId(id);
      window.setTimeout(
        () => setCopiedId((cur) => (cur === id ? null : cur)),
        1800
      );
    }
  }

  function sectionShell(children: ReactNode) {
    return (
      <section className="pay-section pay-methods" aria-labelledby="payment-methods-heading">
        <div className="pay-section-head">
          <span className="eyebrow">Where to pay</span>
          <h2 id="payment-methods-heading">Payment methods</h2>
          <p>
            Select the channel you will use, then send the exact amount. Only
            active methods managed by AIvanza Academy are shown.
          </p>
        </div>
        {children}
      </section>
    );
  }

  if (loading) {
    return sectionShell(
      <div className="pay-state" aria-busy="true">
        <div className="pay-skeleton" />
        <div className="pay-skeleton" />
        <p className="pay-state-text">Loading active payment methods…</p>
      </div>
    );
  }

  if (error) {
    return sectionShell(
      <div className="pay-state pay-state-error" role="alert">
        <p>{error}</p>
        <div className="pay-state-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void reload()}
          >
            Try again
          </button>
          <a className="btn btn-ghost" href="mailto:hello@aivanzaacademy.com">
            Message Us
          </a>
        </div>
      </div>
    );
  }

  if (grouped.all.length === 0) {
    return sectionShell(
      <div className="pay-state">
        <p className="pay-state-text">
          No payment channels are available right now. Please message us and
          we&apos;ll help you reserve a seat.
        </p>
        <div className="pay-state-actions">
          <a className="btn btn-primary" href="mailto:hello@aivanzaacademy.com">
            Message Us
          </a>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void reload()}
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  function renderGroup(title: string, list: PaymentMethodPublic[]) {
    if (list.length === 0) return null;
    return (
      <div className="pay-method-group" key={title}>
        <h3 className="pay-method-group-title">{title}</h3>
        <div className="pay-method-grid">
          {list.map((method) => {
            const selected = method.id === selectedId;
            return (
              <article
                key={method.id}
                className={`pay-method-card${selected ? " selected" : ""}`}
              >
                <button
                  type="button"
                  className="pay-method-select"
                  onClick={() => onSelect(method)}
                  aria-pressed={selected}
                >
                  <span className="pay-method-type">
                    {methodTypeLabel(method.method_type)}
                  </span>
                  <span className="pay-method-provider">
                    {method.provider_name}
                  </span>
                  {selected && (
                    <span className="pay-method-selected-tag">Selected</span>
                  )}
                </button>

                <div className="pay-method-body">
                  <div className="pay-method-details">
                    <div className="pay-method-field">
                      <span className="pay-field-label">Account name</span>
                      <span className="pay-field-value">
                        {method.account_name}
                      </span>
                    </div>

                    {method.account_number && (
                      <div className="pay-method-field">
                        <span className="pay-field-label">
                          {method.method_type === "e_wallet"
                            ? "Mobile / account number"
                            : "Account number"}
                        </span>
                        <div className="pay-copy-row">
                          <code className="pay-account-number">
                            {method.account_number}
                          </code>
                          <button
                            type="button"
                            className="btn btn-ghost pay-copy-btn"
                            onClick={() =>
                              void handleCopy(method.id, method.account_number!)
                            }
                          >
                            {copiedId === method.id ? "Copied" : "Copy"}
                          </button>
                        </div>
                        <p className="pay-after-pay-hint">
                          Already paid? Scroll down and submit your payment
                          proof (name, email, reference number, and receipt) so
                          we can verify and email your registration link.
                        </p>
                      </div>
                    )}

                    {!method.account_number && (
                      <p className="pay-after-pay-hint">
                        Already paid? Scroll down and submit your payment proof
                        (name, email, reference number, and receipt) so we can
                        verify and email your registration link.
                      </p>
                    )}

                    {method.instructions && (
                      <p className="pay-method-instructions">
                        {method.instructions}
                      </p>
                    )}
                  </div>

                  {method.qr_image_url && (
                    <div className="pay-qr-block">
                      <span className="pay-field-label">Scan to pay (QR)</span>
                      <button
                        type="button"
                        className="pay-qr-btn"
                        onClick={() => setQrPreview(method.qr_image_url)}
                        aria-label={`Open full-size ${method.provider_name} QR code for scanning`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={method.qr_image_url}
                          alt={`${method.provider_name} payment QR code`}
                          className="pay-qr-image"
                        />
                        <span className="pay-qr-hint">
                          Tap for full-screen QR
                        </span>
                      </button>
                      <p className="pay-qr-scan-note">
                        Point your e-wallet camera at the code. Open full-screen
                        if you need a larger view.
                      </p>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <>
      {sectionShell(
        <>
          {renderGroup("E-wallets", grouped.eWallets)}
          {renderGroup("Bank transfer", grouped.banks)}
          {renderGroup("Other", grouped.other)}
        </>
      )}

      {qrPreview && (
        <div
          className="pay-qr-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Full-size payment QR code"
          onClick={() => setQrPreview(null)}
        >
          <div
            className="pay-qr-modal-inner"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pay-qr-modal-title">Scan this QR code</div>
            <p className="pay-qr-modal-sub">
              Large view for easy scanning with your phone camera.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrPreview} alt="Full-size payment QR code for scanning" />
            <div className="pay-qr-modal-actions">
              <a
                className="btn btn-ghost"
                href={qrPreview}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open image
              </a>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setQrPreview(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
