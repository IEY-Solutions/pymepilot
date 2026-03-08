"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

/**
 * InfoTooltip — icono (i) que muestra un popover explicativo.
 *
 * Desktop: hover para ver, mouse-out para cerrar.
 * Mobile: tap para ver, tap afuera para cerrar.
 *
 * Usa un portal (createPortal) para renderizar el popover directamente
 * en el <body>, escapando de cualquier overflow-hidden de contenedores
 * padres. La posicion se calcula con getBoundingClientRect() + position:fixed.
 *
 * Uso: <InfoTooltip text="Explicacion corta del dato" />
 */

const TOOLTIP_WIDTH = 240; // px — ancho del popover
const TOOLTIP_GAP = 8; // px — espacio entre icono y popover
const EDGE_PADDING = 12; // px — margen minimo contra bordes de pantalla

export function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const iconRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; arrowLeft: number; above: boolean }>({
    top: 0,
    left: 0,
    arrowLeft: TOOLTIP_WIDTH / 2,
    above: true,
  });

  // Calcular posicion del tooltip respecto al icono
  const updatePosition = useCallback(() => {
    if (!iconRef.current) return;
    const rect = iconRef.current.getBoundingClientRect();
    const iconCenterX = rect.left + rect.width / 2;
    const iconTopY = rect.top;
    const iconBottomY = rect.bottom;

    // Intentar mostrar arriba; si no hay espacio, mostrar abajo
    const tooltipHeight = tooltipRef.current?.offsetHeight ?? 60;
    const above = iconTopY - tooltipHeight - TOOLTIP_GAP > 0;
    const top = above
      ? iconTopY - tooltipHeight - TOOLTIP_GAP
      : iconBottomY + TOOLTIP_GAP;

    // Centrar horizontalmente, pero no salirse de la pantalla
    let left = iconCenterX - TOOLTIP_WIDTH / 2;
    const maxLeft = window.innerWidth - TOOLTIP_WIDTH - EDGE_PADDING;
    if (left < EDGE_PADDING) left = EDGE_PADDING;
    if (left > maxLeft) left = maxLeft;

    // La flechita debe apuntar al centro del icono
    const arrowLeft = Math.max(12, Math.min(iconCenterX - left, TOOLTIP_WIDTH - 12));

    setPos({ top, left, arrowLeft, above });
  }, []);

  // Recalcular al abrir y al hacer scroll/resize
  useEffect(() => {
    if (!open) return;
    updatePosition();

    // Recalcular si el usuario scrollea o redimensiona
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  // Cerrar al tocar fuera (mobile)
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (
        iconRef.current &&
        !iconRef.current.contains(target) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [open]);

  return (
    <>
      <span
        ref={iconRef}
        className="inline-flex items-center ml-1 align-middle"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        role="button"
        aria-label="Mas informacion"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((prev) => !prev);
          }
        }}
      >
        <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-500 cursor-help shrink-0" />
      </span>

      {open &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: TOOLTIP_WIDTH,
              zIndex: 9999,
            }}
            className="px-3 py-2 text-xs text-gray-700 bg-white border border-gray-200 rounded-lg shadow-lg leading-relaxed"
            // Evitar que el hover sobre el tooltip lo cierre
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
          >
            {text}
            {/* Flechita apuntando al icono */}
            <span
              style={{ left: pos.arrowLeft }}
              className={`absolute ${
                pos.above
                  ? "top-full border-t-white"
                  : "bottom-full border-b-white"
              } -translate-x-1/2 border-4 border-transparent`}
            />
          </div>,
          document.body
        )}
    </>
  );
}
