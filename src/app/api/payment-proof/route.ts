import { NextResponse } from "next/server";
import { BOOTCAMP, parseBatchId } from "@/lib/batches";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/jpg"]);

type GuestPaymentResult = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  status?: string | null;
  batch?: string | null;
  reference_number?: string | null;
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function extensionForMime(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

function parseGuestPaymentResult(data: unknown): GuestPaymentResult | null {
  // New RPC returns jsonb: { id, full_name, email, ... }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const row = data as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id : null;
    if (!id) return null;
    return {
      id,
      full_name: typeof row.full_name === "string" ? row.full_name : null,
      email: typeof row.email === "string" ? row.email : null,
      status: typeof row.status === "string" ? row.status : null,
      batch: typeof row.batch === "string" ? row.batch : null,
      reference_number:
        typeof row.reference_number === "string" ? row.reference_number : null,
    };
  }

  // Legacy RPC returned bare uuid string
  if (typeof data === "string" && data.length > 0) {
    return { id: data };
  }

  return null;
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          "Payment submission is not available right now. Please email hello@aivanzaacademy.com with your receipt.",
      },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return badRequest("Invalid form submission.");
  }

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const contactNumber = String(formData.get("contact_number") ?? "").trim();
  const referenceNumber = String(formData.get("reference_number") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const paymentMethodId = String(formData.get("payment_method_id") ?? "").trim();
  const paymentMethodLabel = String(formData.get("payment_method") ?? "").trim();
  const batchParam = String(formData.get("batch") ?? "").trim();
  const batchId = parseBatchId(batchParam);
  const receipt = formData.get("receipt");

  if (!fullName) return badRequest("Full name is required.");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return badRequest("A valid email address is required.");
  }
  if (!referenceNumber) return badRequest("Reference number is required.");
  if (!batchId) return badRequest("Please select a valid batch.");
  if (!paymentMethodId && !paymentMethodLabel) {
    return badRequest("Please select the payment method you used.");
  }
  if (!(receipt instanceof File) || receipt.size === 0) {
    return badRequest("Payment receipt / screenshot image is required.");
  }
  if (!ALLOWED_TYPES.has(receipt.type) && !receipt.type.startsWith("image/")) {
    return badRequest("Receipt must be a PNG, JPG, or WEBP image.");
  }
  if (receipt.size > MAX_FILE_BYTES) {
    return badRequest("Receipt image must be 8 MB or smaller.");
  }

  const supabase = createSupabaseServerClient();

  // Block duplicate / already-registered emails before uploading the receipt.
  const { data: emailStatus, error: emailStatusError } = await supabase.rpc(
    "get_guest_payment_email_status",
    { p_email: email }
  );

  if (emailStatusError) {
    // If the checker RPC isn't deployed yet, continue and let submit enforce later.
    const missingChecker =
      emailStatusError.message?.includes("Could not find the function") ||
      emailStatusError.message?.includes("schema cache");
    if (!missingChecker) {
      return NextResponse.json(
        {
          error:
            emailStatusError.message ||
            "Unable to verify email. Please try again.",
        },
        { status: 500 }
      );
    }
  } else if (
    emailStatus &&
    typeof emailStatus === "object" &&
    (emailStatus as { available?: boolean }).available === false
  ) {
    const message =
      (emailStatus as { message?: string }).message ||
      "This email cannot be used for another payment submission.";
    return NextResponse.json({ error: message, code: (emailStatus as { code?: string }).code }, { status: 409 });
  }

  let methodLabel = paymentMethodLabel;
  let resolvedMethodId: string | null = paymentMethodId || null;

  if (paymentMethodId) {
    const { data: method, error: methodError } = await supabase
      .from("payment_methods")
      .select("id, provider_name, method_type, is_active")
      .eq("id", paymentMethodId)
      .maybeSingle();

    if (methodError) {
      return NextResponse.json(
        { error: methodError.message || "Unable to verify payment method." },
        { status: 500 }
      );
    }

    if (!method || method.is_active === false) {
      return badRequest("Selected payment method is not available.");
    }

    methodLabel =
      paymentMethodLabel ||
      `${method.provider_name} (${
        method.method_type === "e_wallet"
          ? "E-wallet"
          : method.method_type === "bank"
            ? "Bank"
            : "Other"
      })`;
    resolvedMethodId = method.id;
  }

  if (!methodLabel) {
    return badRequest("Please select the payment method you used.");
  }

  const batchName = batchId === "1" ? "Batch 1" : "Batch 2";
  const ext = extensionForMime(receipt.type || "image/jpeg");
  const path = `guest/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const fileBuffer = Buffer.from(await receipt.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("payment-proofs")
    .upload(path, fileBuffer, {
      contentType: receipt.type || "image/jpeg",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      {
        error:
          uploadError.message ||
          "Unable to upload receipt image. Please try again.",
      },
      { status: 500 }
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("payment-proofs").getPublicUrl(path);

  // Explicit named args — must match submit_guest_payment_proof signature.
  // Submit RPC re-checks email uniqueness as the source of truth.
  const { data: rawResult, error: submitError } = await supabase.rpc(
    "submit_guest_payment_proof",
    {
      p_full_name: fullName,
      p_email: email,
      p_reference_number: referenceNumber,
      p_proof_url: publicUrl,
      p_payment_method: methodLabel,
      p_batch: batchName,
      p_amount: BOOTCAMP.amount,
      p_contact_number: contactNumber || null,
      p_notes: notes || null,
      p_payment_method_id: resolvedMethodId,
    }
  );

  if (submitError) {
    await supabase.storage.from("payment-proofs").remove([path]);

    const message = submitError.message || "";
    const isDuplicate =
      message.toLowerCase().includes("already") ||
      message.toLowerCase().includes("pending review") ||
      submitError.code === "23505";

    if (isDuplicate) {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    const migrationHint =
      message.includes("full_name") ||
      message.includes("schema cache") ||
      message.includes("Could not find the function") ||
      message.includes("column")
        ? " Database guest-payment migration may be missing — run supabase/migrations/202607140002_block_duplicate_guest_payment_email.sql in the Supabase SQL Editor."
        : "";

    return NextResponse.json(
      {
        error:
          (message || "Unable to save payment proof. Please try again.") +
          migrationHint,
      },
      { status: 500 }
    );
  }

  const saved = parseGuestPaymentResult(rawResult);

  if (!saved?.id) {
    await supabase.storage.from("payment-proofs").remove([path]);
    return NextResponse.json(
      {
        error:
          "Payment was not saved correctly. Please try again or contact support.",
      },
      { status: 500 }
    );
  }

  // When the new RPC is applied it returns full_name — verify it matches.
  if (typeof rawResult === "object" && rawResult !== null) {
    const savedName = (saved.full_name ?? "").trim();
    if (!savedName) {
      await supabase.storage.from("payment-proofs").remove([path]);
      return NextResponse.json(
        {
          error:
            "Full name was not saved to the payment record. Run supabase/migrations/202607140001_ensure_guest_payment_identity.sql in the Supabase SQL Editor, then try again.",
        },
        { status: 500 }
      );
    }

    if (savedName.toLowerCase() !== fullName.toLowerCase()) {
      return NextResponse.json(
        {
          error:
            "Saved full name did not match the submitted value. Please contact support.",
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    id: saved.id,
    status: saved.status || "pending",
    full_name: saved.full_name || fullName,
    email: saved.email || email,
    batch: saved.batch || batchName,
    reference_number: saved.reference_number || referenceNumber,
    message:
      "Payment proof submitted. We’ll verify your payment manually. Once confirmed, we’ll email you a registration link to create your account.",
  });
}
