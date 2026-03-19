import { useCurrentFrame, interpolate } from "remotion";

type TextOverlayProps = {
  /** Texto a mostrar */
  text: string;
  /** Frame en que aparece */
  startFrame: number;
  /** Duracion en frames (default 90 = 3s) */
  duration?: number;
  /** Posicion vertical: "top", "center", "bottom" */
  position?: "top" | "center" | "bottom";
  /** Tamano del texto */
  fontSize?: number;
};

/**
 * Subtitulo animado con fondo semi-transparente.
 * Fade in al inicio, fade out al final.
 */
export function TextOverlay({
  text,
  startFrame,
  duration = 90,
  position = "bottom",
  fontSize = 28,
}: TextOverlayProps) {
  const frame = useCurrentFrame();
  const endFrame = startFrame + duration;

  // No renderizar fuera del rango
  if (frame < startFrame || frame > endFrame) return null;

  const localFrame = frame - startFrame;

  // Fade in durante 15 frames (0.5s), fade out durante 15 frames
  const opacity = interpolate(
    localFrame,
    [0, 15, duration - 15, duration],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Slide up sutil al aparecer
  const translateY = interpolate(
    localFrame,
    [0, 15],
    [10, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const positionStyle: Record<string, string | number> = {
    top: position === "top" ? 40 : position === "center" ? "50%" : "auto",
    bottom: position === "bottom" ? 40 : "auto",
    transform:
      position === "center"
        ? `translate(-50%, calc(-50% + ${translateY}px))`
        : `translateY(${translateY}px)`,
    left: position === "center" ? "50%" : 40,
    right: position === "center" ? "auto" : 40,
  };

  return (
    <div
      style={{
        position: "absolute",
        ...positionStyle,
        opacity,
        zIndex: 20,
      }}
    >
      <div
        style={{
          background: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(8px)",
          borderRadius: 12,
          padding: "12px 20px",
          maxWidth: 600,
        }}
      >
        <p
          style={{
            color: "white",
            fontSize,
            fontWeight: 500,
            lineHeight: 1.4,
            margin: 0,
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          {text}
        </p>
      </div>
    </div>
  );
}
