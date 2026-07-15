import { AuthConfirmClient } from "@/app/auth/confirm/auth-confirm-client";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token_hash = Array.isArray(params.token_hash)
    ? params.token_hash[0]
    : params.token_hash;
  const type = Array.isArray(params.type) ? params.type[0] : params.type;

  // Always collect a password on invite links (including magic-link resends).
  return (
    <AuthConfirmClient
      tokenHash={token_hash}
      type={type || "invite"}
      requirePassword
    />
  );
}
