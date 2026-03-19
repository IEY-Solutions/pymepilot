import { useCurrentFrame, interpolate } from "remotion";

type FocusWrapperProps = {
  children: React.ReactNode;
  /** Frame donde empieza el highlight */
  highlightStart: number;
  /** Duracion del highlight en frames */
  highlightDuration: number;
  /** Si se atenua cuando NO esta highlighted (default true) */
  dimWhenInactive?: boolean;
  /** Frame global actual del "scene" activo — si se pasa, atenua cuando otra escena esta activa */
  activeScene?: number;
  /** Rango de escenas [inicio, fin] durante las cuales este wrapper esta activo */
  sceneRange?: readonly [number, number];
};

/**
 * Envuelve un componente y le agrega efecto de highlight inline.
 * Cuando esta activo: borde brillante teal + glow.
 * Cuando otra escena esta activa: se atenua (opacity baja).
 * Elimina la necesidad de coordenadas absolutas.
 */
export function FocusWrapper({
  children,
  highlightStart,
  highlightDuration,
  dimWhenInactive = true,
  activeScene,
  sceneRange,
}: FocusWrapperProps) {
  const frame = useCurrentFrame();
  const highlightEnd = highlightStart + highlightDuration;

  const isHighlighted = frame >= highlightStart && frame <= highlightEnd;

  // Calcular si hay alguna escena activa que NO es la nuestra
  let isOtherSceneActive = false;
  if (dimWhenInactive && activeScene !== undefined && sceneRange) {
    const isOurScene = frame >= sceneRange[0] && frame <= sceneRange[1];
    isOtherSceneActive = activeScene > 0 && !isOurScene && !isHighlighted;
  }

  // Opacity del contenido
  const dimOpacity = isOtherSceneActive ? 0.3 : 1;

  // Animacion del borde highlight
  const borderOpacity = isHighlighted
    ? interpolate(
        frame - highlightStart,
        [0, 10, highlightDuration - 10, highlightDuration],
        [0, 1, 1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      )
    : 0;

  // Pulso sutil del glow
  const glowIntensity = isHighlighted
    ? interpolate(
        Math.sin(((frame - highlightStart) / 15) * Math.PI),
        [-1, 1],
        [8, 16]
      )
    : 0;

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 12,
        opacity: dimOpacity,
        transition: "opacity 0.3s ease",
      }}
    >
      {/* Borde highlight animado */}
      {borderOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            inset: -3,
            borderRadius: 14,
            border: `2px solid rgba(129, 181, 161, ${borderOpacity * 0.8})`,
            boxShadow: `0 0 ${glowIntensity}px rgba(129, 181, 161, ${borderOpacity * 0.3})`,
            pointerEvents: "none",
            zIndex: 10,
          }}
        />
      )}
      {children}
    </div>
  );
}
