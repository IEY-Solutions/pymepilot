import { AbsoluteFill, useCurrentFrame, interpolate, Sequence } from "remotion";
import { BASE_COMPOSITION_STYLE, COLORS } from "../styles";
import { TextOverlay } from "../components/text-overlay";
import { Highlight } from "../components/annotation";
import { AnimatedCursor } from "../components/cursor";
import { mockKPIs } from "../data/mock-data";

// --- Sub-componentes visuales (wrappers simplificados) ---

function KPICard({
  title,
  value,
  subtitle,
  color,
  index,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  color: string;
  index: number;
}) {
  const frame = useCurrentFrame();
  const delay = index * 8;

  const opacity = interpolate(frame - delay, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(frame - delay, [0, 15], [20, 0], {
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
        padding: "20px 16px",
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <p style={{ color: COLORS.textMuted, fontSize: 13, margin: 0, marginBottom: 8 }}>
        {title}
      </p>
      <p style={{ color, fontSize: 28, fontWeight: 700, margin: 0, marginBottom: 4 }}>
        {value}
      </p>
      <p style={{ color: COLORS.textMuted, fontSize: 12, margin: 0 }}>
        {subtitle}
      </p>
    </div>
  );
}

function OrchestratorCard() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame - 40, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        backgroundColor: "rgba(99, 102, 241, 0.08)",
        border: "1px solid rgba(99, 102, 241, 0.2)",
        borderRadius: 12,
        padding: "16px 20px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        opacity,
      }}
    >
      <div>
        <p style={{ color: COLORS.indigo, fontSize: 14, fontWeight: 600, margin: 0 }}>
          {mockKPIs.prediccionesHoy} contactos sugeridos hoy
        </p>
        <p style={{ color: COLORS.textMuted, fontSize: 12, margin: 0, marginTop: 4 }}>
          Ultimo run: {mockKPIs.ultimoOrquestador}
        </p>
      </div>
      <div
        style={{
          backgroundColor: "rgba(99, 102, 241, 0.15)",
          borderRadius: 8,
          padding: "6px 12px",
          color: COLORS.indigo,
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        Ver contactos →
      </div>
    </div>
  );
}

function FreshnessCard() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame - 55, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        backgroundColor: "rgba(34, 197, 94, 0.08)",
        border: "1px solid rgba(34, 197, 94, 0.2)",
        borderRadius: 12,
        padding: "12px 20px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        opacity,
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: COLORS.green,
        }}
      />
      <p style={{ color: COLORS.green, fontSize: 13, margin: 0 }}>
        Datos frescos — ultima sync hace 2 horas
      </p>
    </div>
  );
}

// --- Composicion principal ---

export default function InicioComposition() {
  return (
    <AbsoluteFill style={BASE_COMPOSITION_STYLE}>
      <div style={{ padding: 40 }}>
        {/* Header */}
        <h2
          style={{
            color: COLORS.textPrimary,
            fontSize: 20,
            fontWeight: 600,
            margin: 0,
            marginBottom: 24,
          }}
        >
          Inicio
        </h2>

        {/* KPI Grid */}
        <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
          <KPICard
            title="Pendientes"
            value={mockKPIs.pendientes}
            subtitle="clientes por contactar"
            color={COLORS.brand}
            index={0}
          />
          <KPICard
            title="Tasa contacto"
            value={`${mockKPIs.tasaContacto}%`}
            subtitle="este mes"
            color={COLORS.brand}
            index={1}
          />
          <KPICard
            title="Clientes activos"
            value={mockKPIs.clientesActivos}
            subtitle="con compras recientes"
            color={COLORS.purple}
            index={2}
          />
          <KPICard
            title="Ultima sync"
            value={mockKPIs.ultimaSync}
            subtitle="contabilium"
            color={COLORS.orange}
            index={3}
          />
        </div>

        {/* Orchestrator + Freshness */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <OrchestratorCard />
          <FreshnessCard />
        </div>
      </div>

      {/* --- Anotaciones animadas --- */}

      {/* Fase 1: Highlight en KPIs (frames 30-120) */}
      <Sequence from={30} durationInFrames={90}>
        <Highlight x={40} y={70} width={280} height={110} startFrame={0} duration={90} />
      </Sequence>

      <TextOverlay
        text="Aca ves de un vistazo cuantos clientes te esperan hoy"
        startFrame={30}
        duration={90}
        position="bottom"
      />

      {/* Fase 2: Cursor se mueve al orquestador (frames 150-270) */}
      <Sequence from={150} durationInFrames={120}>
        <Highlight x={40} y={225} width={1200} height={65} startFrame={0} duration={100} />
      </Sequence>

      <TextOverlay
        text="El orquestador te dice cuantos contactos genero hoy a las 5 AM"
        startFrame={160}
        duration={90}
        position="bottom"
      />

      {/* Fase 3: Highlight en freshness (frames 300-420) */}
      <Sequence from={300} durationInFrames={120}>
        <Highlight x={40} y={305} width={1200} height={45} startFrame={0} duration={100} />
      </Sequence>

      <TextOverlay
        text="El indicador de frescura te avisa si tus datos necesitan actualizarse"
        startFrame={310}
        duration={90}
        position="bottom"
      />

      {/* Cursor recorriendo los elementos clave */}
      <AnimatedCursor
        startFrame={25}
        path={[
          { x: 640, y: 400, frame: 0 },
          { x: 180, y: 120, frame: 30 },    // KPI Pendientes
          { x: 640, y: 260, frame: 130 },    // Orquestador
          { x: 300, y: 330, frame: 280 },    // Freshness
          { x: 640, y: 400, frame: 400 },    // Centro
        ]}
        showClick
      />
    </AbsoluteFill>
  );
}
