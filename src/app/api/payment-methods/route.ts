import { NextResponse } from "next/server";
import { fetchActivePaymentMethods } from "@/lib/payment-methods";

export const dynamic = "force-dynamic";

export async function GET() {
  const { methods, error } = await fetchActivePaymentMethods();

  if (error && methods.length === 0) {
    const status = error.includes("not configured") ? 503 : 500;
    return NextResponse.json({ methods, error }, { status });
  }

  return NextResponse.json({ methods, error: error ?? undefined });
}
