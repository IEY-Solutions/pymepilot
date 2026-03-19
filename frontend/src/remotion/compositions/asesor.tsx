import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { BASE_COMPOSITION_STYLE, COLORS } from "../styles";
import { TextOverlay } from "../components/text-overlay";
import { FocusWrapper } from "../components/focus-wrapper";
import { mockChatMessages } from "../data/mock-data";

/**
 * Escenas del video Asesor IA (total ~25s = 750 frames):
 *
 * 0-40:     Entrada
 * 40-150:   Escena 1 — Header: que es el asesor, contador de preguntas
 * 150-300:  Escena 2 — Primera pregunta + respuesta (typing animation)
 * 300-420:  Escena 3 — Explicacion de como funciona (consulta datos reales)
 * 420-570:  Escena 4 — Segunda pregunta + respuesta
 * 570-660:  Escena 5 — Input: como escribir preguntas
 * 660-750:  Cierre
 */

const S1 = [40, 150] as const;
const S2 = [150, 300] as const;
const S3 = [300, 420] as const;
const S4 = [420, 570] as const;
const S5 = [570, 660] as const;

function getActiveScene(frame: number): number {
  if (frame >= S1[0] && frame <= S1[1]) return 1;
  if (frame >= S2[0] && frame <= S2[1]) return 2;
  if (frame >= S3[0] && frame <= S3[1]) return 3;
  if (frame >= S4[0] && frame <= S4[1]) return 4;
  if (frame >= S5[0] && frame <= S5[1]) return 5;
  return 0;
}

function ChatHeader() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderBottom: `1px solid ${COLORS.border}`, opacity }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: "rgba(129, 181, 161, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
          🤖
        </div>
        <div>
          <p style={{ color: COLORS.textPrimary, fontSize: 15, fontWeight: 600, margin: 0 }}>PymePilot Asesor</p>
          <p style={{ color: COLORS.textMuted, fontSize: 12, margin: 0 }}>Preguntame sobre tu negocio</p>
        </div>
      </div>
      <p style={{ color: COLORS.textMuted, fontSize: 12, margin: 0 }}>2/20 preguntas hoy</p>
    </div>
  );
}

function ChatBubble({ role, content, appearFrame }: { role: "user" | "assistant"; content: string; appearFrame: number }) {
  const frame = useCurrentFrame();
  const localFrame = frame - appearFrame;
  if (localFrame < 0) return null;

  const opacity = interpolate(localFrame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const translateY = interpolate(localFrame, [0, 12], [15, 0], { extrapolateRight: "clamp" });
  const isUser = role === "user";

  const charsToShow = !isUser ? Math.min(content.length, Math.floor((localFrame - 10) * 3)) : content.length;

  if (!isUser && localFrame < 10) {
    return (
      <div style={{ display: "flex", justifyContent: "flex-start", opacity, transform: `translateY(${translateY}px)` }}>
        <div style={{ backgroundColor: "rgba(255, 255, 255, 0.06)", borderRadius: "16px 16px 16px 4px", padding: "10px 16px" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: COLORS.textMuted, opacity: interpolate(Math.sin(((frame + i * 8) / 10) * Math.PI), [-1, 1], [0.3, 1]) }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const displayContent = !isUser ? (charsToShow > 0 ? content.substring(0, charsToShow) : "") : content;

  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", opacity, transform: `translateY(${translateY}px)` }}>
      <div style={{ maxWidth: "75%", backgroundColor: isUser ? "rgba(129, 181, 161, 0.15)" : "rgba(255, 255, 255, 0.06)", borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding: "10px 16px" }}>
        <p style={{ color: COLORS.textPrimary, fontSize: 14, lineHeight: 1.5, margin: 0 }}>
          {displayContent}
          {!isUser && charsToShow < content.length && (
            <span style={{ opacity: interpolate(frame % 20, [0, 10, 20], [0, 1, 0]) }}>|</span>
          )}
        </p>
      </div>
    </div>
  );
}

function ChatInput() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame - 10, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{ padding: "12px 20px", borderTop: `1px solid ${COLORS.border}`, opacity }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "rgba(255, 255, 255, 0.04)", borderRadius: 12, padding: "10px 16px", border: `1px solid ${COLORS.border}` }}>
        <p style={{ color: COLORS.textMuted, fontSize: 14, margin: 0, flex: 1 }}>Escribi tu pregunta...</p>
        <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: COLORS.brand, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: COLORS.bgDark, fontSize: 16 }}>→</span>
        </div>
      </div>
    </div>
  );
}

export default function AsesorComposition() {
  const frame = useCurrentFrame();
  const scene = getActiveScene(frame);

  return (
    <AbsoluteFill style={BASE_COMPOSITION_STYLE}>
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <FocusWrapper highlightStart={S1[0]} highlightDuration={S1[1] - S1[0]} activeScene={scene} sceneRange={S1}>
          <ChatHeader />
        </FocusWrapper>

        <div style={{ flex: 1, padding: 20, display: "flex", flexDirection: "column", gap: 16, overflow: "hidden" }}>
          <FocusWrapper highlightStart={S2[0]} highlightDuration={S2[1] - S2[0]} activeScene={scene} sceneRange={S2}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <ChatBubble role={mockChatMessages[0].role} content={mockChatMessages[0].content} appearFrame={S2[0]} />
              <ChatBubble role={mockChatMessages[1].role} content={mockChatMessages[1].content} appearFrame={S2[0] + 20} />
            </div>
          </FocusWrapper>

          <FocusWrapper highlightStart={S4[0]} highlightDuration={S4[1] - S4[0]} activeScene={scene} sceneRange={S4}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <ChatBubble role={mockChatMessages[2].role} content={mockChatMessages[2].content} appearFrame={S4[0]} />
              <ChatBubble role={mockChatMessages[3].role} content={mockChatMessages[3].content} appearFrame={S4[0] + 20} />
            </div>
          </FocusWrapper>
        </div>

        <FocusWrapper highlightStart={S5[0]} highlightDuration={S5[1] - S5[0]} activeScene={scene} sceneRange={S5}>
          <ChatInput />
        </FocusWrapper>
      </div>

      <TextOverlay text="Este es tu asistente inteligente. Funciona como un chat: le escribis una pregunta y te responde con datos reales de tu negocio. Tenes 20 preguntas por dia incluidas." startFrame={S1[0] + 5} duration={100} position="bottom" fontSize={24} />
      <TextOverlay text="Mira como funciona: le preguntas 'Quien es mi mejor cliente?' y el asesor busca en tu base de datos para darte una respuesta precisa con numeros reales." startFrame={S2[0] + 5} duration={140} position="bottom" fontSize={24} />
      <TextOverlay text="Cada respuesta viene de tus datos reales, no es inventada. El asesor tiene acceso a tus clientes, productos, pedidos, predicciones y metricas." startFrame={S3[0] + 5} duration={110} position="bottom" fontSize={24} />
      <TextOverlay text="Podes hacer cualquier pregunta sobre tu negocio: mejores clientes, productos mas vendidos, tendencias, clientes inactivos, y mucho mas." startFrame={S4[0] + 5} duration={140} position="bottom" fontSize={24} />
      <TextOverlay text="Escribi tu pregunta aca abajo y toca enviar. Tambien podes acceder al asesor desde la burbuja de chat que aparece en cualquier pagina del dashboard." startFrame={S5[0] + 5} duration={80} position="bottom" fontSize={24} />
      <TextOverlay text="Tu asesor personal de negocios, disponible cuando lo necesites." startFrame={670} duration={70} position="center" fontSize={26} />
    </AbsoluteFill>
  );
}
