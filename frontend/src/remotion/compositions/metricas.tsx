import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { BASE_COMPOSITION_STYLE, COLORS } from "../styles";
import { TextOverlay } from "../components/text-overlay";
import { FocusWrapper } from "../components/focus-wrapper";
import { mockRevenueByMonth, mockChurnByMonth, mockCustomers } from "../data/mock-data";

/**
 * Escenas del video Metricas (total ~30s = 900 frames):
 *
 * 0-50:     Entrada
 * 50-180:   Escena 1 — Tabs de navegacion
 * 180-320:  Escena 2 — KPIs resumen (facturacion, churn, ticket, valor)
 * 320-470:  Escena 3 — Grafico de facturacion
 * 470-600:  Escena 4 — Grafico de churn
 * 600-750:  Escena 5 — Tab Clientes (ranking)
 * 750-900:  Cierre
 */

const S1 = [50, 180] as const;
const S2 = [180, 320] as const;
const S3 = [320, 470] as const;
const S4 = [470, 600] as const;
const S5 = [600, 750] as const;

function getActiveScene(frame: number): number {
  if (frame >= S1[0] && frame <= S1[1]) return 1;
  if (frame >= S2[0] && frame <= S2[1]) return 2;
  if (frame >= S3[0] && frame <= S3[1]) return 3;
  if (frame >= S4[0] && frame <= S4[1]) return 4;
  if (frame >= S5[0] && frame <= S5[1]) return 5;
  return 0;
}

function TabBar({ activeTab }: { activeTab: number }) {
  const tabs = ["Rendimiento", "Clientes", "Productos", "Demanda", "Comparar"];
  return (
    <div style={{ display: "flex", gap: 2, borderBottom: `1px solid ${COLORS.border}` }}>
      {tabs.map((tab, i) => (
        <div key={tab} style={{ padding: "10px 18px", fontSize: 14, fontWeight: i === activeTab ? 600 : 400, color: i === activeTab ? COLORS.brand : COLORS.textMuted, borderBottom: i === activeTab ? `2px solid ${COLORS.brand}` : "2px solid transparent" }}>
          {tab}
        </div>
      ))}
    </div>
  );
}

function MiniKPI({ title, value, color, index }: { title: string; value: string; color: string; index: number }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame - index * 6, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ flex: 1, backgroundColor: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 14px", opacity }}>
      <p style={{ color: COLORS.textMuted, fontSize: 12, margin: 0, marginBottom: 6 }}>{title}</p>
      <p style={{ color, fontSize: 22, fontWeight: 700, margin: 0 }}>{value}</p>
    </div>
  );
}

function BarChart({ data, dataKey, color, height }: { data: Array<{ month: string; [key: string]: string | number }>; dataKey: string; color: string; height: number }) {
  const frame = useCurrentFrame();
  const maxValue = Math.max(...data.map((d) => Number(d[dataKey])));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height, padding: "0 10px" }}>
      {data.map((d, i) => {
        const value = Number(d[dataKey]);
        const barHeight = (value / maxValue) * (height - 30);
        const growProgress = interpolate(frame - (20 + i * 5), [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div key={d.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ width: "100%", maxWidth: 50, height: barHeight * growProgress, backgroundColor: color, borderRadius: "4px 4px 0 0", opacity: 0.8 }} />
            <p style={{ color: COLORS.textMuted, fontSize: 11, margin: 0 }}>{d.month}</p>
          </div>
        );
      })}
    </div>
  );
}

