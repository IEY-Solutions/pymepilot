import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Recovery links from email use the implicit flow (tokens in URL hash),
      // handled by /auth/callback via setSession. Avoids the PKCE code-verifier
      // fragility of exchangeCodeForSession for cross-context email links.
      auth: { flowType: "implicit" },
    }
  );
}
