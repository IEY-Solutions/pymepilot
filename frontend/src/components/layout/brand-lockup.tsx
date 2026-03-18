import Image from "next/image";

type BrandLockupProps = {
  variant?: "header" | "login";
};

export function BrandLockup({ variant = "header" }: BrandLockupProps) {
  const isLogin = variant === "login";

  return (
    <div
      className={`flex items-center ${isLogin ? "justify-center gap-4" : "gap-3"}`}
    >
      <div
        className={`flex items-center justify-center overflow-hidden rounded-2xl border border-[rgba(129,181,161,0.22)] bg-[linear-gradient(180deg,rgba(129,181,161,0.18),rgba(129,181,161,0.08))] shadow-[0_10px_30px_rgba(0,0,0,0.18)] ${
          isLogin ? "h-14 w-14" : "h-10 w-10"
        }`}
      >
        <Image
          src="/favicon.ico"
          alt="Logo de PymePilot"
          width={isLogin ? 36 : 24}
          height={isLogin ? 36 : 24}
          unoptimized
          className="h-auto w-auto"
        />
      </div>

      <div className={isLogin ? "text-left" : "text-left leading-none"}>
        <p
          className={`font-bold tracking-[-0.04em] text-[#81b5a1] ${
            isLogin ? "text-[2rem] sm:text-[2.3rem]" : "text-lg"
          }`}
        >
          PymePilot
        </p>
        {isLogin && (
          <p className="mt-1 text-sm uppercase tracking-[0.22em] text-white/38">
            Seguimiento inteligente
          </p>
        )}
      </div>
    </div>
  );
}
