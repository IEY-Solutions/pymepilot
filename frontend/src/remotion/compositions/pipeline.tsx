import { AbsoluteFill, useCurrentFrame, interpolate, Sequence, spring, useVideoConfig } from "remotion";
import { BASE_COMPOSITION_STYLE, COLORS } from "../styles";
import { TextOverlay } from "../components/text-overlay";
import { Highlight } from "../components/annotation";
import { AnimatedCursor } from "../components/cursor";
import { mockPipelineStages, mockPipelineCards } from "../data/mock-data";

// --- Sub-componentes visuales ---

function ColumnHeader({ label, count, index }: { label: string; count: number; index: number }) {
  const frame = useCurrentFrame();
  const delay = index * 4;
  const opacity = interpolate(frame - delay, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ opacity, marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ color: COLORS.textSecondary, fontSize: 12, fontWeight: 600, margin: 0, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>
          {label}
        </p>
        <span
          style={{
            backgroundColor: "rgba(129, 181, 161, 0.1)",
            color: COLORS.brand,
            fontSize: 11,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 10,
          }}
        >
          {count}
        </span>
      </div>
    </div>
  );
}

function PipelineCard({
  card,
  cardIndex,
  isDragging,
}: {
  card: typeof mockPipelineCards[0];
  cardIndex: number;
  isDragging: boolean;
}) {
  const frame = useCurrentFrame();
  const delay = 20 + cardIndex * 8;
  const opacity = interpolate(frame - delay, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const priorityColor =
    card.priority === "high" ? COLORS.red :
    card.priority === "medium" ? COLORS.yellow : COLORS.textMuted;

  return (
    <div
      style={{
        backgroundColor: isDragging ? "rgba(129, 181, 161, 0.08)" : COLORS.bgCard,
        border: `1px solid ${isDragging ? "rgba(129, 181, 161, 0.3)" : COLORS.border}`,
        borderRadius: 10,
        padding: 12,
        opacity,
        transform: isDragging ? "rotate(-2deg) scale(1.02)" : "none",
        boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,0.3)" : "none",
        transition: "transform 0.2s, box-shadow 0.2s",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <p style={{ color: COLORS.textPrimary, fontSize: 13, fontWeight: 600, margin: 0 }}>
          {card.customer.name}
        </p>
        <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: priorityColor, marginTop: 4 }} />
      </div>
      <p style={{ color: COLORS.textMuted, fontSize: 11, lineHeight: 1.4, margin: 0, marginBottom: 6 }}>
        {card.message.substring(0, 80)}...
      </p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: COLORS.brand, fontSize: 11, fontWeight: 500 }}>
          {Math.round(card.confidence * 100)}% confianza
        </span>
        <span style={{ color: COLORS.textMuted, fontSize: 10 }}>
          📋 Copiar
        </span>
      </div>
    </div>
  );
}

function DragAnimation() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Solo mostrar durante el rango de drag
  if (frame < 250 || frame > 350) return null;

  const localFrame = frame - 250;

  // Mover la card de la columna 1 a la columna 2
  const progress = spring({
    frame: localFrame,
    fps,
    config: { damping: 20, stiffness: 60, mass: 0.8 },
    durationInFrames: 60,
  });

  const x = interpolate(progress, [0, 1], [0, 190]);
  const y = interpolate(progress, [0, 0.5, 1], [0, -20, 0]);

  return (
    <div
      style={{
        position: "absolute",
        left: 55 + x,
        top: 170,
        width: 170,
        zIndex: 25,
        transform: `translateY(${y}px) rotate(-2deg) scale(1.03)`,
        opacity: interpolate(localFrame, [0, 5, 55, 60], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(129, 181, 161, 0.1)",
          border: "1px solid rgba(129, 181, 161, 0.3)",
          borderRadius: 10,
          padding: 12,
          boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
        }}
      >
        <p style={{ color: COLORS.textPrimary, fontSize: 13, fontWeight: 600, margin: 0 }}>
          TechStore Buenos Aires
        </p>
        <p style={{ color: COLORS.textMuted, fontSize: 11, margin: 0, marginTop: 4 }}>
          Cross-sell: Soportes MagSafe...
        </p>
      </div>
    </div>
  );
}

// --- Composicion principal ---

export default function PipelineComposition() {
  const frame = useCurrentFrame();

  // Mapear cards a columnas
  const cardsByStage = mockPipelineStages.map((stage) => ({
    ...stage,
    cards: mockPipelineCards.filter((c) => c.stage === stage.id),
  }));

  return (
    <AbsoluteFill style={BASE_COMPOSITION_STYLE}>
      <div style={{ padding: "24px 30px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ color: COLORS.textPrimary, fontSize: 20, fontWeight: 600, margin: 0 }}>
            Pipeline
          </h2>
          <span style={{ color: COLORS.textMuted, fontSize: 13 }}>
            7 contactos totales
          </span>
        </div>

        {/* Kanban board */}
        <div style={{ display: "flex", gap: 10, height: 520 }}>
          {cardsByStage.map((stage, i) => (
            <div
              key={stage.id}
              style={{
                flex: 1,
                backgroundColor: "rgba(255, 255, 255, 0.015)",
                borderRadius: 10,
                padding: 10,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <ColumnHeader label={stage.label} count={stage.cards.length} index={i} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                {stage.cards.map((card, ci) => (
                  <PipelineCard
                    key={card.id}
                    card={card}
                    cardIndex={i * 2 + ci}
                    isDragging={false}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Animacion de drag */}
      <DragAnimation />

      {/* --- Anotaciones --- */}

      {/* Fase 1: Vista general del kanban */}
      <TextOverlay
        text="Tu tablero de contactos: cada columna es una etapa del proceso de venta"
        startFrame={30}
        duration={90}
        position="bottom"
      />

      {/* Fase 2: Cards en A contactar */}
      <Sequence from={140} durationInFrames={90}>
        <Highlight x={30} y={95} width={190} height={430} startFrame={0} duration={80} />
      </Sequence>
      <TextOverlay
        text="Aca aparecen los clientes que PymePilot te sugiere contactar hoy"
        startFrame={145}
        duration={80}
      />

      {/* Fase 3: Drag and drop */}
      <TextOverlay
        text="Arrastra las tarjetas cuando avances con cada cliente"
        startFrame={255}
        duration={80}
        position="top"
      />

      {/* Fase 4: Columna Vendido */}
      <Sequence from={380} durationInFrames={90}>
        <Highlight x={1050} y={95} width={190} height={430} startFrame={0} duration={80} />
      </Sequence>
      <TextOverlay
        text="Cuando cerras una venta, la tarjeta llega aca — con confeti incluido 🎉"
        startFrame={385}
        duration={80}
      />

      {/* Cursor */}
      <AnimatedCursor
        startFrame={20}
        path={[
          { x: 640, y: 400, frame: 0 },
          { x: 130, y: 200, frame: 25 },     // Card en A contactar
          { x: 130, y: 200, frame: 130 },     // Queda ahi
          { x: 130, y: 190, frame: 235 },     // Prepara drag
          { x: 320, y: 190, frame: 310 },     // Arrastra a Contactado
          { x: 1130, y: 200, frame: 370 },    // Mira Vendido
          { x: 640, y: 400, frame: 460 },
        ]}
        showClick
      />
    </AbsoluteFill>
  );
}
