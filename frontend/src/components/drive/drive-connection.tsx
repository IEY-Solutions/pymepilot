"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { HardDrive, Link2, Unlink, Loader2, CheckCircle, XCircle } from "lucide-react";

/**
 * Componente para conectar/desconectar una carpeta de Google Drive.
 *
 * QUE HACE: El usuario pega el link de una carpeta de Google Drive.
 * PymePilot extrae el folder_id, lo guarda en drive_connections,
 * y el script sync_google_drive.py lo usa para sincronizar automaticamente.
 *
 * CONCEPTO - Extraccion de folder_id:
 * Un link de carpeta de Drive se ve asi:
 *   https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz
 * El ID es la ultima parte despues de /folders/.
 *
 * FLUJO:
 * 1. Usuario comparte carpeta con el email del Service Account
 * 2. Pega el link aca
 * 3. Se extrae folder_id y se guarda en drive_connections
 * 4. Cron diario (4:30 AM) detecta archivos nuevos y los procesa
 */

// Email del Service Account — se muestra al usuario para que comparta la carpeta.
// Se actualiza cuando se complete el Paso 7 (setup Google Cloud).
const SERVICE_ACCOUNT_EMAIL = process.env.NEXT_PUBLIC_DRIVE_SERVICE_ACCOUNT_EMAIL ?? "";

function extractFolderId(input: string): string | null {
  // Soporta:
  //   https://drive.google.com/drive/folders/FOLDER_ID
  //   https://drive.google.com/drive/folders/FOLDER_ID?usp=sharing
  //   FOLDER_ID (directo)
  const match = input.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // Si no matchea URL, asumir que es el ID directo (solo alfanumerico + guion + underscore)
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
      // Obtener tenant_id del JWT (mismo patron que file-upload.tsx)
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

  // --- Estado: Conectado ---
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
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-medium text-gray-900">
              Google Drive
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            {isError ? (
              <XCircle className="h-4 w-4 text-red-500" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
            <span
              className={`text-xs font-medium ${
                isError ? "text-red-600" : "text-green-600"
              }`}
            >
              {isError ? "Error" : "Conectado"}
            </span>
          </div>
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>
            Carpeta: <code className="bg-gray-100 px-1 rounded">{currentConnection.folder_id}</code>
          </p>
          <p>Ultima sync: {lastSync}</p>
          {currentConnection.error_message && (
            <p className="text-red-500">{currentConnection.error_message}</p>
          )}
        </div>

        <button
          onClick={handleDisconnect}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
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

  // --- Estado: No conectado ---
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <HardDrive className="h-4 w-4 text-gray-500" />
        <h3 className="text-sm font-medium text-gray-900">
          Google Drive
        </h3>
      </div>

      <div className="text-xs text-gray-500 space-y-2">
        <p>
          Conecta una carpeta de Google Drive para sincronizar datos
          automaticamente todos los dias.
        </p>
        {SERVICE_ACCOUNT_EMAIL && (
          <div className="bg-blue-50 border border-blue-200 rounded p-2">
            <p className="text-blue-800 font-medium mb-1">Paso 1:</p>
            <p className="text-blue-700">
              Compartí tu carpeta con este email:
            </p>
            <code className="block mt-1 bg-blue-100 px-2 py-1 rounded text-blue-900 break-all text-[11px]">
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
          className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          onClick={handleConnect}
          disabled={loading || !folderLink.trim()}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
          Conectar
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
