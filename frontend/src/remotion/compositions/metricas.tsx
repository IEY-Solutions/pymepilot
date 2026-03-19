import { AbsoluteFill, useCurrentFrame, interpolate, Sequence } from "remotion";
import { BASE_COMPOSITION_STYLE, COLORS } from "../styles";
import { TextOverlay } from "../components/text-overlay";
import { Highlight } from "../components/annotation";
import { AnimatedCursor } from "../components/cursor";
import { mockRevenueByMonth, mockChurnByMonth, mockCustomers } from "../data/mock-data";

// --- Sub-componentes visuales ---

function TabBar({ activeTab }: { activeTab: number }) {
  const tabs = ["Rendimiento", "Clientes", "Productos", "Demanda", "Comparar"];

  return (
    <div style={{ display: "flex", gap: 2, marginBottom: 24, borderBottom: `1px solid ${COLORS.border}` }}>
      {tabs.map((tab, i) => (
        <div
          key={tab}
          style={{
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: i === activeTab ? 600 : 400,
            color: i === activeTab ? COLORS.brand : COLORS.textMuted,
            borderBottom: i === activeTab ? `2px solid ${COLORS.brand}` : "2px solid transparent",
          }}
        >
          {tab}
        </div>
      ))}
    </div>
  );
}

function MiniKPI({ title, value, color, index }: { title: string; value: string; color: string; index: number }) {
  const frame = useCurrentFrame();
  const delay = index * 6;
  const opacity = interpolate(frame - delay, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
        const delay = 20 + i * 5;
        const growProgress = interpolate(frame - delay, [0, 20], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <div key={d.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div
              style={{
                width: "100%",
                maxWidth: 50,
                height: barHeight * growProgress,
                backgroundColor: color,
                borderRadius: "4px 4px 0 0",
                opacity: 0.8,
              }}
            />
            <p style={{ color: COLORS.textMuted, fontSize: 11, margin: 0 }}>{d.month}</p>
          </div>
        );
      })}
    </div>
  );
}

function RevenueChart() {
  const frame = useCurrentFrame();

  return (
    <div style={{ backgroundColor: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
      <p style={{ color: COLORS.textSecondary, fontSize: 14, fontWeight: 600, margin: 0, marginBottom: 12 }}>
        Facturacion mensual
      </p>
      <BarChart data={mockRevenueByMonth} dataKey="recurrente" color={COLORS.brand} height={160} />
    </div>
  );
}

function ChurnChart() {
  return (
    <div style={{ backgroundColor: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
      <p style={{ color: COLORS.textSecondary, fontSize: 14, fontWeight: 600, margin: 0, marginBottom: 12 }}>
        Tasa de churn
      </p>
      <BarChart data={mockChurnByMonth} dataKey="rate" color={COLORS.red} height={160} />
    </div>
  );
}

function RankingTable() {
  const frame = useCurrentFrame();
  const topCustomers = mockCustomers.slice(0, 5);

  return (
    <div style={{ backgroundColor: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
      <p style={{ color: COLORS.textSecondary, fontSize: 14, fontWeight: 600, margin: 0, marginBottom: 12 }}>
        Top 5 Clientes
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {topCustomers.map((c, i) => {
          const delay = 40 + i * 6;
          const opacity = interpolate(frame - delay, [0, 12], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 10px",
                borderRadius: 6,
                backgroundColor: i === 0 ? "rgba(129, 181, 161, 0.06)" : "transparent",
                opacity,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: COLORS.textMuted, fontSize: 13, width: 20 }}>#{i + 1}</span>
                <span style={{ color: COLORS.textPrimary, fontSize: 13 }}>{c.name}</span>
              </div>
              <span style={{ color: COLORS.brand, fontSize: 13, fontWeight: 600 }}>
                ${(c.total_purchases / 1000).toFixed(0)}k
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Composicion principal ---

export default function MetricasComposition() {
  const frame = useCurrentFrame();
  // Cambio de tab visual a los 400 frames
  const activeTab = frame < 400 ? 0 : 1;

  return (
    <AbsoluteFill style={BASE_COMPOSITION_STYLE}>
      <div style={{ padding: "30px 40px" }}>
        <h2 style={{ color: COLORS.textPrimary, fontSize: 20, fontWeight: 600, margin: 0, marginBottom: 16 }}>
          Metricas
        </h2>

        <TabBar activeTab={activeTab} />

        {activeTab === 0 ? (
          <>
            {/* KPI row */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <MiniKPI title="Facturacion total" value="$615k" color={COLORS.brand} index={0} />
              <MiniKPI title="Churn" value="7%" color={COLORS.red} index={1} />
              <MiniKPI title="Ticket promedio" value="$13.7k" color={COLORS.purple} index={2} />
              <MiniKPI title="Valor atribuido" value="$345k" color={COLORS.orange} index={3} />
            </div>

            {/* Charts grid */}
            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <RevenueChart />
              </div>
              <div style={{ flex: 1 }}>
                <ChurnChart />
              </div>
            </div>
          </>
        ) : (
          <RankingTable />
        )}
      </div>

      {/* --- Anotaciones --- */}

      {/* Fase 1: KPIs */}
      <Sequence from={25} durationInFrames={90}>
        <Highlight x={40} y={90} width={1200} height={65} startFrame={0} duration={80} />
      </Sequence>
      <TextOverlay
        text="Los numeros clave de tu negocio, actualizados cada dia"
        startFrame={30}
        duration={80}
      />

      {/* Fase 2: Facturacion chart */}
      <Sequence from={140} durationInFrames={100}>
        <Highlight x={40} y={175} width={590} height={220} startFrame={0} duration={90} />
      </Sequence>
      <TextOverlay
        text="El grafico de facturacion te muestra como venis mes a mes"
        startFrame={145}
        duration={85}
      />

      {/* Fase 3: Churn chart */}
      <Sequence from={270} durationInFrames={100}>
        <Highlight x={650} y={175} width={590} height={220} startFrame={0} duration={90} />
      </Sequence>
      <TextOverlay
        text="El churn te dice si estas perdiendo clientes — cuanto mas bajo, mejor"
        startFrame={275}
        duration={85}
      />

      {/* Fase 4: Tab clientes (cambio visual) */}
      <TextOverlay
        text="En la pestana Clientes ves tu ranking de mejores compradores"
        startFrame={420}
        duration={90}
      />

      {/* Cursor */}
      <AnimatedCursor
        startFrame={20}
        path={[
          { x: 640, y: 400, frame: 0 },
          { x: 300, y: 125, frame: 20 },
          { x: 300, y: 300, frame: 130 },
          { x: 900, y: 300, frame: 260 },
          { x: 190, y: 60, frame: 380 },   // Click tab "Clientes"
          { x: 400, y: 300, frame: 420 },
        ]}
        showClick
      />
    </AbsoluteFill>
  );
}
