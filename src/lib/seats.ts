import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { BatchId } from "@/lib/batches";
import { BOOTCAMP } from "@/lib/batches";

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

function normalizeStats(
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

export async function getBatchSeatStatus(): Promise<BatchSeatStatus> {
  const fallback = defaultBatchSeatStatus();

  if (!isSupabaseConfigured()) {
    return fallback;
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_public_batch_seats");

    if (error || !data) {
      console.error("get_public_batch_seats failed:", error?.message);
      return fallback;
    }

    const payload = data as {
      seat_limit?: number;
      batches?: Record<string, { filled?: number; remaining?: number; percent?: number }>;
    };

    const seatLimit = Number(payload.seat_limit) || BOOTCAMP.seatLimit;
    const batches = payload.batches ?? {};

    return {
      seatLimit,
      batches: {
        "1": normalizeStats(batches["1"], seatLimit),
        "2": normalizeStats(batches["2"], seatLimit),
      },
    };
  } catch (err) {
    console.error("getBatchSeatStatus error:", err);
    return fallback;
  }
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
