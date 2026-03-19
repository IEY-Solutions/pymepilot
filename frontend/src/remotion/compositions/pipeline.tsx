import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { BASE_COMPOSITION_STYLE, COLORS } from "../styles";
import { TextOverlay } from "../components/text-overlay";
import { FocusWrapper } from "../components/focus-wrapper";
import { mockPipelineStages, mockPipelineCards } from "../data/mock-data";

/**
 * Escenas del video Pipeline (total ~35s = 1050 frames):
 *
 * 0-60:     Entrada: columnas y cards aparecen
 * 60-210:   Escena 1 — Vista general del kanban (que es, como se lee)
 * 210-380:  Escena 2 — Columna "A contactar" (de donde vienen las tarjetas)
 * 380-530:  Escena 3 — Contenido de una tarjeta (mensaje, confianza, copiar)
 * 530-680:  Escena 4 — Drag and drop (animacion de arrastrar)
 * 680-830:  Escena 5 — Columna "Vendido" (cierre del ciclo)
 * 830-950:  Escena 6 — Seguimientos automaticos
 * 950-1050: Cierre
 */

const S1 = [60, 210] as const;
const S2 = [210, 380] as const;
const S3 = [380, 530] as const;
const S4 = [530, 680] as const;
const S5 = [680, 830] as const;
const S6 = [830, 950] as const;

function getActiveScene(frame: number): number {
  if (frame >= S1[0] && frame <= S1[1]) return 1;
  if (frame >= S2[0] && frame <= S2[1]) return 2;
  if (frame >= S3[0] && frame <= S3[1]) return 3;
  if (frame >= S4[0] && frame <= S4[1]) return 4;
  if (frame >= S5[0] && frame <= S5[1]) return 5;
  if (frame >= S6[0] && frame <= S6[1]) return 6;
  return 0;
}

function ColumnHeader({ label, count, index }: { label: string; count: number; index: number }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame - index * 4, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ opacity, marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, margin: 0, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>{label}</p>
        <span style={{ backgroundColor: "rgba(129, 181, 161, 0.1)", color: COLORS.brand, fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 10 }}>{count}</span>
      </div>
    </div>
  );
}

function PipelineCard({ card, cardIndex }: { card: typeof mockPipelineCards[0]; cardIndex: number }) {
  const frame = useCurrentFrame();
  const delay = 20 + cardIndex * 8;
  const opacity = interpolate(frame - delay, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const priorityColor = card.priority === "high" ? COLORS.red : card.priority === "medium" ? COLORS.yellow : COLORS.textMuted;

  return (
    <div style={{ backgroundColor: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 10, opacity }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <p style={{ color: COLORS.textPrimary, fontSize: 12, fontWeight: 600, margin: 0 }}>{card.customer.name}</p>
        <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: priorityColor, marginTop: 3 }} />
      </div>
      <p style={{ color: COLORS.textMuted, fontSize: 10, lineHeight: 1.4, margin: 0, marginBottom: 5 }}>{card.message.substring(0, 70)}...</p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: COLORS.brand, fontSize: 10, fontWeight: 500 }}>{Math.round(card.confidence * 100)}% confianza</span>
        <span style={{ color: COLORS.textMuted, fontSize: 9 }}>📋 Copiar</span>
      </div>
    </div>
  );
}

function DragAnimation() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < S4[0] + 20 || frame > S4[1] - 20) return null;
  const localFrame = frame - S4[0] - 20;
  const progress = spring({ frame: localFrame, fps, config: { damping: 20, stiffness: 60, mass: 0.8 }, durationInFrames: 80 });
  const x = interpolate(progress, [0, 1], [0, 185]);
  const y = interpolate(progress, [0, 0.5, 1], [0, -20, 0]);
  const fadeOpacity = interpolate(localFrame, [0, 5, 75, 80], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{ position: "absolute", left: 42 + x, top: 155, width: 165, zIndex: 25, transform: `translateY(${y}px) rotate(-2deg) scale(1.03)`, opacity: fadeOpacity }}>
      <div style={{ backgroundColor: "rgba(129, 181, 161, 0.1)", border: "1px solid rgba(129, 181, 161, 0.3)", borderRadius: 10, padding: 10, boxShadow: "0 12px 32px rgba(0,0,0,0.4)" }}>
        <p style={{ color: COLORS.textPrimary, fontSize: 12, fontWeight: 600, margin: 0 }}>TechStore Buenos Aires</p>
        <p style={{ color: COLORS.textMuted, fontSize: 10, margin: 0, marginTop: 3 }}>Cross-sell: Soportes MagSafe...</p>
      </div>
    </div>
  );
}

