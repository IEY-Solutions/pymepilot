import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

type CursorProps = {
  /** Secuencia de posiciones [x, y] que el cursor recorre */
  path: Array<{ x: number; y: number; frame: number }>;
  /** Frame donde empieza el movimiento */
  startFrame: number;
  /** Si muestra efecto de "click" en cada parada */
  showClick?: boolean;
};

/**
 * Cursor falso animado que simula un mouse moviendose.
 * Se mueve entre posiciones con spring() para movimiento natural.
 */
export function AnimatedCursor({
  path,
  startFrame,
  showClick = true,
}: CursorProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (path.length === 0) return null;

  // No mostrar antes del inicio
  if (frame < startFrame) return null;

  const localFrame = frame - startFrame;

  // Encontrar entre que dos puntos estamos
  let currentX = path[0].x;
  let currentY = path[0].y;
  let isAtStop = false;

  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to = path[i + 1];

    if (localFrame >= from.frame && localFrame <= to.frame) {
      const progress = spring({
        frame: localFrame - from.frame,
        fps,
        config: {
          damping: 20,
          stiffness: 100,
          mass: 0.5,
        },
        durationInFrames: to.frame - from.frame,
      });

      currentX = interpolate(progress, [0, 1], [from.x, to.x]);
      currentY = interpolate(progress, [0, 1], [from.y, to.y]);
      break;
    } else if (localFrame > to.frame) {
      currentX = to.x;
      currentY = to.y;

      // Detectar si estamos "parados" en un punto (para efecto click)
      const nextPoint = path[i + 2];
      if (nextPoint && localFrame < nextPoint.frame) {
        isAtStop = true;
      }
    }
  }

  // Si pasamos todos los puntos, quedamos en el ultimo
  const lastPoint = path[path.length - 1];
  if (localFrame > lastPoint.frame) {
    currentX = lastPoint.x;
    currentY = lastPoint.y;
  }

  // Efecto click: circulo que se expande y desaparece
  const clickScale = isAtStop && showClick
    ? interpolate(
        (localFrame % 30),
        [0, 8, 15],
        [0, 1, 0],
        { extrapolateRight: "clamp" }
      )
    : 0;

  // Fade in del cursor
  const cursorOpacity = interpolate(
    localFrame,
    [0, 10],
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  return (
    <div
      style={{
        position: "absolute",
        left: currentX,
        top: currentY,
        zIndex: 30,
        opacity: cursorOpacity,
        pointerEvents: "none",
      }}
    >
      {/* Click ripple */}
      {clickScale > 0 && (
        <div
          style={{
            position: "absolute",
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "2px solid rgba(129, 181, 161, 0.6)",
            transform: `translate(-50%, -50%) scale(${clickScale})`,
            opacity: 1 - clickScale,
          }}
        />
      )}

      {/* Cursor arrow SVG */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }}
      >
        <path
          d="M5 3L19 12L12 13L9 20L5 3Z"
          fill="white"
          stroke="rgba(0,0,0,0.3)"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}
