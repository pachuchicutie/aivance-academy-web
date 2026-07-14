export type BatchId = "1" | "2";

export type BatchInfo = {
  id: BatchId;
  name: string;
  dates: string;
  days: string;
  time: string;
  price: number;
  priceLabel: string;
  seatLimit: number;
  statusLabel: string;
};

export const BOOTCAMP = {
  name: "AIvanza Academy 2-Day AI Specialist Starter Bootcamp",
  shortName: "2-Day AI Specialist Starter Bootcamp",
  tier: "basic" as const,
  tierLabel: "Basic",
  amount: 1999,
  amountLabel: "₱1,999",
  seatLimit: 25,
  currency: "PHP",
};

export const BATCHES: Record<BatchId, BatchInfo> = {
  "1": {
    id: "1",
    name: "Batch 1",
    dates: "July 24–25, 2026",
    days: "Friday–Saturday",
    time: "9:00 AM – 2:00 PM",
    price: BOOTCAMP.amount,
    priceLabel: BOOTCAMP.amountLabel,
    seatLimit: BOOTCAMP.seatLimit,
    statusLabel: "Open for Enrollment",
  },
  "2": {
    id: "2",
    name: "Batch 2",
    dates: "July 31 – August 1, 2026",
    days: "Friday–Saturday",
    time: "9:00 AM – 2:00 PM",
    price: BOOTCAMP.amount,
    priceLabel: BOOTCAMP.amountLabel,
    seatLimit: BOOTCAMP.seatLimit,
    statusLabel: "Next Available Batch",
  },
};

export function parseBatchId(value: string | string[] | undefined): BatchId | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "1" || raw === "2") return raw;
  if (raw === "batch-1" || raw === "batch1") return "1";
  if (raw === "batch-2" || raw === "batch2") return "2";
  return null;
}

export function getBatch(id: BatchId): BatchInfo {
  return BATCHES[id];
}

export function paymentPath(batchId: BatchId): string {
  return `/payment?batch=${batchId}`;
}
