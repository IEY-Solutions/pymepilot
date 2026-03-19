"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import type { ComponentType } from "react";

type VideoPlayerProps = {
  /** Duracion del video en frames */
  durationInFrames: number;
  /** Carga lazy del componente de Remotion */
  lazyComponent?: () => Promise<{ default: ComponentType<Record<string, unknown>> }>;
  /** Componente directo (alternativa a lazyComponent) */
  component?: ComponentType<Record<string, unknown>>;
};

/**
 * Wrapper del Player de Remotion con autoplay al entrar en viewport.
 * Usa IntersectionObserver para play/pause automatico.
 */
export function VideoPlayer({
  durationInFrames,
  lazyComponent,
  component,
}: VideoPlayerProps) {
  const playerRef = useRef<PlayerRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  // IntersectionObserver: detecta cuando el video entra/sale del viewport
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.4 } // 40% visible para activar
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Play/pause segun visibilidad
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    if (isVisible) {
      player.play();
    } else {
      player.pause();
    }
  }, [isVisible]);

  const lazyComponentCb = useCallback(() => {
    if (lazyComponent) return lazyComponent();
    return Promise.resolve({ default: component! });
  }, [lazyComponent, component]);

  // Placeholder mientras no hay componente de video
  if (!lazyComponent && !component) {
    return (
      <div
        ref={containerRef}
        className="aspect-video w-full rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center"
      >
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-[#81b5a1]/10 flex items-center justify-center mx-auto mb-3">
            <svg
              className="w-6 h-6 text-[#81b5a1]/40"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <p className="text-sm text-white/30">Video proximamente</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="aspect-video w-full rounded-xl overflow-hidden">
      <Player
        ref={playerRef}
        lazyComponent={lazyComponentCb}
        durationInFrames={durationInFrames}
        compositionWidth={1280}
        compositionHeight={720}
        fps={30}
        loop
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 12,
        }}
      />
    </div>
  );
}
