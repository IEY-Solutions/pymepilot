"use client";

import { useState } from "react";
import { X, Plus, Trash2, Loader2, Users, Phone, Handshake, Eye } from "lucide-react";
import type { NoteType } from "@/lib/key-accounts/types";

interface ActionItem {
  title: string;
  trigger_date: string;
}

interface Props {
  keyAccountId: string;
  onCreated: (needsFollowup: boolean) => void;
  onClose: () => void;
}

const NOTE_TYPES: { value: NoteType; label: string; Icon: typeof Users }[] = [
  { value: "meeting", label: "Reunion", Icon: Users },
  { value: "call", label: "Llamada", Icon: Phone },
  { value: "promise", label: "Promesa", Icon: Handshake },
  { value: "observation", label: "Observacion", Icon: Eye },
];

export function CreateNoteForm({ keyAccountId, onCreated, onClose }: Props) {
  const [noteType, setNoteType] = useState<NoteType>("call");
  const [content, setContent] = useState("");
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [saving, setSaving] = useState(false);

  const addAction = () => {
    if (actions.length >= 5) return;
    // Default: 7 dias desde hoy
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 7);
    setActions([
      ...actions,
      { title: "", trigger_date: defaultDate.toISOString().split("T")[0] },
    ]);
  };

  const updateAction = (index: number, field: keyof ActionItem, value: string) => {
    const updated = [...actions];
    updated[index] = { ...updated[index], [field]: value };
    setActions(updated);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const validActions = actions.filter((a) => a.title.trim() && a.trigger_date);
    const finalContent = content.trim()
      || (validActions.length > 0
        ? validActions.map((a) => a.title).join(", ")
        : "");

    if (!finalContent) return;

    setSaving(true);
    try {
      const res = await fetch("/api/key-accounts/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_note",
          key_account_id: keyAccountId,
          note_type: noteType,
          content: finalContent,
          actions: validActions.length > 0 ? validActions : undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onCreated(data.needs_followup ?? false);
      } else {
        let errorMsg = "Error al crear nota";
        try {
          const data = await res.json();
          errorMsg = data.error || errorMsg;
        } catch {
          errorMsg = `Error HTTP ${res.status}`;
        }
        alert(errorMsg);
      }
    } catch (err) {
      console.error("Error creating note:", err);
      alert("Error de conexion");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-dark w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">Nueva nota</h3>
          <button
            onClick={onClose}
            className="p-1 rounded text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Tipo de nota */}
          <div className="space-y-2">
            <label className="text-sm text-white/60">Tipo</label>
            <div className="flex gap-2">
              {NOTE_TYPES.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  onClick={() => setNoteType(value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    noteType === value
                      ? "bg-[#81b5a1]/15 text-[#81b5a1]"
                      : "bg-white/[0.06] text-white/40 hover:text-white/60"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Contenido */}
          <div className="space-y-2">
            <label className="text-sm text-white/60">Contenido</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Que paso en esta interaccion... (opcional si agregas acciones)"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#81b5a1]/40 resize-none"
              rows={4}
              maxLength={2000}
              autoFocus
            />
          </div>

          {/* Acciones */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-white/60">
                Acciones ({actions.length}/5)
              </label>
              {actions.length < 5 && (
                <button
                  onClick={addAction}
                  className="flex items-center gap-1 text-xs text-[#81b5a1] hover:text-[#81b5a1]/80 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Agregar accion
                </button>
              )}
            </div>

            {actions.map((action, i) => (
              <div key={i} className="flex gap-2 items-start">
                <input
                  type="text"
                  value={action.title}
                  onChange={(e) => updateAction(i, "title", e.target.value)}
                  placeholder="Titulo de la accion"
                  className="flex-1 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#81b5a1]/40"
                />
                <input
                  type="date"
                  value={action.trigger_date}
                  onChange={(e) => updateAction(i, "trigger_date", e.target.value)}
                  className="px-2 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 text-white text-sm focus:outline-none focus:border-[#81b5a1]/40"
                />
                <button
                  onClick={() => removeAction(i)}
                  className="p-1.5 rounded text-white/30 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || (!content.trim() && actions.length === 0)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#81b5a1]/15 text-[#81b5a1] hover:bg-[#81b5a1]/25 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Guardar nota
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