function RankingTable() {
  const frame = useCurrentFrame();
  const topCustomers = mockCustomers.slice(0, 5);
  return (
    <div style={{ backgroundColor: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
      <p style={{ color: COLORS.textSecondary, fontSize: 14, fontWeight: 600, margin: 0, marginBottom: 12 }}>Top 5 Clientes</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {topCustomers.map((c, i) => {
          const opacity = interpolate(frame - (40 + i * 6), [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 6, backgroundColor: i === 0 ? "rgba(129, 181, 161, 0.06)" : "transparent", opacity }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: COLORS.textMuted, fontSize: 13, width: 20 }}>#{i + 1}</span>
                <span style={{ color: COLORS.textPrimary, fontSize: 13 }}>{c.name}</span>
              </div>
              <span style={{ color: COLORS.brand, fontSize: 13, fontWeight: 600 }}>${(c.total_purchases / 1000).toFixed(0)}k</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MetricasComposition() {
  const frame = useCurrentFrame();
  const scene = getActiveScene(frame);
  const activeTab = frame < S5[0] ? 0 : 1;

  return (
    <AbsoluteFill style={BASE_COMPOSITION_STYLE}>
      <div style={{ padding: "30px 40px" }}>
        <h2 style={{ color: COLORS.textPrimary, fontSize: 20, fontWeight: 600, margin: 0, marginBottom: 16 }}>Metricas</h2>

        <FocusWrapper highlightStart={S1[0]} highlightDuration={S1[1] - S1[0]} activeScene={scene} sceneRange={S1}>
          <TabBar activeTab={activeTab} />
        </FocusWrapper>

        <div style={{ marginTop: 16 }}>
          {activeTab === 0 ? (
            <>
              <div style={{ marginBottom: 16 }}>
                <FocusWrapper highlightStart={S2[0]} highlightDuration={S2[1] - S2[0]} activeScene={scene} sceneRange={S2}>
                  <div style={{ display: "flex", gap: 12 }}>
                    <MiniKPI title="Facturacion total" value="$615k" color={COLORS.brand} index={0} />
                    <MiniKPI title="Churn" value="7%" color={COLORS.red} index={1} />
                    <MiniKPI title="Ticket promedio" value="$13.7k" color={COLORS.purple} index={2} />
                    <MiniKPI title="Valor atribuido" value="$345k" color={COLORS.orange} index={3} />
                  </div>
                </FocusWrapper>
              </div>

              <div style={{ display: "flex", gap: 16 }}>
                <FocusWrapper highlightStart={S3[0]} highlightDuration={S3[1] - S3[0]} activeScene={scene} sceneRange={S3}>
                  <div style={{ flex: 1, backgroundColor: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
                    <p style={{ color: COLORS.textSecondary, fontSize: 14, fontWeight: 600, margin: 0, marginBottom: 12 }}>Facturacion mensual</p>
                    <BarChart data={mockRevenueByMonth} dataKey="recurrente" color={COLORS.brand} height={160} />
                  </div>
                </FocusWrapper>
                <FocusWrapper highlightStart={S4[0]} highlightDuration={S4[1] - S4[0]} activeScene={scene} sceneRange={S4}>
                  <div style={{ flex: 1, backgroundColor: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
                    <p style={{ color: COLORS.textSecondary, fontSize: 14, fontWeight: 600, margin: 0, marginBottom: 12 }}>Tasa de churn</p>
                    <BarChart data={mockChurnByMonth} dataKey="rate" color={COLORS.red} height={160} />
                  </div>
                </FocusWrapper>
              </div>
            </>
          ) : (
            <FocusWrapper highlightStart={S5[0]} highlightDuration={S5[1] - S5[0]} activeScene={scene} sceneRange={S5}>
              <RankingTable />
            </FocusWrapper>
          )}
        </div>
      </div>

      <TextOverlay text="La seccion Metricas tiene 5 pestanas. 'Rendimiento' te da la foto general. 'Clientes' y 'Productos' muestran rankings. 'Demanda' proyecta que vas a necesitar. 'Comparar' te deja ver periodos lado a lado." startFrame={S1[0] + 5} duration={120} position="bottom" fontSize={22} />
      <TextOverlay text="Estos 4 numeros resumen tu negocio: cuanto facturas, cuantos clientes perdes (churn), cuanto gasta cada cliente en promedio (ticket), y cuanto se atribuye a PymePilot." startFrame={S2[0] + 5} duration={130} position="bottom" fontSize={24} />
      <TextOverlay text="El grafico de facturacion muestra tus ingresos mes a mes. Si la tendencia sube, vas bien. Si baja, mira el churn y los clientes inactivos para entender por que." startFrame={S3[0] + 5} duration={140} position="bottom" fontSize={24} />
      <TextOverlay text="El churn mide que porcentaje de clientes dejaron de comprar. Un churn del 7% significa que de cada 100 clientes, 7 no volvieron este mes. Cuanto mas bajo, mejor." startFrame={S4[0] + 5} duration={120} position="bottom" fontSize={24} />
      <TextOverlay text="En la pestana 'Clientes' ves tu ranking de mejores compradores. El #1 es tu cliente estrella. Usa esta info para priorizar cuentas clave y detectar oportunidades." startFrame={S5[0] + 5} duration={140} position="bottom" fontSize={24} />
      <TextOverlay text="Metricas es tu tablero de control — los numeros que necesitas para tomar decisiones." startFrame={760} duration={90} position="center" fontSize={26} />
    </AbsoluteFill>
  );
}
