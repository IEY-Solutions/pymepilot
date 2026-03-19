import { AbsoluteFill, useCurrentFrame, interpolate, Sequence } from "remotion";
import { BASE_COMPOSITION_STYLE, COLORS } from "../styles";
import { TextOverlay } from "../components/text-overlay";
import { Highlight } from "../components/annotation";
import { AnimatedCursor } from "../components/cursor";
import { mockSalesKPIs, mockAchievements } from "../data/mock-data";

// --- Sub-componentes visuales ---

function SalesKPICard({
  title,
  value,
  subtitle,
  color,
  emoji,
  index,
}: {
  title: string;
  value: string;
  subtitle: string;
  color: string;
  emoji: string;
  index: number;
}) {
  const frame = useCurrentFrame();
  const delay = index * 8;

  const opacity = interpolate(frame - delay, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        flex: 1,
        backgroundColor: COLORS.bgCard,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        padding: "18px 16px",
        opacity,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 20 }}>{emoji}</span>
        <p style={{ color: COLORS.textMuted, fontSize: 13, margin: 0 }}>{title}</p>
      </div>
      <p style={{ color, fontSize: 26, fontWeight: 700, margin: 0 }}>
        {value}
      </p>
      <p style={{ color: COLORS.textMuted, fontSize: 12, margin: 0, marginTop: 4 }}>
        {subtitle}
      </p>
    </div>
  );
}

function AchievementCard({
  achievement,
  index,
}: {
  achievement: typeof mockAchievements[0];
  index: number;
}) {
  const frame = useCurrentFrame();
  const delay = 50 + index * 12;

  const opacity = interpolate(frame - delay, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateX = interpolate(frame - delay, [0, 15], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        backgroundColor: COLORS.bgCard,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        padding: 16,
        opacity,
        transform: `translateX(${translateX}px)`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ color: COLORS.textPrimary, fontSize: 15, fontWeight: 600, margin: 0 }}>
            {achievement.customer}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <span
              style={{
                backgroundColor: "rgba(129, 181, 161, 0.1)",
                color: COLORS.brand,
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 6,
                fontWeight: 500,
              }}
            >
              {achievement.vertical}
            </span>
            <p style={{ color: COLORS.textMuted, fontSize: 12, margin: 0 }}>
              {achievement.date}
            </p>
          </div>
        </div>
        <p style={{ color: COLORS.brand, fontSize: 18, fontWeight: 700, margin: 0 }}>
          ${(achievement.amount / 1000).toFixed(0)}k
        </p>
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" as const }}>
        {achievement.products.map((p) => (
          <span
            key={p}
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.04)",
              color: COLORS.textMuted,
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 4,
            }}
          >
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

// --- Composicion principal ---

export default function MisVentasComposition() {
  const streakColor = mockSalesKPIs.streak >= 3 ? COLORS.orange : COLORS.textMuted;

  return (
    <AbsoluteFill style={BASE_COMPOSITION_STYLE}>
      <div style={{ padding: 40 }}>
        <h2 style={{ color: COLORS.textPrimary, fontSize: 20, fontWeight: 600, margin: 0, marginBottom: 24 }}>
          Mis Ventas
        </h2>

        {/* KPI Cards */}
        <div style={{ display: "flex", gap: 14, marginBottom: 24 }}>
          <SalesKPICard
            title="Mis ventas del mes"
            value={`${mockSalesKPIs.totalOrders} ordenes`}
            subtitle={`$${(mockSalesKPIs.totalRevenue / 1000).toFixed(0)}k facturado`}
            color={COLORS.brand}
            emoji="🛒"
            index={0}
          />
          <SalesKPICard
            title="Ventas con PymePilot"
            value={`${mockSalesKPIs.atribuidas} ordenes`}
            subtitle={`$${(mockSalesKPIs.montoAtribuido / 1000).toFixed(0)}k atribuido`}
            color="#eab308"
            emoji="🏆"
            index={1}
          />
          <SalesKPICard
            title="Racha de ventas"
            value={`${mockSalesKPIs.streak} dias`}
            subtitle="seguidos vendiendo"
            color={streakColor}
            emoji="🔥"
            index={2}
          />
        </div>

        {/* Vertical filter pills */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {["Todas", "Reposicion", "Cross-sell", "Activacion", "Recuperacion"].map((label, i) => (
            <div
              key={label}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 500,
                backgroundColor: i === 0 ? "rgba(129, 181, 161, 0.15)" : "rgba(255, 255, 255, 0.04)",
                color: i === 0 ? COLORS.brand : COLORS.textMuted,
                border: `1px solid ${i === 0 ? "rgba(129, 181, 161, 0.3)" : COLORS.border}`,
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Achievement cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mockAchievements.map((a, i) => (
            <AchievementCard key={a.customer} achievement={a} index={i} />
          ))}
        </div>
      </div>

      {/* --- Anotaciones --- */}

      {/* Fase 1: KPIs */}
      <Sequence from={30} durationInFrames={100}>
        <Highlight x={40} y={68} width={1200} height={100} startFrame={0} duration={90} />
      </Sequence>
      <TextOverlay
        text="Aca ves cuantas ventas hiciste y cuantas gracias a PymePilot"
        startFrame={35}
        duration={85}
      />

      {/* Fase 2: Racha */}
      <Sequence from={160} durationInFrames={90}>
        <Highlight x={830} y={68} width={410} height={100} startFrame={0} duration={80} />
      </Sequence>
      <TextOverlay
        text="La racha te motiva a contactar clientes todos los dias"
        startFrame={165}
        duration={80}
      />

      {/* Fase 3: Filtros */}
      <Sequence from={280} durationInFrames={90}>
        <Highlight x={40} y={195} width={600} height={35} startFrame={0} duration={80} />
      </Sequence>
      <TextOverlay
        text="Filtra por tipo de recomendacion para ver que funciona mejor"
        startFrame={285}
        duration={80}
      />

      {/* Fase 4: Cards */}
      <Sequence from={400} durationInFrames={100}>
        <Highlight x={40} y={250} width={1200} height={300} startFrame={0} duration={90} />
      </Sequence>
      <TextOverlay
        text="Cada tarjeta te muestra el cliente, los productos, y cuanto facturo"
        startFrame={405}
        duration={85}
      />

      {/* Cursor */}
      <AnimatedCursor
        startFrame={25}
        path={[
          { x: 640, y: 400, frame: 0 },
          { x: 200, y: 120, frame: 25 },
          { x: 1050, y: 120, frame: 150 },
          { x: 200, y: 210, frame: 270 },
          { x: 640, y: 350, frame: 390 },
        ]}
        showClick
      />
    </AbsoluteFill>
  );
}
