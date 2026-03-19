"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { GuideSection } from "@/lib/guide-modules";
import { VideoPlayer } from "./video-player";
import { compositionMap } from "@/remotion/compositions";

type SectionBlockProps = {
  section: GuideSection;
  /** Indice (0-based) para alternar layout zigzag */
  index: number;
};

/**
 * Bloque video + texto para la landing de un modulo.
 * Desktop: zigzag (impares video-izq, pares video-der).
 * Mobile: siempre video arriba, texto abajo.
 */
export function SectionBlock({ section, index }: SectionBlockProps) {
  const Icon = section.icon;
  const isEven = index % 2 === 0;

  const lazyComponent = compositionMap[section.id];

  const videoBlock = (
    <div className="w-full lg:w-[58%] flex-shrink-0">
      <VideoPlayer
        durationInFrames={section.videoDurationFrames}
        lazyComponent={lazyComponent}
      />
    </div>
  );

  const textBlock = (
    <div className="w-full lg:w-[42%] flex flex-col justify-center">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#81b5a1]/10">
          <Icon className="h-4 w-4 text-[#81b5a1]" />
        </div>
        <h3 className="text-lg font-semibold text-white">{section.title}</h3>
      </div>

      <p className="text-white/60 leading-relaxed mb-4">
        {section.description}
      </p>

      <ul className="space-y-2 mb-5">
        {section.bullets.map((bullet, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-sm text-white/50 leading-relaxed"
          >
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#81b5a1]/40 flex-shrink-0" />
            {bullet}
          </li>
        ))}
      </ul>

      <Link
        href={section.route}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#81b5a1] hover:text-[#81b5a1]/80 transition-colors"
      >
        Ir a {section.title}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );

  return (
    <section className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
      {/* Mobile: siempre video arriba. Desktop: zigzag */}
      <div className="contents lg:hidden">
        {videoBlock}
        {textBlock}
      </div>
      <div className="hidden lg:contents">
        {isEven ? (
          <>
            {videoBlock}
            {textBlock}
          </>
        ) : (
          <>
            {textBlock}
            {videoBlock}
          </>
        )}
      </div>
    </section>
  );
}
