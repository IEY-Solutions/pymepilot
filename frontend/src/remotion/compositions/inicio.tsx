import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { BASE_COMPOSITION_STYLE, COLORS } from "../styles";
import { TextOverlay } from "../components/text-overlay";
import { FocusWrapper } from "../components/focus-wrapper";
import { mockKPIs } from "../data/mock-data";

/**
 * Escenas del video Inicio (total ~25s = 750 frames a 30fps):
 *
 * 0-45:     Entrada: todo aparece con stagger
 * 45-165:   Escena 1 — KPI "Pendientes" (que significa, para que sirve)
 * 165-285:  Escena 2 — KPI "Tasa contacto" (como se calcula, que indica)
 * 285-375:  Escena 3 — KPIs "Clientes activos" + "Ultima sync" (vista rapida)
 * 375-510:  Escena 4 — Card del orquestador (que hace, cuando corre)
 * 510-630:  Escena 5 — Indicador de frescura (verde/amarillo/rojo)
 * 630-750:  Escena 6 — Vista general, cierre
 */

// Escenas
const S1 = [45, 165] as const;
const S2 = [165, 285] as const;
const S3 = [285, 375] as const;
const S4 = [375, 510] as const;
const S5 = [510, 630] as const;

function getActiveScene(frame: number): number {
  if (frame >= S1[0] && frame <= S1[1]) return 1;
  if (frame >= S2[0] && frame <= S2[1]) return 2;
  if (frame >= S3[0] && frame <= S3[1]) return 3;
  if (frame >= S4[0] && frame <= S4[1]) return 4;
  if (frame >= S5[0] && frame <= S5[1]) return 5;
  return 0;
}

// --- Sub-componentes visuales ---

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
      <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: COLORS.green }} />
      <p style={{ color: COLORS.green, fontSize: 13, margin: 0 }}>
        Datos frescos — ultima sync hace 2 horas
      </p>
    </div>
  );
}

// --- Composicion principal ---

export default function InicioComposition() {
  const frame = useCurrentFrame();
  const scene = getActiveScene(frame);

  return (
    <AbsoluteFill style={BASE_COMPOSITION_STYLE}>
      <div style={{ padding: 40 }}>
        {/* Header */}
        <h2 style={{ color: COLORS.textPrimary, fontSize: 20, fontWeight: 600, margin: 0, marginBottom: 24 }}>
          Inicio
        </h2>

        {/* KPI Grid */}
        <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
          <FocusWrapper highlightStart={S1[0]} highlightDuration={S1[1] - S1[0]} activeScene={scene} sceneRange={S1}>
            <KPICard title="Pendientes" value={mockKPIs.pendientes} subtitle="clientes por contactar" color={COLORS.brand} index={0} />
          </FocusWrapper>
          <FocusWrapper highlightStart={S2[0]} highlightDuration={S2[1] - S2[0]} activeScene={scene} sceneRange={S2}>
            <KPICard title="Tasa contacto" value={`${mockKPIs.tasaContacto}%`} subtitle="este mes" color={COLORS.brand} index={1} />
          </FocusWrapper>
          <FocusWrapper highlightStart={S3[0]} highlightDuration={45} activeScene={scene} sceneRange={S3}>
            <KPICard title="Clientes activos" value={mockKPIs.clientesActivos} subtitle="con compras recientes" color={COLORS.purple} index={2} />
          </FocusWrapper>
          <FocusWrapper highlightStart={S3[0] + 45} highlightDuration={45} activeScene={scene} sceneRange={S3}>
            <KPICard title="Ultima sync" value={mockKPIs.ultimaSync} subtitle="contabilium" color={COLORS.orange} index={3} />
          </FocusWrapper>
        </div>

        {/* Orchestrator + Freshness */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <FocusWrapper highlightStart={S4[0]} highlightDuration={S4[1] - S4[0]} activeScene={scene} sceneRange={S4}>
            <OrchestratorCard />
          </FocusWrapper>
          <FocusWrapper highlightStart={S5[0]} highlightDuration={S5[1] - S5[0]} activeScene={scene} sceneRange={S5}>
            <FreshnessCard />
          </FocusWrapper>
        </div>
      </div>

      {/* --- Textos explicativos por escena --- */}

      {/* Escena 1: Pendientes */}
      <TextOverlay
        text="'Pendientes' te muestra cuantos clientes PymePilot recomienda contactar hoy. Este numero se actualiza cada manana a las 5 AM cuando el sistema analiza tus datos."
        startFrame={S1[0] + 5}
        duration={110}
        position="bottom"
        fontSize={24}
      />

      {/* Escena 2: Tasa de contacto */}
      <TextOverlay
        text="La 'Tasa de contacto' mide que porcentaje de los clientes sugeridos efectivamente contactaste este mes. Cuanto mas alta, mejor estas aprovechando las recomendaciones."
        startFrame={S2[0] + 5}
        duration={110}
        position="bottom"
        fontSize={24}
      />

      {/* Escena 3: Clientes activos + Sync */}
      <TextOverlay
        text="'Clientes activos' cuenta los que compraron recientemente. 'Ultima sync' te dice cuando se actualizaron los datos desde tu ERP."
        startFrame={S3[0] + 5}
        duration={80}
        position="bottom"
        fontSize={24}
      />

      {/* Escena 4: Orquestador */}
      <TextOverlay
        text="Esta tarjeta aparece cuando el sistema genero recomendaciones. Te dice cuantos contactos sugirio y a que hora corrio. Hace click en 'Ver contactos' para ir directo al Pipeline."
        startFrame={S4[0] + 5}
        duration={125}
        position="bottom"
        fontSize={24}
      />

      {/* Escena 5: Frescura */}
      <TextOverlay
        text="El indicador de frescura cambia de color: verde si tus datos son recientes, amarillo si tienen mas de 2 dias, y rojo si estan desactualizados. Si esta rojo, anda a 'Datos' para sincronizar."
        startFrame={S5[0] + 5}
        duration={110}
        position="bottom"
        fontSize={24}
      />

      {/* Escena 6: Cierre */}
      <TextOverlay
        text="Esta es tu pagina de inicio — de un vistazo sabes como esta tu negocio hoy."
        startFrame={640}
        duration={90}
        position="center"
        fontSize={26}
      />
    </AbsoluteFill>
  );
}
