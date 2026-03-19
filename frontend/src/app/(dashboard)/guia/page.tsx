"use client";

import { BookOpen } from "lucide-react";
import { guideModules } from "@/lib/guide-modules";
import { ModuleCard } from "@/components/guide/module-card";

export default function GuiaPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <BookOpen className="h-6 w-6 text-[#81b5a1]" />
        <h1 className="text-xl font-semibold text-white">
          Guia de PymePilot
        </h1>
      </div>
      <p className="text-white/60 mb-8">
        Selecciona un modulo para aprender como funciona paso a paso.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {guideModules.map((module) => (
          <ModuleCard key={module.id} module={module} />
        ))}
      </div>
    </div>
  );
}
