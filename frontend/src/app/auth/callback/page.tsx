"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const RESET_PASSWORD_PATH = "/reset-password";
const FORGOT_PASSWORD_PATH = "/forgot-password";
const MISSING_CODE_REASON = "recovery-missing-code";
const INVALID_REASON = "recovery-invalid";

function buildForgotPasswordUrl(reason: string) {
  return `${FORGOT_PASSWORD_PATH}?reason=${encodeURIComponent(reason)}`;
}

function readHashSession() {
  if (typeof window === "undefined" || !window.location.hash) {
    return null;
  }

  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");

  if (!accessToken || !refreshToken) {
    return null;
  }

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
  };
}

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function completeRecovery() {
      const supabase = createClient();
      const currentUrl = new URL(window.location.href);
      const code = currentUrl.searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) {
          return;
        }

        router.replace(error ? buildForgotPasswordUrl(INVALID_REASON) : RESET_PASSWORD_PATH);
        return;
      }

      const session = readHashSession();
      if (session) {
        const { error } = await supabase.auth.setSession(session);
        if (cancelled) {
          return;
        }

        router.replace(error ? buildForgotPasswordUrl(INVALID_REASON) : RESET_PASSWORD_PATH);
        return;
      }

      router.replace(buildForgotPasswordUrl(MISSING_CODE_REASON));
    }

    void completeRecovery();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a2a2c] px-4">
      <div className="w-full max-w-sm animate-fade-in-up text-center">
        <p className="text-[0.72rem] uppercase tracking-[0.22em] text-white/35">
          PymePilot
        </p>
        <h1 className="mt-2 text-[1.75rem] font-bold tracking-[-0.02em] text-[#81b5a1]">
          Recuperando acceso
        </h1>
        <p className="mt-3 text-sm text-white/40">Estamos validando tu enlace de recuperación.</p>
      </div>
    </div>
  );
}
