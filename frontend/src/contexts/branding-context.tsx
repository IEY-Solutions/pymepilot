"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * BrandingProvider — Sistema de theming dinamico por tenant.
 *
 * QUE HACE: A partir de UN solo color primario elegido por el tenant,
 * genera toda una paleta de 10 shades (50-900) y los aplica como
 * CSS custom properties. Todos los componentes que usan clases
 * `brand-*` (ej: bg-brand-600, text-brand-700) se adaptan automatico.
 *
 * CONCEPTO - HSL Color Space:
 * Los colores se pueden representar como Hue (tono), Saturation
 * (intensidad), Lightness (claridad). Manteniendo el mismo tono
 * y ajustando la claridad, generamos una familia de colores
 * coherente: desde muy claro (brand-50) hasta muy oscuro (brand-900).
 */

interface BrandingConfig {
  logo_base64: string | null;
  primary_color: string;
}

interface BrandingContextValue {
  branding: BrandingConfig;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const DEFAULT_PRIMARY = "#3B82F6"; // blue-500

const DEFAULT_BRANDING: BrandingConfig = {
  logo_base64: null,
  primary_color: DEFAULT_PRIMARY,
};

const BrandingContext = createContext<BrandingContextValue>({
  branding: DEFAULT_BRANDING,
  isLoading: true,
  refetch: async () => {},
});

// ============================================================
// Generador de paleta desde un solo hex
// ============================================================

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l * 100];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Genera 10 shades a partir de un color primario.
 * El shade 500 es el color original. Los demas se derivan
 * ajustando la luminosidad manteniendo el tono y saturacion.
 */
function generatePalette(hex: string): Record<string, string> {
  const [h, s] = hexToHsl(hex);

  // Lightness targets para cada shade (inspirado en Tailwind)
  const shades: Record<string, number> = {
    "50": 96,
    "100": 91,
    "200": 83,
    "300": 72,
    "400": 60,
    "500": 50,
    "600": 42,
    "700": 35,
    "800": 28,
    "900": 22,
  };

  const palette: Record<string, string> = {};
  for (const [shade, lightness] of Object.entries(shades)) {
    // Reducir saturacion en los extremos para que no queden artificiales
    const satAdj = shade === "50" || shade === "100"
      ? Math.min(s, 80)
      : shade === "900" || shade === "800"
        ? Math.min(s * 0.8, 70)
        : s;
    palette[shade] = hslToHex(h, satAdj, lightness);
  }
  return palette;
}

function applyPaletteToCSS(palette: Record<string, string>) {
  const root = document.documentElement;
  for (const [shade, color] of Object.entries(palette)) {
    root.style.setProperty(`--brand-${shade}`, color);
  }
}

// ============================================================
// Provider
// ============================================================

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<BrandingConfig>(DEFAULT_BRANDING);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBranding = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const tenantId = user?.app_metadata?.tenant_id;
      if (!tenantId) return;

      const { data } = await supabase
        .from("tenants")
        .select("branding_config")
        .eq("id", tenantId)
        .single();

      if (data?.branding_config) {
        const config = {
          logo_base64: data.branding_config.logo_base64 ?? null,
          primary_color: data.branding_config.primary_color ?? DEFAULT_PRIMARY,
        };
        setBranding(config);
      }
    } catch {
      // Si falla, usa defaults — no rompe la app
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBranding();
  }, []);

  // Generar y aplicar paleta completa cada vez que cambia el color
  useEffect(() => {
    const palette = generatePalette(branding.primary_color);
    applyPaletteToCSS(palette);
  }, [branding.primary_color]);

  return (
    <BrandingContext.Provider value={{ branding, isLoading, refetch: fetchBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
