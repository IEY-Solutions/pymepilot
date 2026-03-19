import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { BASE_COMPOSITION_STYLE, COLORS } from "../styles";
import { TextOverlay } from "../components/text-overlay";
import { FocusWrapper } from "../components/focus-wrapper";
import { mockSalesKPIs, mockAchievements } from "../data/mock-data";

/**
 * Escenas del video Mis Ventas (total ~25s = 750 frames):
 *
 * 0-40:     Entrada
 * 40-170:   Escena 1 — KPI "Mis ventas del mes"
 * 170-300:  Escena 2 — KPI "Ventas con PymePilot" (atribucion)
 * 300-400:  Escena 3 — KPI "Racha de ventas"
 * 400-500:  Escena 4 — Filtros por vertical
 * 500-650:  Escena 5 — Cards de logros
 * 650-750:  Cierre
 */

const S1 = [40, 170] as const;
const S2 = [170, 300] as const;
const S3 = [300, 400] as const;
const S4 = [400, 500] as const;
const S5 = [500, 650] as const;

function getActiveScene(frame: number): number {
  if (frame >= S1[0] && frame <= S1[1]) return 1;
  if (frame >= S2[0] && frame <= S2[1]) return 2;
  if (frame >= S3[0] && frame <= S3[1]) return 3;
  if (frame >= S4[0] && frame <= S4[1]) return 4;
  if (frame >= S5[0] && frame <= S5[1]) return 5;
  return 0;
}

function SalesKPICard({ title, value, subtitle, color, emoji, index }: { title: string; value: string; subtitle: string; color: string; emoji: string; index: number }) {
  const frame = useCurrentFrame();
  const delay = index * 8;
  const opacity = interpolate(frame - delay, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{ flex: 1, backgroundColor: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "18px 16px", opacity }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 20 }}>{emoji}</span>
        <p style={{ color: COLORS.textMuted, fontSize: 13, margin: 0 }}>{title}</p>
      </div>
      <p style={{ color, fontSize: 26, fontWeight: 700, margin: 0 }}>{value}</p>
      <p style={{ color: COLORS.textMuted, fontSize: 12, margin: 0, marginTop: 4 }}>{subtitle}</p>
    </div>
  );
}

function VerticalFilters() {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {["Todas", "Reposicion", "Cross-sell", "Activacion", "Recuperacion"].map((label, i) => (
        <div key={label} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 500, backgroundColor: i === 0 ? "rgba(129, 181, 161, 0.15)" : "rgba(255, 255, 255, 0.04)", color: i === 0 ? COLORS.brand : COLORS.textMuted, border: `1px solid ${i === 0 ? "rgba(129, 181, 161, 0.3)" : COLORS.border}` }}>
          {label}
        </div>
      ))}
    </div>
  );
}

function AchievementCard({ achievement, index }: { achievement: typeof mockAchievements[0]; index: number }) {
  const frame = useCurrentFrame();
  const delay = 50 + index * 12;
  const opacity = interpolate(frame - delay, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const translateX = interpolate(frame - delay, [0, 15], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{ backgroundColor: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16, opacity, transform: `translateX(${translateX}px)` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ color: COLORS.textPrimary, fontSize: 15, fontWeight: 600, margin: 0 }}>{achievement.customer}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <span style={{ backgroundColor: "rgba(129, 181, 161, 0.1)", color: COLORS.brand, fontSize: 11, padding: "2px 8px", borderRadius: 6, fontWeight: 500 }}>{achievement.vertical}</span>
            <p style={{ color: COLORS.textMuted, fontSize: 12, margin: 0 }}>{achievement.date}</p>
          </div>
        </div>
        <p style={{ color: COLORS.brand, fontSize: 18, fontWeight: 700, margin: 0 }}>${(achievement.amount / 1000).toFixed(0)}k</p>
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" as const }}>
        {achievement.products.map((p) => (
          <span key={p} style={{ backgroundColor: "rgba(255, 255, 255, 0.04)", color: COLORS.textMuted, fontSize: 11, padding: "2px 8px", borderRadius: 4 }}>{p}</span>
        ))}
      </div>
    </div>
  );
}

