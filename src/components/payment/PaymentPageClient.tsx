"use client";

import { useCallback, useState } from "react";
import type { BatchInfo } from "@/lib/batches";
import type { PaymentMethodPublic } from "@/lib/payment-types";
import type { SeatStats } from "@/lib/seats";
import HowToPay from "./HowToPay";
import PayDownCue from "./PayDownCue";
import PaymentMethodsList from "./PaymentMethodsList";
import PaymentProofForm from "./PaymentProofForm";
import ReservationSummary from "./ReservationSummary";

type Props = {
  batch: BatchInfo;
  initialMethods: PaymentMethodPublic[];
  methodsError: string | null;
  seats?: SeatStats;
};

export default function PaymentPageClient({
  batch,
  initialMethods,
  methodsError,
  seats,
}: Props) {
  const [selectedMethod, setSelectedMethod] =
    useState<PaymentMethodPublic | null>(initialMethods[0] ?? null);

  const onSelect = useCallback((method: PaymentMethodPublic) => {
    setSelectedMethod(method);
  }, []);

  return (
    <div className="pay-page">
      <div className="wrap">
        <div className="pay-hero">
          <span className="badge">Manual seat reservation · Basic</span>
          <h1>
            Reserve {batch.name}
            <em> (pay via bank or e-wallet)</em>
          </h1>
          <p className="pay-hero-sub">
            Send ₱1,999 using one of our payment channels, then submit your
            receipt for verification. No account required yet.
          </p>
        </div>

        {/*
          Grid keeps How to pay top-aligned with Reservation summary.
          Cues span full width so arrows are centered under both columns.
        */}
        <div className="pay-layout">
          <div className="pay-main pay-main-top">
            <HowToPay />
          </div>

          <div className="pay-aside">
            <ReservationSummary batch={batch} sticky seats={seats} />
          </div>

          <div className="pay-cue-span">
            <PayDownCue
              label="Next: payment methods"
              hint="Next: choose a bank or e-wallet to pay"
            />
          </div>

          <div className="pay-main">
            <PaymentMethodsList
              initialMethods={initialMethods}
              initialError={methodsError}
              selectedId={selectedMethod?.id ?? null}
              onSelect={onSelect}
            />
          </div>

          <div className="pay-cue-span">
            <PayDownCue
              label="Next: submit payment proof"
              hint="Next: submit your proof after paying"
            />
          </div>

          <div className="pay-main">
            <PaymentProofForm batch={batch} selectedMethod={selectedMethod} />
          </div>
        </div>
      </div>

      <div className="pay-mobile-bar">
        <div>
          <span className="pay-mobile-bar-batch">{batch.name}</span>
          <span className="pay-mobile-bar-meta">Basic · {batch.dates}</span>
        </div>
        <strong className="pay-mobile-bar-amount">{batch.priceLabel}</strong>
      </div>
    </div>
  );
}
