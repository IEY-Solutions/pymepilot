"use client";

/**
 * Footer — "Powered by PymePilot" visible en todas las paginas.
 *
 * La marca PymePilot nunca desaparece, incluso cuando el tenant
 * tiene su propio logo y color. Este footer es el ancla de marca.
 */
export function Footer() {
  return (
    <footer className="hidden md:flex items-center justify-center py-2 border-t border-gray-100 bg-white">
      <span className="text-[10px] text-gray-400 tracking-wide">
        Powered by{" "}
        <span className="font-semibold text-gray-500">PymePilot</span>
      </span>
    </footer>
  );
}
