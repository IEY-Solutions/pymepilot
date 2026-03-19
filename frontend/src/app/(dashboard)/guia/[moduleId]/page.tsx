"use client";

import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getModuleById } from "@/lib/guide-modules";
import { SectionBlock } from "@/components/guide/section-block";

export default function GuiaModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const module = getModuleById(moduleId);

  if (!module || !module.available) {
    notFound();
  }

  const Icon = module.icon;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Volver a modulos */}
      <Link
        href="/guia"
        className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/60 transition-colors mb-8"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver a modulos
      </Link>

      {/* Hero */}
      <div className="text-center mb-16">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#81b5a1]/10 mx-auto mb-4">
          <Icon className="h-7 w-7 text-[#81b5a1]" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">
          Modulo {module.name}
        </h1>
        <p className="text-white/50 max-w-lg mx-auto">
          {module.description}
        </p>
      </div>

      {/* Secciones video + texto */}
      <div className="space-y-20 lg:space-y-28">
        {module.sections.map((section, index) => (
          <SectionBlock
            key={section.id}
            section={section}
            index={index}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="text-center mt-20 pb-8">
        <p className="text-white/40 text-sm mb-4">
          ¿Listo para empezar?
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-[#81b5a1] px-6 py-2.5 text-sm font-medium text-[#1a2a2c] hover:bg-[#81b5a1]/90 transition-colors"
        >
          Ir al Dashboard
        </Link>
      </div>
    </div>
  );
}
