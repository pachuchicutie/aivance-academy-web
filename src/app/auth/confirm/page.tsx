import { AuthConfirmClient } from "./auth-confirm-client";

export const dynamic = "force-dynamic";

export default async function AuthConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token_hash = Array.isArray(params.token_hash)
    ? params.token_hash[0]
    : params.token_hash;
  const type = Array.isArray(params.type) ? params.type[0] : params.type;

  return <AuthConfirmClient tokenHash={token_hash} type={type} />;
}
