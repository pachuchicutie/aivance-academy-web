"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import type { BatchInfo } from "@/lib/batches";
import { BOOTCAMP } from "@/lib/batches";
import type { PaymentMethodPublic } from "@/lib/payment-types";

type Props = {
  batch: BatchInfo;
  selectedMethod: PaymentMethodPublic | null;
};

type FieldErrors = Partial<
  Record<
    "full_name" | "email" | "reference_number" | "receipt" | "payment_method",
    string
  >
>;

const ACCEPT = "image/png,image/jpeg,image/jpg,image/webp";
const MAX_BYTES = 8 * 1024 * 1024;

export default function PaymentProofForm({ batch, selectedMethod }: Props) {
  const formId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const previewUrl = useMemo(() => {
    if (!receipt) return null;
    return URL.createObjectURL(receipt);
  }, [receipt]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const methodLabel = useMemo(() => {
    if (!selectedMethod) return "";
    const type =
      selectedMethod.method_type === "e_wallet"
        ? "E-wallet"
        : selectedMethod.method_type === "bank"
          ? "Bank"
          : "Other";
    return `${selectedMethod.provider_name} (${type})`;
  }, [selectedMethod]);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!fullName.trim()) next.full_name = "Full name is required.";
    if (!email.trim()) next.email = "Email address is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Enter a valid email address.";
    }
    if (!referenceNumber.trim()) {
      next.reference_number = "Reference number is required.";
    }
    if (!selectedMethod) {
      next.payment_method = "Select the payment method you used above.";
    }
    if (!receipt) next.receipt = "Payment receipt / screenshot is required.";
    else if (receipt.size > MAX_BYTES) {
      next.receipt = "Image must be 8 MB or smaller.";
    } else if (
      receipt.type &&
      !["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(receipt.type)
    ) {
      next.receipt = "Use PNG, JPG, or WEBP only.";
    }
    return next;
  }

  function applyFile(file: File | null | undefined) {
    if (!file) return;
    setReceipt(file);
    setErrors((prev) => ({ ...prev, receipt: undefined }));
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    applyFile(file);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    applyFile(file);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (!selectedMethod || !receipt) return;

    setSubmitting(true);
    try {
      const body = new FormData();
      body.set("full_name", fullName.trim());
      body.set("email", email.trim());
      body.set("contact_number", contactNumber.trim());
      body.set("reference_number", referenceNumber.trim());
      body.set("notes", notes.trim());
      body.set("batch", batch.id);
      body.set("payment_method_id", selectedMethod.id);
      body.set("payment_method", methodLabel);
      body.set("receipt", receipt);

      const res = await fetch("/api/payment-proof", {
        method: "POST",
        body,
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        full_name?: string;
        email?: string;
        reference_number?: string;
      };

      if (!res.ok) {
        const errorText =
          data.error || "Unable to submit payment proof. Please try again.";
        // Duplicate / already-used email — highlight the email field too
        if (
          res.status === 409 ||
          (/email/i.test(errorText) &&
            (/already/i.test(errorText) ||
              /pending/i.test(errorText) ||
              /account/i.test(errorText)))
        ) {
          setErrors((prev) => ({ ...prev, email: errorText }));
        }
        setSubmitError(errorText);
        return;
      }

      const savedName = data.full_name?.trim() || fullName.trim();
      const savedEmail = data.email?.trim() || email.trim();
      const baseMessage =
        data.message ||
        "Payment proof submitted. We’ll verify your payment manually. Once confirmed, we’ll email you a registration link to create your account.";

      setSuccessMessage(
        `${baseMessage}\n\nSaved as: ${savedName} · ${savedEmail}${
          data.reference_number ? ` · Ref ${data.reference_number}` : ""
        }`
      );
      setFullName("");
      setEmail("");
      setContactNumber("");
      setReferenceNumber("");
      setNotes("");
      setReceipt(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setErrors({});
    } catch {
      setSubmitError(
        "Network error while submitting. Please check your connection and try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (successMessage) {
    return (
      <section className="pay-section" aria-live="polite">
        <div className="pay-success">
          <span className="eyebrow">Submitted</span>
          <h2>Payment proof received</h2>
          {successMessage.split("\n\n").map((part, i) => (
            <p key={i}>{part}</p>
          ))}
          <ul className="pay-success-list">
            <li>
              Status: <b>Pending review</b> — not confirmed yet
            </li>
            <li>
              Tier: <b>Basic</b> (granted only after confirmation + signup)
            </li>
            <li>
              Batch: <b>{batch.name}</b>
            </li>
            <li>
              Amount: <b>{BOOTCAMP.amountLabel}</b>
            </li>
          </ul>
          <div className="pay-state-actions">
            <Link className="btn btn-primary" href="/">
              Back to home
            </Link>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setSuccessMessage(null)}
            >
              Submit another proof
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="pay-section" aria-labelledby="proof-form-heading">
      <div className="pay-section-head">
        <span className="eyebrow">After you pay</span>
        <h2 id="proof-form-heading">Submit payment proof</h2>
        <p>
          No account required. Use the email where we should send your
          registration link after we confirm payment.
        </p>
      </div>

      <form className="pay-form" onSubmit={onSubmit} noValidate>
        <div className="pay-form-meta">
          <div className="pay-meta-item">
            <span className="pay-field-label">Batch</span>
            <strong>
              {batch.name} · {batch.dates}
            </strong>
          </div>
          <div className="pay-meta-item">
            <span className="pay-field-label">Amount</span>
            <strong>{BOOTCAMP.amountLabel}</strong>
          </div>
          <div className="pay-meta-item">
            <span className="pay-field-label">Tier</span>
            <strong>{BOOTCAMP.tierLabel}</strong>
          </div>
          <div className="pay-meta-item">
            <span className="pay-field-label">Method</span>
            <strong>
              {methodLabel || (
                <span className="pay-muted">Select a method above</span>
              )}
            </strong>
          </div>
        </div>
        {errors.payment_method && (
          <p className="pay-field-error" role="alert">
            {errors.payment_method}
          </p>
        )}

        <p className="pay-form-note">
          Use an email you can access — we&apos;ll send your registration link
          there after payment is confirmed. Each email can only have one active
          payment proof (pending or confirmed).
        </p>

        <div className="pay-form-grid">
          <label className="pay-field" htmlFor={`${formId}-name`}>
            <span className="pay-field-label">
              Full name <span className="req">*</span>
            </span>
            <input
              id={`${formId}-name`}
              name="full_name"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Juan Dela Cruz"
              required
              aria-invalid={Boolean(errors.full_name)}
            />
            <span className="pay-field-footer">
              {errors.full_name ? (
                <span className="pay-field-error">{errors.full_name}</span>
              ) : null}
            </span>
          </label>

          <label className="pay-field" htmlFor={`${formId}-email`}>
            <span className="pay-field-label">
              Email address <span className="req">*</span>
            </span>
            <input
              id={`${formId}-email`}
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              required
              aria-invalid={Boolean(errors.email)}
            />
            <span className="pay-field-footer">
              {errors.email ? (
                <span className="pay-field-error">{errors.email}</span>
              ) : null}
            </span>
          </label>

          <label className="pay-field" htmlFor={`${formId}-contact`}>
            <span className="pay-field-label">Contact number (optional)</span>
            <input
              id={`${formId}-contact`}
              name="contact_number"
              type="tel"
              autoComplete="tel"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              placeholder="09XX XXX XXXX"
            />
            <span className="pay-field-footer" />
          </label>

          <label className="pay-field" htmlFor={`${formId}-ref`}>
            <span className="pay-field-label">
              Reference number <span className="req">*</span>
            </span>
            <input
              id={`${formId}-ref`}
              name="reference_number"
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="Transaction / transfer reference"
              required
              aria-invalid={Boolean(errors.reference_number)}
            />
            <span className="pay-field-footer">
              {errors.reference_number ? (
                <span className="pay-field-error">{errors.reference_number}</span>
              ) : null}
            </span>
          </label>
        </div>

        <div className="pay-field pay-field-full">
          <span className="pay-field-label" id={`${formId}-receipt-label`}>
            Payment receipt / screenshot <span className="req">*</span>
          </span>
          <div
            className={`pay-upload${dragOver ? " drag-over" : ""}${previewUrl ? " has-preview" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-labelledby={`${formId}-receipt-label`}
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
          >
            <input
              ref={fileInputRef}
              id={`${formId}-receipt`}
              name="receipt"
              type="file"
              accept={ACCEPT}
              capture="environment"
              className="pay-upload-input"
              onChange={onFileChange}
              required
            />
            {previewUrl ? (
              <div className="pay-upload-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="Receipt preview" />
                <div className="pay-upload-preview-meta">
                  <strong>{receipt?.name}</strong>
                  <span>
                    {receipt
                      ? `${(receipt.size / 1024).toFixed(0)} KB · Click or drop to replace`
                      : ""}
                  </span>
                </div>
              </div>
            ) : (
              <div className="pay-upload-empty">
                <strong>Drag &amp; drop image here</strong>
                <span>or click to upload · PNG, JPG, WEBP · max 8 MB</span>
                <span className="pay-upload-mobile">
                  On mobile, you can take a photo or pick from gallery.
                </span>
              </div>
            )}
          </div>
          <span className="pay-field-footer">
            {errors.receipt ? (
              <span className="pay-field-error">{errors.receipt}</span>
            ) : null}
          </span>
        </div>

        <label className="pay-field pay-field-full" htmlFor={`${formId}-notes`}>
          <span className="pay-field-label">Notes / message (optional)</span>
          <textarea
            id={`${formId}-notes`}
            name="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything we should know about your transfer?"
          />
        </label>

        {submitError && (
          <div className="pay-submit-error" role="alert">
            <p>{submitError}</p>
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary pay-submit"
          disabled={submitting}
        >
          {submitting ? "Submitting…" : "Submit payment proof"}
        </button>

        <p className="pay-form-disclaimer">
          Submitting this form only queues your proof for manual review. It does
          not confirm payment or unlock course access.
        </p>
      </form>
    </section>
  );
}
