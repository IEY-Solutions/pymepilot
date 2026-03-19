"use client";

import { Clock, Users, Phone, Handshake, Eye } from "lucide-react";
import type { KeyAccountNote, NoteType } from "@/lib/key-accounts/types";

interface Props {
  notes: KeyAccountNote[];
}

const NOTE_ICONS: Record<NoteType, typeof Users> = {
  meeting: Users,
  call: Phone,
  promise: Handshake,
  observation: Eye,
};

const NOTE_LABELS: Record<NoteType, string> = {
  meeting: "Reunion",
  call: "Llamada",
  promise: "Promesa",
  observation: "Observacion",
};

export function DetailTimeline({ notes }: Props) {
  return (
    <div className="bg-white/[0.03] rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-medium text-white/60 flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" />
        Timeline de interacciones
      </h3>

      {notes.length === 0 ? (
        <p className="text-xs text-white/30">Sin interacciones registradas</p>
      ) : (
        <div className="space-y-3">
          {notes.map((note, i) => {
            const Icon = NOTE_ICONS[note.note_type] ?? Eye;
            const label = NOTE_LABELS[note.note_type] ?? note.note_type;

            return (
              <div key={note.id} className="flex gap-3">
                {/* Linea vertical */}
                <div className="flex flex-col items-center">
                  <div className="p-1.5 rounded-full bg-white/[0.06]">
                    <Icon className="h-3 w-3 text-white/50" />
                  </div>
                  {i < notes.length - 1 && (
                    <div className="w-px flex-1 bg-white/10 mt-1" />
                  )}
                </div>

                {/* Contenido */}
                <div className="flex-1 pb-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-white/50 font-medium">{label}</span>
                    <span className="text-white/30">
                      {new Date(note.created_at).toLocaleDateString("es-AR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-white/70 mt-1">{note.content}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
