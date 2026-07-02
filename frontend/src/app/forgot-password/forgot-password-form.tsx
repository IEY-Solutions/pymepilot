"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const INPUT_CLASS_NAME =
  "w-full px-3 py-2 bg-white/[0.06] border border-[rgba(129,181,161,0.2)] rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#81b5a1] focus:border-transparent transition-colors";

function buildRedirectTo(): string {
  if (typeof window === "undefined") {
    return "/auth/callback";
  }

  return new URL("/auth/callback", window.location.origin).toString();
}

export default function ForgotPasswordForm({
  recoveryReason,
}: {
  recoveryReason: string | null;
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const redirectTo = useMemo(() => buildRedirectTo(), []);
  const recoveryNotice =
    recoveryReason === null
      ? null
      : "Ese enlace de recuperación no es válido o expiró. Pedí uno nuevo desde acá.";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Ingresá tu email.");
      setMessage(null);
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setError("Ingresá un email válido.");
      setMessage(null);
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        trimmedEmail,
        { redirectTo },
      );

      if (resetError) {
        setError("Hubo un problema. Intentá de nuevo.");
        return;
      }

      setMessage("Si el email existe en el sistema, recibirás un enlace de recuperación.");
    } catch {
      setError("Hubo un problema. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a2a2c] px-4">
      <div className="w-full max-w-sm animate-fade-in-up">
        <div className="text-center mb-8">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-white/35">
            PymePilot
          </p>
          <h1 className="mt-2 text-[1.75rem] font-bold tracking-[-0.02em] text-[#81b5a1]">
            Recuperar contraseña
          </h1>
          <p className="mt-3 text-sm text-white/40">Te ayudamos a volver a entrar.</p>
        </div>

        <form noValidate onSubmit={handleSubmit} className="glass-dark p-6 space-y-4">
          {recoveryNotice && (
            <p className="text-sm text-amber-100 bg-amber-500/15 p-3 rounded-lg border border-amber-500/30">
              {recoveryNotice}
            </p>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-white/80 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              className={INPUT_CLASS_NAME}
              placeholder="tu@email.com"
              disabled={loading}
            />
          </div>

          {(error || message) && (
            <p
              aria-live="polite"
              className={`text-sm p-3 rounded-lg border ${
                error
                  ? "text-red-400 bg-red-500/15 border-red-500/30"
                  : "text-emerald-100 bg-emerald-500/15 border-emerald-500/30"
              }`}
            >
              {error ?? message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-[#81b5a1] text-white rounded-lg font-medium hover:bg-[#5a9a84] focus:outline-none focus:ring-2 focus:ring-[#81b5a1] focus:ring-offset-2 focus:ring-offset-[#1a2a2c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors glow-hover"
          >
            {loading ? "Enviando..." : "Enviar"}
          </button>

          <div className="text-center">
            <Link
              href="/login"
              className="text-sm text-white/55 underline-offset-4 transition-colors hover:text-white hover:underline focus:outline-none focus:ring-2 focus:ring-[#81b5a1] focus:ring-offset-2 focus:ring-offset-transparent"
            >
              Volver al login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
