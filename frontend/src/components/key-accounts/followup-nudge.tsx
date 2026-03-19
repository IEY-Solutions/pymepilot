"use client";

import { useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";

interface Props {
  keyAccountId: string;
  onDone: () => void;
  onDismiss: () => void;
}

export function FollowupNudge({ keyAccountId, onDone, onDismiss }: Props) {
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDate, setCustomDate] = useState("");

  const createFollowup = async (daysFromNow: number | null, date?: string) => {
    setSaving(true);
    try {
      let triggerDate: string;
      if (date) {
        triggerDate = new Date(date).toISOString();
      } else if (daysFromNow !== null) {
        const d = new Date();
        d.setDate(d.getDate() + daysFromNow);
        triggerDate = d.toISOString();
      } else {
        return;
      }

      const res = await fetch("/api/key-accounts/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_followup",
          key_account_id: keyAccountId,
          trigger_date: triggerDate,
        }),
      });

      if (res.ok) {
        onDone();
      }
    } catch {
      console.error("Error creating followup");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#81b5a1]/10 border border-[#81b5a1]/20 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <CalendarClock className="h-5 w-5 text-[#81b5a1] mt-0.5 shrink-0" />
        <div className="flex-1 space-y-3">
          <div>
            <p className="text-sm font-medium text-white">
              ¿Cuando queres hacer seguimiento?
            </p>
            <p className="text-xs text-white/40 mt-0.5">
              Programar un recordatorio para volver a contactar a este cliente
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => createFollowup(15)}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg bg-[#81b5a1]/15 text-[#81b5a1] hover:bg-[#81b5a1]/25 transition-colors text-sm disabled:opacity-50"
            >
              En 15 dias
            </button>
            <button
              onClick={() => createFollowup(20)}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg bg-[#81b5a1]/15 text-[#81b5a1] hover:bg-[#81b5a1]/25 transition-colors text-sm disabled:opacity-50"
            >
              En 20 dias
            </button>

            {!showDatePicker ? (
              <button
                onClick={() => setShowDatePicker(true)}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg bg-white/[0.06] text-white/50 hover:text-white/70 transition-colors text-sm disabled:opacity-50"
              >
                Otra fecha
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="px-2 py-1 rounded-lg bg-white/[0.06] border border-white/10 text-white text-sm focus:outline-none focus:border-[#81b5a1]/40"
                />
                <button
                  onClick={() => customDate && createFollowup(null, customDate)}
                  disabled={!customDate || saving}
                  className="px-2 py-1 rounded-lg bg-[#81b5a1]/15 text-[#81b5a1] text-sm disabled:opacity-50"
                >
                  OK
                </button>
              </div>
            )}

            <button
              onClick={onDismiss}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg text-white/30 hover:text-white/50 transition-colors text-sm disabled:opacity-50"
            >
              Ahora no
            </button>

            {saving && <Loader2 className="h-4 w-4 animate-spin text-[#81b5a1] self-center" />}
          </div>
        </div>
      </div>
    </div>
  );
}
