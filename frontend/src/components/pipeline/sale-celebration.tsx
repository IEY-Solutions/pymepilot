"use client";

import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { Trophy } from "lucide-react";
import { playCashRegisterSound } from "@/lib/sounds";

interface Props {
  customerName: string;
  onComplete: () => void;
}

/**
 * Overlay de celebracion cuando se cierra una venta.
 *
 * QUE HACE: Muestra una animacion centrada con confetti,
 * sonido de caja registradora, y un mensaje felicitatorio.
 * Se auto-cierra despues de 4 segundos.
 *
 * CONCEPTO - canvas-confetti: Libreria liviana que dispara
 * particulas de confetti en un canvas temporal. No afecta
 * el DOM ni el rendimiento despues de terminar.
 */
export function SaleCelebration({ customerName, onComplete }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Sonido de caja registradora
    playCashRegisterSound();

    // Confetti desde ambos lados
    const duration = 3000;
    const end = Date.now() + duration;

    function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors: ["#04a9ff", "#81b5a1", "#FFD700", "#FF6B6B"],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors: ["#04a9ff", "#81b5a1", "#FFD700", "#FF6B6B"],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }
    frame();

    // Auto-cerrar despues de 4 segundos
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete();
    }, 4000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 animate-in fade-in duration-300"
      onClick={() => {
        setVisible(false);
        onComplete();
      }}
    >
      <div className="bg-[#1a2a2c] border border-green-500/30 rounded-2xl p-8 max-w-sm mx-4 text-center space-y-4 animate-in zoom-in-95 duration-500 shadow-[0_0_60px_rgba(4,169,255,0.2)]">
        {/* Icono trofeo */}
        <div className="mx-auto w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
          <Trophy className="h-8 w-8 text-green-400" />
        </div>

        {/* Titulo */}
        <h2 className="text-xl font-bold text-white">
          Venta cerrada
        </h2>

        {/* Cliente */}
        <p className="text-sm text-[#04a9ff] font-medium">
          {customerName}
        </p>

        {/* Mensaje felicitatorio */}
        <p className="text-sm text-white/70 leading-relaxed">
          Excelente trabajo. Gracias a tu gestion y al seguimiento
          de PymePilot, cerraste otra operacion exitosa.
        </p>

        {/* Info del circuito */}
        <div className="bg-green-500/10 rounded-lg p-3 space-y-1">
          <p className="text-xs text-green-400 font-medium">
            El cliente ya entro en el circuito de reposicion
          </p>
          <p className="text-[11px] text-white/50">
            PymePilot te avisara cuando sea momento de contactarlo
            de nuevo y programara la secuencia de seguimiento
            para generar otra venta.
          </p>
        </div>

        {/* Hint para cerrar */}
        <p className="text-[10px] text-white/30">
          Toca para cerrar
        </p>
      </div>
    </div>
  );
}
