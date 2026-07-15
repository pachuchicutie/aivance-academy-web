import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { BOOTCAMP } from "@/lib/batches";
import {
  defaultBatchSeatStatus,
  normalizeSeatStats,
  type BatchSeatStatus,
} from "@/lib/seats";

/** Server-only: loads live seat counts via Supabase RPC. */
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
      batches?: Record<
        string,
        { filled?: number; remaining?: number; percent?: number }
      >;
    };

    const seatLimit = Number(payload.seat_limit) || BOOTCAMP.seatLimit;
    const batches = payload.batches ?? {};

    return {
      seatLimit,
      batches: {
        "1": normalizeSeatStats(batches["1"], seatLimit),
        "2": normalizeSeatStats(batches["2"], seatLimit),
      },
    };
  } catch (err) {
    console.error("getBatchSeatStatus error:", err);
    return fallback;
  }
}
