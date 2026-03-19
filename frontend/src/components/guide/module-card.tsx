"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import type { GuideModule } from "@/lib/guide-modules";

export function ModuleCard({ module }: { module: GuideModule }) {
  const Icon = module.icon;

  if (!module.available) {
    return (
      <div className="relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 opacity-50 cursor-not-allowed">
        <div className="absolute top-3 right-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-white/40">
            <Lock className="h-3 w-3" />
            Proximamente
          </span>
        </div>
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.06]">
            <Icon className="h-5 w-5 text-white/30" />
          </div>
          <h3 className="text-lg font-semibold text-white/40">{module.name}</h3>
        </div>
        <p className="text-sm text-white/30 leading-relaxed">
          {module.description}
        </p>
      </div>
    );
  }

  return (
    <Link
      href={`/guia/${module.id}`}
      className="group rounded-xl border border-[rgba(129,181,161,0.15)] bg-white/[0.02] p-6 transition-all hover:border-[rgba(129,181,161,0.3)] hover:bg-white/[0.04]"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#81b5a1]/10 transition-colors group-hover:bg-[#81b5a1]/20">
          <Icon className="h-5 w-5 text-[#81b5a1]" />
        </div>
        <h3 className="text-lg font-semibold text-white group-hover:text-[#81b5a1] transition-colors">
          {module.name}
        </h3>
      </div>
      <p className="text-sm text-white/60 leading-relaxed">
        {module.description}
      </p>
      <div className="mt-4 text-sm font-medium text-[#81b5a1] opacity-0 group-hover:opacity-100 transition-opacity">
        Ver guia →
      </div>
    </Link>
  );
}