function FollowupBanner() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame - S6[0], [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ backgroundColor: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.2)", borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8, opacity, marginBottom: 10 }}>
      <span style={{ fontSize: 12 }}>🔔</span>
      <p style={{ color: "#f59e0b", fontSize: 12, margin: 0 }}>3 seguimientos pendientes para hoy</p>
    </div>
  );
}

export default function PipelineComposition() {
  const frame = useCurrentFrame();
  const scene = getActiveScene(frame);
  const cardsByStage = mockPipelineStages.map((stage) => ({ ...stage, cards: mockPipelineCards.filter((c) => c.stage === stage.id) }));
  const showFollowup = frame >= S6[0];

  return (
    <AbsoluteFill style={BASE_COMPOSITION_STYLE}>
      <div style={{ padding: "20px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ color: COLORS.textPrimary, fontSize: 20, fontWeight: 600, margin: 0 }}>Pipeline</h2>
          <span style={{ color: COLORS.textMuted, fontSize: 13 }}>7 contactos totales</span>
        </div>

        {showFollowup && (
          <FocusWrapper highlightStart={S6[0]} highlightDuration={S6[1] - S6[0]} activeScene={scene} sceneRange={S6}>
            <FollowupBanner />
          </FocusWrapper>
        )}

        <FocusWrapper highlightStart={S1[0]} highlightDuration={S1[1] - S1[0]} activeScene={scene} sceneRange={S1} dimWhenInactive={false}>
          <div style={{ display: "flex", gap: 8, height: showFollowup ? 460 : 500 }}>
            {cardsByStage.map((stage, i) => {
              const isFirstCol = i === 0;
              const isLastCol = i === cardsByStage.length - 1;
              return (
                <FocusWrapper
                  key={stage.id}
                  highlightStart={isFirstCol ? S2[0] : isLastCol ? S5[0] : -1}
                  highlightDuration={isFirstCol ? S2[1] - S2[0] : isLastCol ? S5[1] - S5[0] : 0}
                  activeScene={scene}
                  sceneRange={isFirstCol ? S2 : isLastCol ? S5 : [0, 0]}
                  dimWhenInactive={isFirstCol || isLastCol}
                >
                  <div style={{ flex: 1, backgroundColor: "rgba(255, 255, 255, 0.015)", borderRadius: 10, padding: 8, display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <ColumnHeader label={stage.label} count={stage.cards.length} index={i} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                      {stage.cards.map((card, ci) => {
                        const isTargetCard = card.id === "pl1";
                        return (
                          <FocusWrapper
                            key={card.id}
                            highlightStart={isTargetCard ? S3[0] : -1}
                            highlightDuration={isTargetCard ? S3[1] - S3[0] : 0}
                            activeScene={scene}
                            sceneRange={isTargetCard ? S3 : [0, 0]}
                            dimWhenInactive={isTargetCard}
                          >
                            <PipelineCard card={card} cardIndex={i * 2 + ci} />
                          </FocusWrapper>
                        );
                      })}
                    </div>
                  </div>
                </FocusWrapper>
              );
            })}
          </div>
        </FocusWrapper>
      </div>

      <DragAnimation />

      <TextOverlay text="Este es tu tablero de ventas. Cada columna es una etapa: desde 'A contactar' hasta 'Vendido'. Las tarjetas se mueven de izquierda a derecha a medida que avanzas con cada cliente." startFrame={S1[0] + 5} duration={140} position="bottom" fontSize={22} />
      <TextOverlay text="Aca aparecen los clientes que PymePilot te recomienda contactar. El sistema los analizo automaticamente y te dice por que conviene hablarles ahora." startFrame={S2[0] + 5} duration={160} position="bottom" fontSize={24} />
      <TextOverlay text="Cada tarjeta incluye: el nombre del cliente, un mensaje sugerido que podes copiar con un click, el nivel de confianza de la recomendacion, y la prioridad (punto rojo = urgente)." startFrame={S3[0] + 5} duration={140} position="bottom" fontSize={22} />
      <TextOverlay text="Para avanzar un cliente, lo arrastras a la siguiente columna. El sistema registra el movimiento y programa seguimientos automaticos segun la etapa." startFrame={S4[0] + 5} duration={140} position="bottom" fontSize={24} />
      <TextOverlay text="Cuando cerras una venta, la tarjeta llega a 'Vendido'. Se registra como logro en tu historial y se atribuye a la recomendacion de PymePilot." startFrame={S5[0] + 5} duration={140} position="bottom" fontSize={24} />
      <TextOverlay text="El sistema programa seguimientos automaticos. Si un cliente esta en 'En seguimiento', te avisa cuando es momento de volver a contactarlo." startFrame={S6[0] + 5} duration={110} position="bottom" fontSize={24} />
      <TextOverlay text="Pipeline es donde trabjas todos los dias — tu flujo de ventas de principio a fin." startFrame={960} duration={70} position="center" fontSize={26} />
    </AbsoluteFill>
  );
}
