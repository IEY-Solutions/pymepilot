import { AbsoluteFill, useCurrentFrame, interpolate, Sequence } from "remotion";
import { BASE_COMPOSITION_STYLE, COLORS } from "../styles";
import { TextOverlay } from "../components/text-overlay";
import { Highlight } from "../components/annotation";
import { AnimatedCursor } from "../components/cursor";
import { mockChatMessages } from "../data/mock-data";

// --- Sub-componentes visuales ---

function ChatHeader() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 20px",
        borderBottom: `1px solid ${COLORS.border}`,
        opacity,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            backgroundColor: "rgba(129, 181, 161, 0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
          }}
        >
          🤖
        </div>
        <div>
          <p style={{ color: COLORS.textPrimary, fontSize: 15, fontWeight: 600, margin: 0 }}>
            PymePilot Asesor
          </p>
          <p style={{ color: COLORS.textMuted, fontSize: 12, margin: 0 }}>
            Preguntame sobre tu negocio
          </p>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <p style={{ color: COLORS.textMuted, fontSize: 12, margin: 0 }}>
          2/20 preguntas hoy
        </p>
      </div>
    </div>
  );
}

function ChatBubble({
  role,
  content,
  appearFrame,
}: {
  role: "user" | "assistant";
  content: string;
  appearFrame: number;
}) {
  const frame = useCurrentFrame();
  const localFrame = frame - appearFrame;

  if (localFrame < 0) return null;

  const opacity = interpolate(localFrame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(localFrame, [0, 12], [15, 0], {
    extrapolateRight: "clamp",
  });

  const isUser = role === "user";

  // Para el asistente, simular "typing" caracter a caracter
  let displayContent = content;
  const charsToShow = !isUser
    ? Math.min(content.length, Math.floor((localFrame - 10) * 3))
    : content.length;

  if (!isUser) {
    displayContent = charsToShow > 0 ? content.substring(0, charsToShow) : "";

    // No mostrar nada durante los primeros frames (typing indicator)
    if (localFrame < 10) {
      return (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-start",
            opacity,
            transform: `translateY(${translateY}px)`,
          }}
        >
          <div
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.06)",
              borderRadius: "16px 16px 16px 4px",
              padding: "10px 16px",
            }}
          >
            <div style={{ display: "flex", gap: 4 }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor: COLORS.textMuted,
                    opacity: interpolate(
                      Math.sin(((frame + i * 8) / 10) * Math.PI),
                      [-1, 1],
                      [0.3, 1]
                    ),
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      );
    }
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <div
        style={{
          maxWidth: "75%",
          backgroundColor: isUser
            ? "rgba(129, 181, 161, 0.15)"
            : "rgba(255, 255, 255, 0.06)",
          borderRadius: isUser
            ? "16px 16px 4px 16px"
            : "16px 16px 16px 4px",
          padding: "10px 16px",
        }}
      >
        <p
          style={{
            color: COLORS.textPrimary,
            fontSize: 14,
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          {displayContent}
          {!isUser && charsToShow < content.length && (
            <span style={{ opacity: interpolate(frame % 20, [0, 10, 20], [0, 1, 0]) }}>
              |
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

function ChatInput() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame - 10, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        padding: "12px 20px",
        borderTop: `1px solid ${COLORS.border}`,
        opacity,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          backgroundColor: "rgba(255, 255, 255, 0.04)",
          borderRadius: 12,
          padding: "10px 16px",
          border: `1px solid ${COLORS.border}`,
        }}
      >
        <p style={{ color: COLORS.textMuted, fontSize: 14, margin: 0, flex: 1 }}>
          Escribi tu pregunta...
        </p>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: COLORS.brand,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ color: COLORS.bgDark, fontSize: 16 }}>→</span>
        </div>
      </div>
    </div>
  );
}

// --- Composicion principal ---

export default function AsesorComposition() {
  return (
    <AbsoluteFill style={BASE_COMPOSITION_STYLE}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        <ChatHeader />

        {/* Mensajes */}
        <div style={{ flex: 1, padding: 20, display: "flex", flexDirection: "column", gap: 16, overflow: "hidden" }}>
          {/* Mensaje 1: usuario pregunta */}
          <ChatBubble
            role={mockChatMessages[0].role}
            content={mockChatMessages[0].content}
            appearFrame={30}
          />

          {/* Mensaje 2: asistente responde */}
          <ChatBubble
            role={mockChatMessages[1].role}
            content={mockChatMessages[1].content}
            appearFrame={60}
          />

          {/* Mensaje 3: usuario pregunta de nuevo */}
          <ChatBubble
            role={mockChatMessages[2].role}
            content={mockChatMessages[2].content}
            appearFrame={350}
          />

          {/* Mensaje 4: asistente responde */}
          <ChatBubble
            role={mockChatMessages[3].role}
            content={mockChatMessages[3].content}
            appearFrame={380}
          />
        </div>

        <ChatInput />
      </div>

      {/* --- Anotaciones --- */}

      {/* Fase 1: Header con contador */}
      <Sequence from={5} durationInFrames={60}>
        <Highlight x={900} y={8} width={180} height={30} startFrame={0} duration={50} />
      </Sequence>
      <TextOverlay
        text="Tenes 20 preguntas por dia incluidas"
        startFrame={8}
        duration={50}
        position="center"
      />

      {/* Fase 2: Respuesta del asesor */}
      <TextOverlay
        text="El asesor consulta tus datos reales para responderte"
        startFrame={180}
        duration={80}
        position="bottom"
      />

      {/* Fase 3: Segunda pregunta */}
      <TextOverlay
        text="Podes preguntar lo que quieras sobre tu negocio"
        startFrame={500}
        duration={80}
        position="bottom"
      />

      {/* Cursor */}
      <AnimatedCursor
        startFrame={20}
        path={[
          { x: 640, y: 650, frame: 0 },
          { x: 950, y: 25, frame: 5 },
          { x: 640, y: 650, frame: 40 },
          { x: 800, y: 200, frame: 180 },
          { x: 640, y: 650, frame: 340 },
        ]}
        showClick
      />
    </AbsoluteFill>
  );
}
