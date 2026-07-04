import type { NextConfig } from "next";

// Nota: maxDuration y regions se configuran via Route Segment Config
// en `src/app/(dashboard)/layout.tsx` porque App Router no expone estas
// opciones en next.config.ts. Dashboard routes: maxDuration=30s, region=gru1.
const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["remotion", "@remotion/player"],
  serverExternalPackages: ["@remotion/renderer"],
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        // Anti-clickjacking: no permitir embeber en iframes
        { key: "X-Frame-Options", value: "DENY" },
        // Evitar MIME sniffing (browser no "adivina" el tipo de archivo)
        { key: "X-Content-Type-Options", value: "nosniff" },
        // Controlar que info se envia en el header Referer
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        // Forzar HTTPS por 2 anos (browser recuerda y no permite HTTP)
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
      ],
    },
  ],
};

export default nextConfig;
