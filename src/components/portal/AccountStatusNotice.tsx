"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-client";

export function AccountStatusNotice({
  status,
}: {
  status: "suspended" | "deactivated";
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const supabase = createSupabaseAuthClient();
      await supabase.auth.signOut();
      router.replace("/portal/login");
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <div className="pt-status-page">
      <section className="pt-status-card" aria-live="polite">
        <span className="pt-status-icon" aria-hidden="true">
          <ShieldAlert size={26} />
        </span>
        <h1>
          {status === "suspended"
            ? "Your account is suspended"
            : "Your account is deactivated"}
        </h1>
        <p>
          {status === "suspended"
            ? "Portal access is paused for this account. If you believe this is a mistake, please contact the academy team and we'll help you sort it out."
            : "This account is no longer active. If you'd like to return to AIvanza Academy, please contact the academy team."}
        </p>
        <button
          type="button"
          className="pt-btn pt-btn-primary"
          onClick={() => void signOut()}
          disabled={signingOut}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </section>
    </div>
  );
}
