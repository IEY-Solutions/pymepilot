import Image from "next/image";

type BrandLockupProps = {
  variant?: "header" | "login";
};

export function BrandLockup({ variant = "header" }: BrandLockupProps) {
  if (variant === "login") {
    return (
      <div className="flex flex-col items-center gap-3">
        <Image
          src="/favicon.ico"
          alt="Logo de PymePilot"
          width={44}
          height={44}
          unoptimized
        />
        <div className="text-center">
          <h1 className="text-[1.75rem] font-bold tracking-[-0.02em] text-[#81b5a1]">
            PymePilot
          </h1>
          <p className="mt-0.5 text-xs uppercase tracking-[0.18em] text-white/40">
            Seguimiento inteligente
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Image
        src="/favicon.ico"
        alt="Logo de PymePilot"
        width={22}
        height={22}
        unoptimized
      />
      <span className="text-base font-semibold tracking-[-0.01em] text-[#81b5a1]">
        PymePilot
      </span>
    </div>
  );
}
