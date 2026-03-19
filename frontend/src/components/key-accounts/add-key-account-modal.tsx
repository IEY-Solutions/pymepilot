"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Search, Star, Loader2, UserPlus } from "lucide-react";
import type { KeyAccountSuggestion } from "@/lib/key-accounts/types";
import { createClient } from "@/lib/supabase/client";

interface Props {
  onClose: () => void;
  onAdded: () => void;
}

export function AddKeyAccountModal({ onClose, onAdded }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; name: string }[]>([]);
  const [suggestions, setSuggestions] = useState<KeyAccountSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  // Estado para crear cliente nuevo
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [creatingNew, setCreatingNew] = useState(false);

  // Fetch sugerencias al montar
  useEffect(() => {
    const fetchSuggestions = async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc("suggest_key_accounts");
      if (data) {
        setSuggestions(data as KeyAccountSuggestion[]);
      }
    };
    fetchSuggestions();
  }, []);

  // Buscar clientes por nombre
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("customers")
        .select("id, name")
        .ilike("name", `%${query}%`)
        .order("name")
        .limit(10);

      setSearchResults(data ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAdd = async (customerId: string, source: "manual" | "suggested") => {
    setAdding(customerId);
    try {
      const res = await fetch("/api/key-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", customer_id: customerId, source }),
      });

      if (res.ok) {
        onAdded();
      } else {
        const data = await res.json();
        alert(data.error || "Error al agregar");
      }
    } catch {
      alert("Error de conexion");
    } finally {
      setAdding(null);
    }
  };

  const handleCreateNew = async () => {
    if (!newName.trim()) return;

    setCreatingNew(true);
    try {
      const res = await fetch("/api/key-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_new",
          name: newName.trim(),
          phone: newPhone.trim() || undefined,
          email: newEmail.trim() || undefined,
        }),
      });

      if (res.ok) {
        onAdded();
      } else {
        const data = await res.json();
        alert(data.error || "Error al crear cliente");
      }
    } catch {
      alert("Error de conexion");
    } finally {
      setCreatingNew(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-dark w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Agregar cuenta clave</h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!showNewForm ? (
          <>
            {/* Buscador */}
            <div className="p-4 border-b border-white/10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Buscar cliente por nombre..."
                  className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#81b5a1]/40"
                  autoFocus
                />
              </div>

              {/* Resultados de busqueda */}
              {searchResults.length > 0 && (
                <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                  {searchResults.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => handleAdd(customer.id, "manual")}
                      disabled={adding === customer.id}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm text-white hover:bg-white/[0.06] transition-colors flex items-center justify-between disabled:opacity-50"
                    >
                      <span>{customer.name}</span>
                      {adding === customer.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />
                      ) : null}
                    </button>
                  ))}
                </div>
              )}

              {loading && (
                <div className="mt-2 text-center text-white/30 text-sm py-2">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-1" />
                  Buscando...
                </div>
              )}

              {/* Boton crear nuevo — siempre visible */}
              <button
                onClick={() => {
                  setShowNewForm(true);
                  // Si hay texto en la busqueda, usarlo como nombre
                  if (searchQuery.trim().length >= 2) {
                    setNewName(searchQuery.trim());
                  }
                }}
                className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-white/20 text-sm text-white/50 hover:text-[#81b5a1] hover:border-[#81b5a1]/30 transition-colors"
              >
                <UserPlus className="h-4 w-4" />
                Crear cliente nuevo
              </button>
            </div>

            {/* Sugerencias del sistema */}
            <div className="p-4 overflow-y-auto flex-1">
              <h3 className="text-sm font-medium text-white/60 mb-2 flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5" />
                Sugerencias del sistema
              </h3>
              {suggestions.length === 0 ? (
                <p className="text-xs text-white/30 py-2">
                  No hay sugerencias disponibles
                </p>
              ) : (
                <div className="space-y-1">
                  {suggestions.map((s) => (
                    <button
                      key={s.customer_id}
                      onClick={() => handleAdd(s.customer_id, "suggested")}
                      disabled={adding === s.customer_id}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/[0.06] transition-colors flex items-center justify-between disabled:opacity-50"
                    >
                      <div>
                        <span className="text-white">{s.customer_name}</span>
                        <span className="text-white/30 ml-2 text-xs">
                          {s.order_count} pedidos
                        </span>
                      </div>
                      {adding === s.customer_id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Formulario crear cliente nuevo */
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <UserPlus className="h-4 w-4 text-[#81b5a1]" />
              <span className="text-sm font-medium text-white">Nuevo cliente</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">
                  Nombre <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nombre del cliente o empresa"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#81b5a1]/40"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block">Telefono</label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Ej: +54 11 1234-5678"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#81b5a1]/40"
                />
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block">Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="email@ejemplo.com"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#81b5a1]/40"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowNewForm(false)}
                className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                Volver
              </button>
              <button
                onClick={handleCreateNew}
                disabled={creatingNew || !newName.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#81b5a1]/15 text-[#81b5a1] hover:bg-[#81b5a1]/25 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {creatingNew && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Crear y agregar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
