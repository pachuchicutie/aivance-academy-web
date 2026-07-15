import type { Metadata } from "next";
import Link from "next/link";
import PaymentHeader from "@/components/payment/PaymentHeader";
import PaymentFooter from "@/components/payment/PaymentFooter";
import PaymentPageClient from "@/components/payment/PaymentPageClient";
import { BATCHES, getBatch, parseBatchId, paymentPath } from "@/lib/batches";
import { fetchActivePaymentMethods } from "@/lib/payment-methods";
import { formatSeatLine } from "@/lib/seats";
import { getBatchSeatStatus } from "@/lib/seats-server";
import { IconCalendar, IconClock } from "@/components/Icons";
import SeatMeter from "@/components/SeatMeter";

export const metadata: Metadata = {
  title: "Reserve Your Seat | Manual Payment | AIvanza Academy",
  description:
    "Pay manually via bank transfer or e-wallet for the AIvanza Academy 2-Day AI Specialist Starter Bootcamp (Basic). Submit your payment proof for review. No account required.",
};

/** Keep payment page seat counts fresh. */
export const revalidate = 30;

type PageProps = {
  searchParams: Promise<{ batch?: string | string[] }>;
};

export default async function PaymentPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const batchId = parseBatchId(params.batch);

  const seatStatus = await getBatchSeatStatus();

  if (!batchId) {
    return (
      <>
        <PaymentHeader />
        <main>
          <div className="pay-page">
            <div className="wrap pay-hero">
              <span className="badge">Manual seat reservation · Basic</span>
              <h1>
                Choose a batch <em>to continue payment</em>
              </h1>
              <p className="pay-hero-sub">
                Select Batch 1 or Batch 2 to see payment details and submit your
                proof. General “Reserve Your Seat” links always go to the
                schedule section first.
              </p>
            </div>
            <div className="wrap batch-grid">
              {Object.values(BATCHES).map((batch) => {
                const stats = seatStatus.batches[batch.id];
                const isFull = stats.filled >= stats.seatLimit;
                return (
                  <article key={batch.id} className="batch-card">
                    <div className="batch-head">
                      <h3>{batch.name}</h3>
                      <span
                        className={`status ${isFull ? "full" : batch.id === "1" ? "open" : "next"}`}
                      >
                        {isFull
                          ? "Fully Booked"
                          : batch.id === "1"
                            ? "Open for Enrollment"
                            : "Next Available Batch"}
                      </span>
                    </div>
                    <div className="batch-meta">
                      <div className="qi-row">
                        <IconCalendar />
                        <span>
                          <b>{batch.dates}</b>{" "}
                          <span className="mono">· {batch.days}</span>
                        </span>
                      </div>
                      <div className="qi-row">
                        <IconClock />
                        <span>{batch.time}</span>
                      </div>
                    </div>
                    <div className="batch-price">
                      <span className="amount">{batch.priceLabel}</span>
                      <span className="cap">{stats.seatLimit} SEATS ONLY</span>
                    </div>
                    <div className="seat-block">
                      <div className="mono-line">
                        <span>SEAT STATUS</span>
                        <b>{formatSeatLine(stats)}</b>
                      </div>
                      <SeatMeter filled={stats.filled} total={stats.seatLimit} />
                    </div>
                    {isFull ? (
                      <span className="btn btn-ghost batch-full-btn" aria-disabled="true">
                        Batch full
                      </span>
                    ) : (
                      <Link
                        className="btn btn-primary"
                        href={paymentPath(batch.id)}
                      >
                        Reserve for {batch.name}
                      </Link>
                    )}
                  </article>
                );
              })}
            </div>
            <div className="wrap" style={{ marginTop: 28 }}>
              <Link className="btn btn-ghost" href="/#schedule">
                Back to schedule
              </Link>
            </div>
          </div>
        </main>
        <PaymentFooter />
      </>
    );
  }

  const batch = getBatch(batchId);
  const [{ methods, error }, seats] = await Promise.all([
    fetchActivePaymentMethods(),
    Promise.resolve(seatStatus),
  ]);

  return (
    <>
      <PaymentHeader />
      <main>
        <PaymentPageClient
          batch={batch}
          initialMethods={methods}
          methodsError={error}
          seats={seats.batches[batchId]}
        />
      </main>
      <PaymentFooter />
    </>
  );
}
