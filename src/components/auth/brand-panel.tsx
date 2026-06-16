import { HardHat } from "lucide-react";

// Minimal, quiet brand panel for auth screens — the firm's identity, not a
// product pitch. "Blueprint" backdrop: a dark field, a faint technical grid
// faded from the top, and a single soft glow behind the wordmark.
export function BrandPanel() {
  return (
    <aside className="relative hidden flex-col justify-between overflow-hidden bg-slate-950 p-10 text-white lg:flex xl:p-14">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "34px 34px",
          maskImage: "radial-gradient(130% 90% at 50% 0%, black 35%, transparent 100%)",
        }}
      />
      <div
        aria-hidden
        className="bg-primary/20 pointer-events-none absolute top-1/2 left-1/2 size-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[130px]"
      />

      {/* corner wordmark */}
      <div className="relative z-10 flex items-center gap-2.5">
        <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg shadow-lg">
          <HardHat className="size-4" />
        </span>
        <span className="text-sm font-semibold tracking-tight">MAQUIN</span>
      </div>

      {/* centered identity */}
      <div className="relative z-10 flex flex-col items-center text-center">
        <span className="mb-7 flex size-16 items-center justify-center rounded-2xl bg-white/5 text-sky-300 ring-1 ring-white/10">
          <HardHat className="size-8" />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-balance xl:text-4xl">
          MAQUIN Engineering Services
        </h1>
        <div className="bg-primary mx-auto mt-5 h-px w-12" />
        <p className="mt-5 text-sm tracking-wide text-white/50 uppercase">Operations Console</p>
      </div>

      {/* footer */}
      <div className="relative z-10 text-xs text-white/40">
        Internal use only · © 2026 MAQUIN Engineering Services
      </div>
    </aside>
  );
}