export default function MisVentasComposition() {
  const frame = useCurrentFrame();
  const scene = getActiveScene(frame);
  const streakColor = mockSalesKPIs.streak >= 3 ? COLORS.orange : COLORS.textMuted;

  return (
    <AbsoluteFill style={BASE_COMPOSITION_STYLE}>
      <div style={{ padding: 40 }}>
        <h2 style={{ color: COLORS.textPrimary, fontSize: 20, fontWeight: 600, margin: 0, marginBottom: 24 }}>Mis Ventas</h2>

        <div style={{ display: "flex", gap: 14, marginBottom: 24 }}>
          <FocusWrapper highlightStart={S1[0]} highlightDuration={S1[1] - S1[0]} activeScene={scene} sceneRange={S1}>
            <SalesKPICard title="Mis ventas del mes" value={`${mockSalesKPIs.totalOrders} ordenes`} subtitle={`$${(mockSalesKPIs.totalRevenue / 1000).toFixed(0)}k facturado`} color={COLORS.brand} emoji="🛒" index={0} />
          </FocusWrapper>
          <FocusWrapper highlightStart={S2[0]} highlightDuration={S2[1] - S2[0]} activeScene={scene} sceneRange={S2}>
            <SalesKPICard title="Ventas con PymePilot" value={`${mockSalesKPIs.atribuidas} ordenes`} subtitle={`$${(mockSalesKPIs.montoAtribuido / 1000).toFixed(0)}k atribuido`} color="#eab308" emoji="🏆" index={1} />
          </FocusWrapper>
          <FocusWrapper highlightStart={S3[0]} highlightDuration={S3[1] - S3[0]} activeScene={scene} sceneRange={S3}>
            <SalesKPICard title="Racha de ventas" value={`${mockSalesKPIs.streak} dias`} subtitle="seguidos vendiendo" color={streakColor} emoji="🔥" index={2} />
          </FocusWrapper>
        </div>

        <div style={{ marginBottom: 20 }}>
          <FocusWrapper highlightStart={S4[0]} highlightDuration={S4[1] - S4[0]} activeScene={scene} sceneRange={S4}>
            <VerticalFilters />
          </FocusWrapper>
        </div>

        <FocusWrapper highlightStart={S5[0]} highlightDuration={S5[1] - S5[0]} activeScene={scene} sceneRange={S5}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {mockAchievements.map((a, i) => (
              <AchievementCard key={a.customer} achievement={a} index={i} />
            ))}
          </div>
        </FocusWrapper>
      </div>

      <TextOverlay text="'Mis ventas del mes' muestra TODAS tus ventas del mes: cuantas ordenes cerraste y cuanto facturaron en total. Es tu resumen comercial." startFrame={S1[0] + 5} duration={120} position="bottom" fontSize={24} />
      <TextOverlay text="'Ventas con PymePilot' es la clave: te muestra cuantas de esas ventas vinieron de clientes que PymePilot te sugirio contactar. Asi medis el impacto real del sistema." startFrame={S2[0] + 5} duration={120} position="bottom" fontSize={24} />
      <TextOverlay text="La racha cuenta dias consecutivos en los que cerraste al menos una venta. Cuando llegas a 3 dias, el icono se prende fuego para motivarte a seguir." startFrame={S3[0] + 5} duration={90} position="bottom" fontSize={24} />
      <TextOverlay text="Estos filtros te permiten ver logros por tipo de recomendacion: Reposicion (cliente habitual), Cross-sell (producto nuevo), Activacion (cliente nuevo) o Recuperacion (cliente perdido)." startFrame={S4[0] + 5} duration={90} position="bottom" fontSize={24} />
      <TextOverlay text="Cada tarjeta es una venta atribuida: muestra el cliente, el tipo de recomendacion, el monto, y los productos que compro. Son tus logros concretos." startFrame={S5[0] + 5} duration={140} position="bottom" fontSize={24} />
      <TextOverlay text="Esta seccion celebra tus resultados — cuanto mas contactes, mas logros acumulas." startFrame={660} duration={70} position="center" fontSize={26} />
    </AbsoluteFill>
  );
}
