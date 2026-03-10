"use client";

import { useState, useRef } from "react";
import { Settings, Upload, Palette, Check, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useBranding } from "@/contexts/branding-context";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { TOOLTIPS } from "@/lib/tooltips";

/**
 * Pagina de Configuracion — permite al tenant personalizar su marca.
 *
 * CONCEPTO - FileReader API:
 * Para subir un logo sin necesidad de un servidor de archivos,
 * convertimos la imagen a base64 (texto) usando FileReader del browser.
 * Eso se guarda directo en la DB como texto en el campo JSONB.
 */

// Colores predefinidos para elegir rapido
const PRESET_COLORS = [
  "#3B82F6", // blue
  "#10B981", // emerald
  "#8B5CF6", // violet
  "#F59E0B", // amber
  "#EF4444", // red
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#F97316", // orange
  "#6366F1", // indigo
  "#14B8A6", // teal
  "#84CC16", // lime
  "#64748B", // slate
];

const MAX_LOGO_SIZE = 500 * 1024; // 500KB

export default function ConfiguracionPage() {
  const { branding, refetch } = useBranding();
  const [logoPreview, setLogoPreview] = useState<string | null>(branding.logo_base64);
  const [selectedColor, setSelectedColor] = useState(branding.primary_color);
  const [customColor, setCustomColor] = useState(branding.primary_color);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasChanges =
    logoPreview !== branding.logo_base64 ||
    selectedColor !== branding.primary_color;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_LOGO_SIZE) {
      setMessage({ type: "error", text: `El logo no puede pesar mas de 500KB. Tu archivo pesa ${Math.round(file.size / 1024)}KB.` });
      return;
    }

    if (!file.type.startsWith("image/")) {
      setMessage({ type: "error", text: "Solo se permiten archivos de imagen (PNG, JPG, SVG, WebP)." });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLogoPreview(reader.result as string);
      setMessage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    setCustomColor(color);
  };

  const handleCustomColorChange = (color: string) => {
    setCustomColor(color);
    setSelectedColor(color);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const tenantId = user?.app_metadata?.tenant_id;
      if (!tenantId) throw new Error("No se pudo identificar el tenant");

      const { error } = await supabase
        .from("tenants")
        .update({
          branding_config: {
            logo_base64: logoPreview,
            primary_color: selectedColor,
          },
        })
        .eq("id", tenantId);

      if (error) throw error;

      await refetch();
      setMessage({ type: "success", text: "Configuracion guardada correctamente." });
    } catch {
      setMessage({ type: "error", text: "Error al guardar. Intenta de nuevo." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setLogoPreview(branding.logo_base64);
    setSelectedColor(branding.primary_color);
    setCustomColor(branding.primary_color);
    setMessage(null);
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Titulo */}
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-gray-700" />
        <h1 className="text-lg font-semibold text-gray-900">Configuracion</h1>
      </div>

      {/* Preview */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
          Vista previa
          <InfoTooltip text={TOOLTIPS["config.preview"]} />
        </p>
        <div
          className="h-14 border border-gray-200 rounded-lg flex items-center justify-between px-4"
          style={{ borderTopColor: selectedColor, borderTopWidth: 3 }}
        >
          <div className="flex items-center gap-2">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className="h-8 w-auto object-contain" />
            ) : (
              <span className="text-lg font-bold" style={{ color: selectedColor }}>
                PymePilot
              </span>
            )}
            <span className="text-sm text-gray-400">| Tu empresa</span>
          </div>
          <div className="w-16 h-7 rounded text-white text-xs flex items-center justify-center font-medium" style={{ backgroundColor: selectedColor }}>
            Boton
          </div>
        </div>
      </div>

      {/* Logo */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
          <Upload className="h-3.5 w-3.5 inline mr-1" />
          Logo de tu empresa
          <InfoTooltip text={TOOLTIPS["config.logo"]} />
        </p>
        <div className="flex items-center gap-4">
          {logoPreview ? (
            <div className="relative">
              <img src={logoPreview} alt="Logo preview" className="h-12 w-auto object-contain rounded border border-gray-200 p-1" />
              <button
                onClick={handleRemoveLogo}
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] hover:bg-red-600"
              >
                ×
              </button>
            </div>
          ) : (
            <div className="h-12 w-12 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
              <Upload className="h-4 w-4 text-gray-400" />
            </div>
          )}
          <div>
            <button
              onClick={() => fileRef.current?.click()}
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              {logoPreview ? "Cambiar logo" : "Subir logo"}
            </button>
            <p className="text-[10px] text-gray-400 mt-0.5">PNG, JPG, SVG o WebP. Max 500KB.</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>

      {/* Color primario */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
          <Palette className="h-3.5 w-3.5 inline mr-1" />
          Color principal
          <InfoTooltip text={TOOLTIPS["config.color"]} />
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => handleColorSelect(color)}
              className={`w-8 h-8 rounded-lg border-2 transition-all ${
                selectedColor === color
                  ? "border-gray-900 ring-2 ring-offset-1 ring-gray-400 scale-110"
                  : "border-gray-200 hover:scale-105"
              }`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={customColor}
            onChange={(e) => handleCustomColorChange(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border-0"
          />
          <input
            type="text"
            value={customColor}
            onChange={(e) => {
              if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) {
                handleCustomColorChange(e.target.value);
              }
            }}
            className="w-24 text-sm border border-gray-300 rounded-lg px-2 py-1 font-mono"
            placeholder="#3B82F6"
            maxLength={7}
          />
          <span className="text-[10px] text-gray-400">o elegi un color personalizado</span>
        </div>
      </div>

      {/* Mensaje */}
      {message && (
        <div className={`p-3 rounded-lg text-sm ${
          message.type === "success"
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {message.text}
        </div>
      )}

      {/* Botones */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className={`flex-1 py-2.5 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            !hasChanges ? "bg-gray-400" : ""
          }`}
          style={hasChanges ? { backgroundColor: selectedColor } : undefined}
        >
          {isSaving ? "Guardando..." : (
            <>
              <Check className="h-4 w-4 inline mr-1" />
              Guardar cambios
            </>
          )}
        </button>
        {hasChanges && (
          <button
            onClick={handleReset}
            className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RotateCcw className="h-4 w-4 inline mr-1" />
            Descartar
          </button>
        )}
      </div>
    </div>
  );
}
