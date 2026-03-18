"use client";

import { useState } from "react";
import { BrandLockup } from "@/components/layout/brand-lockup";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("Email o contraseña incorrectos");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a2a2c] px-4">
      <div className="w-full max-w-sm animate-fade-in-up">
        <div className="text-center mb-8">
          <BrandLockup variant="login" />
          <p className="text-white/50 mt-1">Ingresá a tu cuenta</p>
        </div>

        <form onSubmit={handleLogin} className="glass-dark p-6 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-white/80 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3 py-2 bg-white/[0.06] border border-[rgba(129,181,161,0.2)] rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#81b5a1] focus:border-transparent transition-colors"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-white/80 mb-1"
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2 bg-white/[0.06] border border-[rgba(129,181,161,0.2)] rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#81b5a1] focus:border-transparent transition-colors"
              placeholder="Tu contraseña"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/15 p-3 rounded-lg border border-red-500/30">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-[#81b5a1] text-white rounded-lg font-medium hover:bg-[#5a9a84] focus:outline-none focus:ring-2 focus:ring-[#81b5a1] focus:ring-offset-2 focus:ring-offset-[#1a2a2c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors glow-hover"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
