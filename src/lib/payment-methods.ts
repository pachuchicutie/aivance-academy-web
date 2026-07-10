import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { PaymentMethodPublic } from "@/lib/payment-types";

export type PaymentMethodsResult = {
  methods: PaymentMethodPublic[];
  error: string | null;
};

export async function fetchActivePaymentMethods(): Promise<PaymentMethodsResult> {
  if (!isSupabaseConfigured()) {
    return {
      methods: [],
      error:
        "Payment methods are not configured yet. Please message us to complete your reservation.",
    };
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("payment_methods")
      .select(
        "id, method_type, provider_name, account_name, account_number, qr_image_url, instructions, sort_order"
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      return {
        methods: [],
        error: error.message || "Unable to load payment methods.",
      };
    }

    const methods = (data ?? []) as PaymentMethodPublic[];

    // Empty result can mean no rows yet, or public RLS not granted (migration pending).
    // Guest payment support is missing if guest columns / RPC aren't applied.
    if (methods.length === 0) {
      const { error: probeError } = await supabase
        .from("payments")
        .select("full_name")
        .limit(1);

      if (
        probeError?.message?.includes("full_name") ||
        probeError?.code === "42703"
      ) {
        return {
          methods: [],
          error:
            "Database is linked, but the guest payment migration is not applied yet. Run supabase/migrations/202607100002_guest_payment_proofs.sql in the Supabase SQL Editor, then add active payment methods in admin.",
        };
      }

      return {
        methods: [],
        error: null,
      };
    }

    return {
      methods,
      error: null,
    };
  } catch (err) {
    return {
      methods: [],
      error:
        err instanceof Error ? err.message : "Unable to load payment methods.",
    };
  }
}
