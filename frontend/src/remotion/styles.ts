/** Colores del brand PymePilot */
export const COLORS = {
  /** Teal primario */
  brand: "#81b5a1",
  /** Fondo oscuro principal */
  bgDark: "#1a2a2c",
  /** Fondo de cards */
  bgCard: "rgba(255, 255, 255, 0.03)",
  /** Bordes sutiles */
  border: "rgba(129, 181, 161, 0.1)",
  /** Texto principal */
  textPrimary: "#ffffff",
  /** Texto secundario */
  textSecondary: "rgba(255, 255, 255, 0.6)",
  /** Texto terciario */
  textMuted: "rgba(255, 255, 255, 0.4)",
  /** Verde para estados positivos */
  green: "#22c55e",
  /** Amarillo para advertencias */
  yellow: "#eab308",
  /** Rojo para estados criticos */
  red: "#ef4444",
  /** Purpura para acentos */
  purple: "#a78bfa",
  /** Naranja para acentos */
  orange: "#f97316",
  /** Indigo para orquestador */
  indigo: "#818cf8",
} as const;

/** Fuente principal */
export const FONT_FAMILY = "Inter, system-ui, -apple-system, sans-serif";

/** Estilos base para el contenedor de cada composicion */
export const BASE_COMPOSITION_STYLE: React.CSSProperties = {
  width: 1280,
  height: 720,
  backgroundColor: COLORS.bgDark,
  fontFamily: FONT_FAMILY,
  position: "relative",
  overflow: "hidden",
};
