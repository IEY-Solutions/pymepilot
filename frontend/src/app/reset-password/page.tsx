import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ResetPasswordForm from "./reset-password-form";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
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

          <div className="glass-dark p-6 space-y-4">
            <p className="text-sm text-red-200 bg-red-500/15 p-3 rounded-lg border border-red-500/30">
              El enlace de recuperación no es válido o expiró.
            </p>
            <Link
              href="/forgot-password"
              className="inline-flex text-sm text-white/75 underline-offset-4 transition-colors hover:text-white hover:underline focus:outline-none focus:ring-2 focus:ring-[#81b5a1] focus:ring-offset-2 focus:ring-offset-transparent"
            >
              Solicitar uno nuevo
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <ResetPasswordForm />;
}
