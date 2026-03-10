"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, Loader2, AlertTriangle } from "lucide-react";

type UploadStatus = "idle" | "uploading" | "processing" | "completed" | "failed";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const POLL_INTERVAL_MS = 5000;

export function FileUpload() {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const validateFiles = useCallback((files: File[]): string | null => {
    if (files.length === 0) return "No se seleccionaron archivos";

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".xlsx")) {
        return `"${file.name}" no es un archivo Excel (.xlsx)`;
      }
      if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        return `"${file.name}" pesa ${sizeMB}MB. El maximo es 10MB.`;
      }
    }

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > MAX_FILE_SIZE * 3) {
      return "El total de archivos es muy grande. Intenta con menos archivos.";
    }

    return null;
  }, []);

  const handleUpload = useCallback(async (files: File[]) => {
    const validationError = validateFiles(files);
    if (validationError) {
      setError(validationError);
      return;
    }

    setStatus("uploading");
    setError(null);
    setSelectedFiles(files);

    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Sesion expirada. Recarga la pagina.");
        setStatus("failed");
        return;
      }

      const tenantId = user.app_metadata?.tenant_id;
      if (!tenantId) {
        setError("Error de configuracion: tenant_id no encontrado.");
        setStatus("failed");
        return;
      }

      const uploadedFiles: { path: string; name: string; size: number }[] = [];

      for (const file of files) {
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `${tenantId}/uploads/${timestamp}_${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("data-uploads")
          .upload(storagePath, file, {
            contentType: ALLOWED_MIME,
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Error subiendo "${file.name}": ${uploadError.message}`);
        }

        uploadedFiles.push({
          path: storagePath,
          name: file.name,
          size: file.size,
        });
      }

      const totalSize = files.reduce((sum, f) => sum + f.size, 0);

      const { data: job, error: jobError } = await supabase
        .from("upload_jobs")
        .insert({
          tenant_id: tenantId,
          user_id: user.id,
          file_paths: uploadedFiles,
          total_size_bytes: totalSize,
        })
        .select("id")
        .single();

      if (jobError) {
        throw new Error(`Error creando job: ${jobError.message}`);
      }

      setJobId(job.id);
      setStatus("processing");

      let pollCount = 0;
      const MAX_POLLS = 60;

      pollRef.current = setInterval(async () => {
        pollCount++;

        if (pollCount >= MAX_POLLS) {
          if (pollRef.current) clearInterval(pollRef.current);
          setStatus("failed");
          setError(
            "El procesamiento esta tardando mas de lo esperado. " +
            "Recarga la pagina para ver el estado."
          );
          return;
        }

        const { data: updatedJob } = await supabase
          .from("upload_jobs")
          .select("status, error_message")
          .eq("id", job.id)
          .single();

        if (!updatedJob) return;

        if (updatedJob.status === "completed") {
          setStatus("completed");
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (updatedJob.status === "failed") {
          setStatus("failed");
          setError(updatedJob.error_message || "Error procesando el archivo.");
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }, POLL_INTERVAL_MS);

    } catch (err) {
      setStatus("failed");
      setError(err instanceof Error ? err.message : "Error inesperado");
    }
  }, [validateFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    handleUpload(files);
  }, [handleUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) handleUpload(files);
  }, [handleUpload]);

  const handleReset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setSelectedFiles([]);
    setJobId(null);
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  return (
    <div id="upload-section" className="space-y-3">
      <h2 className="text-sm font-medium text-white/50">
        Subir datos
      </h2>

      {status === "idle" && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer
            transition-colors duration-200
            ${dragOver
              ? "border-[#81b5a1] bg-[#81b5a1]/10"
              : "border-[rgba(129,181,161,0.2)] hover:border-[rgba(129,181,161,0.4)] hover:bg-white/[0.03]"
            }
          `}
        >
          <Upload className="h-8 w-8 text-white/40 mx-auto mb-2" />
          <p className="text-sm font-medium text-white/80">
            Arrastra tus archivos Excel aca
          </p>
          <p className="text-xs text-white/40 mt-1">
            o hace click para seleccionar. Uno o varios archivos .xlsx (max 10MB c/u)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {status === "uploading" && (
        <div className="flex items-center gap-3 p-4 bg-blue-500/15 border border-blue-500/30 rounded-2xl">
          <Loader2 className="h-5 w-5 text-blue-400 animate-spin shrink-0" />
          <div>
            <p className="text-sm font-medium text-white">
              Subiendo {selectedFiles.length} archivo{selectedFiles.length > 1 ? "s" : ""}...
            </p>
            <p className="text-xs text-blue-400 mt-0.5">
              {selectedFiles.map(f => f.name).join(", ")}
            </p>
          </div>
        </div>
      )}

      {status === "processing" && (
        <div className="flex items-center gap-3 p-4 bg-amber-500/15 border border-amber-500/30 rounded-2xl">
          <Loader2 className="h-5 w-5 text-amber-400 animate-spin shrink-0" />
          <div>
            <p className="text-sm font-medium text-white">
              Analizando y procesando datos...
            </p>
            <p className="text-xs text-amber-400 mt-0.5">
              Esto puede tardar hasta 1 minuto. No cierres la pagina.
            </p>
          </div>
        </div>
      )}

      {status === "completed" && (
        <div className="flex items-center justify-between p-4 bg-green-500/15 border border-green-500/30 rounded-2xl">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-white">
                Datos procesados correctamente
              </p>
              <p className="text-xs text-green-400 mt-0.5">
                {selectedFiles.length} archivo{selectedFiles.length > 1 ? "s" : ""} importado{selectedFiles.length > 1 ? "s" : ""}. Las predicciones se actualizaran en la proxima corrida.
              </p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="text-xs text-green-400 hover:text-green-300 underline shrink-0"
          >
            Subir mas
          </button>
        </div>
      )}

      {status === "failed" && (
        <div className="flex items-center justify-between p-4 bg-red-500/15 border border-red-500/30 rounded-2xl">
          <div className="flex items-center gap-3">
            <XCircle className="h-5 w-5 text-red-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-white">
                Error al procesar
              </p>
              {error && (
                <p className="text-xs text-red-400 mt-0.5 max-w-md">
                  {error}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleReset}
            className="text-xs text-red-400 hover:text-red-300 underline shrink-0"
          >
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
}
