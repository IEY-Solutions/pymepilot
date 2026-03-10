"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { HardDrive, Link2, Unlink, Loader2, CheckCircle, XCircle } from "lucide-react";

const SERVICE_ACCOUNT_EMAIL = process.env.NEXT_PUBLIC_DRIVE_SERVICE_ACCOUNT_EMAIL ?? "";

function extractFolderId(input: string): string | null {
  const match = input.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed) && trimmed.length > 10) {
    return trimmed;
  }
  return null;
}

type DriveConnectionData = {
  id: string;
  folder_id: string;
  status: string;
  last_synced_at: string | null;
  error_message: string | null;
} | null;

export function DriveConnection({
  connection,
}: {
  connection: DriveConnectionData;
}) {
  const [folderLink, setFolderLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentConnection, setCurrentConnection] =
    useState<DriveConnectionData>(connection);

  const supabase = createClient();

  async function handleConnect() {
    setError(null);
    const folderId = extractFolderId(folderLink);
    if (!folderId) {
      setError("Link invalido. Pega el link de una carpeta de Google Drive.");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const tenantId = user?.app_metadata?.tenant_id;
      if (!tenantId) {
        setError("Error de configuracion: tenant_id no encontrado.");
        setLoading(false);
        return;
      }

      const { data, error: dbError } = await supabase
        .from("drive_connections")
        .upsert(
          {
            tenant_id: tenantId,
            folder_id: folderId,
            status: "active",
            error_message: null,
          },
          { onConflict: "tenant_id" }
        )
        .select()
        .single();

      if (dbError) throw new Error(dbError.message);

      setCurrentConnection(data);
      setFolderLink("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al conectar");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    if (!currentConnection) return;
    setLoading(true);
    try {
      const { error: dbError } = await supabase
        .from("drive_connections")
        .delete()
        .eq("id", currentConnection.id);

      if (dbError) throw new Error(dbError.message);

      setCurrentConnection(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al desconectar");
    } finally {
      setLoading(false);
    }
  }

  if (currentConnection) {
    const isError = currentConnection.status === "error";
    const lastSync = currentConnection.last_synced_at
      ? new Date(currentConnection.last_synced_at).toLocaleString("es-AR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Nunca (espera al proximo sync 4:30 AM)";

    return (
      <div className="glass-dark p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-white/50" />
            <h3 className="text-sm font-medium text-white">
              Google Drive
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            {isError ? (
              <XCircle className="h-4 w-4 text-red-400" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-400" />
            )}
            <span
              className={`text-xs font-medium ${
                isError ? "text-red-400" : "text-green-400"
              }`}
            >
              {isError ? "Error" : "Conectado"}
            </span>
          </div>
        </div>

        <div className="text-xs text-white/50 space-y-1">
          <p>
            Carpeta: <code className="bg-white/[0.06] px-1 rounded truncate max-w-[200px] inline-block align-bottom text-white/70" title={currentConnection.folder_id}>{currentConnection.folder_id}</code>
          </p>
          <p>Ultima sync: {lastSync}</p>
          {currentConnection.error_message && (
            <p className="text-red-400">Error en conexion con Drive</p>
          )}
        </div>

        <button
          onClick={handleDisconnect}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Unlink className="h-3 w-3" />
          )}
          Desconectar
        </button>
      </div>
    );
  }

  return (
    <div className="glass-dark p-4 space-y-3">
      <div className="flex items-center gap-2">
        <HardDrive className="h-4 w-4 text-white/50" />
        <h3 className="text-sm font-medium text-white">
          Google Drive
        </h3>
      </div>

      <div className="text-xs text-white/50 space-y-2">
        <p>
          Conecta una carpeta de Google Drive para sincronizar datos
          automaticamente todos los dias.
        </p>
        {SERVICE_ACCOUNT_EMAIL && (
          <div className="bg-[#81b5a1]/10 border border-[rgba(129,181,161,0.2)] rounded-lg p-2">
            <p className="text-[#a3cabb] font-medium mb-1">Paso 1:</p>
            <p className="text-white/60">
              Compartí tu carpeta con este email:
            </p>
            <code className="block mt-1 bg-white/[0.06] px-2 py-1 rounded text-[#a3cabb] break-all text-[11px]">
              {SERVICE_ACCOUNT_EMAIL}
            </code>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={folderLink}
          onChange={(e) => {
            setFolderLink(e.target.value);
            setError(null);
          }}
          placeholder="Pega el link de la carpeta de Drive"
          className="flex-1 text-sm border border-[rgba(129,181,161,0.2)] bg-white/[0.06] rounded-lg px-3 py-2 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#81b5a1] focus:border-transparent"
        />
        <button
          onClick={handleConnect}
          disabled={loading || !folderLink.trim()}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-[#81b5a1] rounded-lg hover:bg-[#5a9a84] disabled:opacity-50 disabled:cursor-not-allowed glow-hover"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
          Conectar
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
