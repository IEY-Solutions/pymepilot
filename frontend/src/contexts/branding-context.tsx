"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * BrandingProvider — Context API para theming por tenant.
 *
 * QUE HACE: Carga la configuracion de marca del tenant (logo + color
 * primario) y la expone a toda la app via React Context. Ademas aplica
 * CSS custom properties al <html> para que los componentes puedan
 * usar colores dinamicos.
 *
 * CONCEPTO - CSS Custom Properties:
 * Son variables que definimos en el HTML y cualquier CSS puede leer.
 * Ejemplo: --color-primary: #3B82F6 → los botones usan ese color.
 * Si el tenant cambia su color, todos los botones cambian automatico.
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

const DEFAULT_BRANDING: BrandingConfig = {
  logo_base64: null,
  primary_color: "#3B82F6", // blue-600 (default PymePilot)
};

const BrandingContext = createContext<BrandingContextValue>({
  branding: DEFAULT_BRANDING,
  isLoading: true,
  refetch: async () => {},
});

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
        setBranding({
          logo_base64: data.branding_config.logo_base64 ?? null,
          primary_color: data.branding_config.primary_color ?? DEFAULT_BRANDING.primary_color,
        });
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

  // Aplicar CSS custom properties al documento
  useEffect(() => {
    document.documentElement.style.setProperty("--color-primary", branding.primary_color);
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
