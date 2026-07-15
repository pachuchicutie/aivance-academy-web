import type { BatchId } from "@/lib/batches";
import { BOOTCAMP } from "@/lib/batches";

/**
 * Client-safe seat helpers and types.
 * Server-only seat fetching lives in seats-server.ts so client components
 * never pull in next/headers via the Supabase server client.
 */

export type SeatStats = {
  filled: number;
  remaining: number;
  percent: number;
  seatLimit: number;
};

export type BatchSeatStatus = {
  seatLimit: number;
  batches: Record<BatchId, SeatStats>;
};

function emptyStats(seatLimit: number): SeatStats {
  return {
    filled: 0,
    remaining: seatLimit,
    percent: 0,
    seatLimit,
  };
}

export function defaultBatchSeatStatus(): BatchSeatStatus {
  const seatLimit = BOOTCAMP.seatLimit;
  return {
    seatLimit,
    batches: {
      "1": emptyStats(seatLimit),
      "2": emptyStats(seatLimit),
    },
  };
}

export function normalizeSeatStats(
  raw: { filled?: number; remaining?: number; percent?: number } | null | undefined,
  seatLimit: number
): SeatStats {
  const filled = Math.max(0, Math.min(seatLimit, Number(raw?.filled ?? 0) || 0));
  const remaining =
    raw?.remaining != null
      ? Math.max(0, Number(raw.remaining) || 0)
      : Math.max(seatLimit - filled, 0);
  const percent =
    raw?.percent != null
      ? Math.max(0, Math.min(100, Number(raw.percent) || 0))
      : seatLimit > 0
        ? Math.min(100, Math.round((filled / seatLimit) * 100))
        : 0;

  return { filled, remaining, percent, seatLimit };
}

export function seatStatusLabel(stats: SeatStats): string {
  if (stats.filled >= stats.seatLimit) return "Full";
  if (stats.filled === 0) return "Open";
  if (stats.remaining <= 5) return "Almost full";
  return "Open for Enrollment";
}

export function formatSeatLine(stats: SeatStats): string {
  return `${stats.filled} / ${stats.seatLimit} filled · ${stats.percent}%`;
}
