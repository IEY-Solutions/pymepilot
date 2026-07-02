"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const INPUT_CLASS_NAME =
  "w-full px-3 py-2 bg-white/[0.06] border border-[rgba(129,181,161,0.2)] rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#81b5a1] focus:border-transparent transition-colors";

const MIN_PASSWORD_LENGTH = 6;
const PASSWORD_HELP_ID = "password-help";

export default function ResetPasswordForm() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!password || !confirmation) {
      setError("Completá todos los campos.");
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError("No pudimos cambiar la contraseña. Intentá de nuevo.");
        return;
      }

      await supabase.auth.signOut();
      setMessage("Contraseña cambiada con éxito. Redirigiendo...");
      router.replace("/login");
    } catch {
      setError("No pudimos cambiar la contraseña. Intentá de nuevo.");
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
            Cambiar contraseña
          </h1>
          <p className="mt-3 text-sm text-white/40">
            Ingresá una nueva clave para volver a entrar.
          </p>
        </div>

        <form noValidate onSubmit={handleSubmit} className="glass-dark p-6 space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-white/80 mb-1">
              Nueva contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              aria-describedby={PASSWORD_HELP_ID}
              className={INPUT_CLASS_NAME}
              placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
              disabled={loading}
            />
            <p id={PASSWORD_HELP_ID} className="mt-1 text-xs text-white/35">
              Usá al menos {MIN_PASSWORD_LENGTH} caracteres.
            </p>
          </div>

          <div>
            <label htmlFor="confirmation" className="block text-sm font-medium text-white/80 mb-1">
              Confirmar contraseña
            </label>
            <input
              id="confirmation"
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              className={INPUT_CLASS_NAME}
              placeholder="Repetí la nueva contraseña"
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
            {loading ? "Cambiando..." : "Cambiar contraseña"}
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
