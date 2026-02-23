"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { UserCheck, X } from "lucide-react";

type Status = "pending" | "contacted" | "ignored";

export function PredictionActions({
  predictionId,
  initialStatus,
}: {
  predictionId: string;
  initialStatus: Status;
}) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [loading, setLoading] = useState(false);

  async function updateStatus(newStatus: "contacted" | "ignored") {
    setLoading(true);
    const supabase = createClient();

    const updateData: Record<string, unknown> = { status: newStatus };
    if (newStatus === "contacted") {
      updateData.contacted_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("predictions")
      .update(updateData)
      .eq("id", predictionId);

    if (!error) {
      setStatus(newStatus);
    }
    setLoading(false);
  }

  if (status === "contacted") {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg bg-green-50 text-green-700">
        <UserCheck className="h-4 w-4" />
        Contactado
      </span>
    );
  }

  if (status === "ignored") {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-500">
        <X className="h-4 w-4" />
        Ignorado
      </span>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => updateStatus("contacted")}
        disabled={loading}
        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
      >
        <UserCheck className="h-4 w-4" />
        Contactado
      </button>
      <button
        onClick={() => updateStatus("ignored")}
        disabled={loading}
        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors disabled:opacity-50"
      >
        <X className="h-4 w-4" />
        Ignorar
      </button>
    </div>
  );
}
