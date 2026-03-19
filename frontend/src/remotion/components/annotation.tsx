import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

// --- Highlight Rectangle ---

type HighlightProps = {
  /** Posicion y tamano del area a resaltar */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Frame donde aparece */
  startFrame: number;
  /** Duracion en frames (default 60 = 2s) */
  duration?: number;
  /** Color del borde (default teal del brand) */
  color?: string;
};

/**
 * Rectangulo animado que resalta un area de la pantalla.
 * Aparece con spring y tiene un pulso sutil.
 */
export function Highlight({
  x,
  y,
  width,
  height,
  startFrame,
  duration = 60,
  color = "rgba(129, 181, 161, 0.8)",
}: HighlightProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const endFrame = startFrame + duration;

  if (frame < startFrame || frame > endFrame) return null;

  const localFrame = frame - startFrame;

  // Aparece con spring
  const scale = spring({
    frame: localFrame,
    fps,
    config: { damping: 15, stiffness: 120, mass: 0.8 },
    durationInFrames: 20,
  });

  // Fade out al final
  const opacity = interpolate(
    localFrame,
    [0, 10, duration - 10, duration],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Pulso sutil del borde
  const pulse = interpolate(
    Math.sin((localFrame / 15) * Math.PI),
    [-1, 1],
    [0.6, 1]
  );

  return (
    <div
      style={{
        position: "absolute",
        left: x - 4,
        top: y - 4,
        width: width + 8,
        height: height + 8,
        border: `2px solid ${color}`,
        borderRadius: 8,
        opacity: opacity * pulse,
        transform: `scale(${scale})`,
        transformOrigin: "center",
        boxShadow: `0 0 20px ${color.replace("0.8", "0.2")}`,
        zIndex: 15,
        pointerEvents: "none",
      }}
    />
  );
}

// --- Arrow ---

type ArrowProps = {
  /** Punto de inicio */
  fromX: number;
  fromY: number;
  /** Punto de fin (donde apunta la flecha) */
  toX: number;
  toY: number;
  /** Frame donde aparece */
  startFrame: number;
  /** Duracion en frames (default 60) */
  duration?: number;
  /** Color (default teal) */
  color?: string;
};

/**
 * Flecha SVG animada que se dibuja progresivamente.
 */
export function Arrow({
  fromX,
  fromY,
  toX,
  toY,
  startFrame,
  duration = 60,
  color = "rgba(129, 181, 161, 0.9)",
}: ArrowProps) {
  const frame = useCurrentFrame();
  const endFrame = startFrame + duration;

  if (frame < startFrame || frame > endFrame) return null;

  const localFrame = frame - startFrame;

  // Progreso del dibujo de la linea
  const drawProgress = interpolate(
    localFrame,
    [0, 20],
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  // Fade out
  const opacity = interpolate(
    localFrame,
    [0, 10, duration - 10, duration],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Calcular longitud de la linea
  const dx = toX - fromX;
  const dy = toY - fromY;
  const length = Math.sqrt(dx * dx + dy * dy);

  // Punto intermedio actual
  const currentToX = fromX + dx * drawProgress;
  const currentToY = fromY + dy * drawProgress;

  // Angulo de la flecha
  const angle = Math.atan2(dy, dx);
  const arrowSize = 10;

  return (
    <svg
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        zIndex: 15,
        pointerEvents: "none",
        opacity,
      }}
    >
      {/* Linea */}
      <line
        x1={fromX}
        y1={fromY}
        x2={currentToX}
        y2={currentToY}
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray={length}
        strokeDashoffset={length * (1 - drawProgress)}
      />

      {/* Punta de flecha (solo cuando la linea termino de dibujarse) */}
      {drawProgress > 0.9 && (
        <polygon
          points={`
            ${toX},${toY}
            ${toX - arrowSize * Math.cos(angle - 0.4)},${toY - arrowSize * Math.sin(angle - 0.4)}
            ${toX - arrowSize * Math.cos(angle + 0.4)},${toY - arrowSize * Math.sin(angle + 0.4)}
          `}
          fill={color}
          opacity={interpolate(drawProgress, [0.9, 1], [0, 1])}
        />
      )}
    </svg>
  );
}

// --- Zoom Effect ---

type ZoomProps = {
  /** Centro del zoom */
  centerX: number;
  centerY: number;
  /** Factor de zoom (default 1.5) */
  scale?: number;
  /** Frame donde empieza */
  startFrame: number;
  /** Duracion en frames */
  duration?: number;
  children: React.ReactNode;
};

/**
 * Efecto de zoom que agranda un area de la composicion.
 * Util para mostrar detalles pequeños.
 */
export function ZoomEffect({
  centerX,
  centerY,
  scale: targetScale = 1.5,
  startFrame,
  duration = 90,
  children,
}: ZoomProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const endFrame = startFrame + duration;

  if (frame < startFrame || frame > endFrame) {
    return <>{children}</>;
  }

  const localFrame = frame - startFrame;

  // Zoom in con spring
  const zoomIn = spring({
    frame: localFrame,
    fps,
    config: { damping: 20, stiffness: 80, mass: 0.6 },
    durationInFrames: 25,
  });

  // Zoom out al final
  const zoomOut = localFrame > duration - 25
    ? spring({
        frame: localFrame - (duration - 25),
        fps,
        config: { damping: 20, stiffness: 80, mass: 0.6 },
        durationInFrames: 25,
      })
    : 0;

  const currentScale = interpolate(
    zoomIn - zoomOut,
    [0, 1],
    [1, targetScale]
  );

  return (
    <div
      style={{
        transform: `scale(${currentScale})`,
        transformOrigin: `${centerX}px ${centerY}px`,
      }}
    >
      {children}
    </div>
  );
}
