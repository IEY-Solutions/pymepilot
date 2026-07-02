import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

function redirectToRecoveryHelp(requestUrl: URL, reason: string) {
  requestUrl.pathname = "/forgot-password";
  requestUrl.search = `?reason=${encodeURIComponent(reason)}`;
  return NextResponse.redirect(requestUrl);
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return redirectToRecoveryHelp(requestUrl, "recovery-missing-code");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return redirectToRecoveryHelp(requestUrl, "recovery-invalid");
  }

  requestUrl.pathname = "/reset-password";
  requestUrl.search = "";
  return NextResponse.redirect(requestUrl);
}
