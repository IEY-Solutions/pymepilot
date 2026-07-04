import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const RESET_PASSWORD_PATH = "/reset-password";
const FORGOT_PASSWORD_PATH = "/forgot-password";
const INVALID_REASON = "recovery-invalid";
const MISSING_CODE_REASON = "recovery-missing-code";

/**
 * Resuelve el origin público real. En Vercel, request.url puede reflejar el
 * host interno del proxy, así que preferimos x-forwarded-host cuando existe.
 */
function resolveOrigin(request: Request, requestUrl: URL): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (!forwardedHost) {
    return requestUrl.origin;
  }
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  return `${forwardedProto}://${forwardedHost}`;
}

function redirectTo(origin: string, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, origin));
}

/**
 * Recovery callback (server-side). El link del email PKCE aterriza acá con
 * ?code=...; intercambiamos el code por sesión en el servidor, leyendo el
 * code verifier desde las cookies (SameSite=Lax) que dejó el browser client
 * al pedir el reset. Hacerlo en el servidor evita el doble consumo del code
 * que provocaba `detectSessionInUrl` en el client component previo.
 * También se soporta token_hash + verifyOtp por si el template del email se
 * migra a ese formato (más robusto / cross-device) en el futuro.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const origin = resolveOrigin(request, requestUrl);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return redirectTo(
      origin,
      error ? `${FORGOT_PASSWORD_PATH}?reason=${INVALID_REASON}` : RESET_PASSWORD_PATH,
    );
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    return redirectTo(
      origin,
      error ? `${FORGOT_PASSWORD_PATH}?reason=${INVALID_REASON}` : RESET_PASSWORD_PATH,
    );
  }

  return redirectTo(origin, `${FORGOT_PASSWORD_PATH}?reason=${MISSING_CODE_REASON}`);
}
