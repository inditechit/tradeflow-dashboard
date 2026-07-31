import {
  Briefcase,
  Database,
  GitBranch,
  Layers,
  Shield,
  Target,
  Timer,
  TrendingUp,
  Wallet,
  Zap,
  BarChart3,
  Headphones,
  Clock,
  GraduationCap,
  Code2,
} from "lucide-react";
import { Reveal } from "@/components/landing/Reveal";
import { cn } from "@/lib/utils";

const PIPELINE = [
  { id: "signup", label: "SIGNUP", Icon: Zap, accent: false },
  { id: "risk", label: "RISK", Icon: Target, accent: true },
  { id: "fund", label: "FUND", Icon: Wallet, accent: false },
  { id: "copy", label: "COPY", Icon: GitBranch, accent: false },
  { id: "settle", label: "SETTLE", Icon: Layers, accent: false },
  { id: "safe", label: "SAFE", Icon: Shield, accent: false },
  { id: "withdraw", label: "PAYOUT", Icon: Timer, accent: false },
  { id: "live", label: "LIVE", Icon: TrendingUp, accent: false },
  { id: "ready", label: "READY", Icon: Briefcase, accent: true },
];

const STATS = [
  { Icon: Code2, value: "XAUUSD", label: "Gold-focused engine", highlight: false },
  { Icon: Headphones, value: "24/7", label: "Trade sync & dashboard", highlight: false },
  { Icon: Clock, value: "5s–1m", label: "$ after approval", highlight: false },
  { Icon: BarChart3, value: "2 wallets", label: "Trading + Safe split", highlight: true },
  { Icon: Briefcase, value: "Risk tiers", label: "Configurable exposure", highlight: false },
  { Icon: GraduationCap, value: "Full history", label: "Assignments & P/L", highlight: false },
];

function PipelineNode({
  label,
  Icon,
  accent,
}: {
  label: string;
  Icon: typeof Zap;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          "relative flex h-14 w-14 items-center justify-center rounded-full border-2 bg-[#0a1628]/80 shadow-lg backdrop-blur-sm",
          accent
            ? "border-[#FDE047] shadow-[0_0_24px_rgba(253,224,71,0.45)]"
            : "border-sky-400/70 shadow-[0_0_16px_rgba(56,189,248,0.25)]",
        )}
      >
        <Icon className={cn("h-6 w-6", accent ? "text-[#FDE047]" : "text-sky-300")} />
      </div>
      <span
        className={cn(
          "text-[10px] font-bold uppercase tracking-wider",
          accent ? "text-[#FDE047]" : "text-sky-100/90",
        )}
      >
        {label}
      </span>
    </div>
  );
}

function DashedConnector({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "hidden h-px flex-1 border-t-2 border-dashed border-sky-400/50 sm:block",
        className,
      )}
      aria-hidden
    />
  );
}

export function TradingControlRoom() {
  const topRow = PIPELINE.slice(0, 5);
  const bottomRow = PIPELINE.slice(5);

  return (
    <section id="pipeline" className="relative overflow-hidden border-b border-slate-900 bg-[#071428] px-4 py-16 sm:px-6 sm:py-20">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(56,189,248,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(56,189,248,0.08) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-yellow-400/10 blur-3xl" />

      {/* Floating deco icons */}
      <Database className="pointer-events-none absolute left-[8%] top-[18%] h-10 w-10 text-sky-400/20" />
      <Layers className="pointer-events-none absolute right-[12%] top-[22%] h-12 w-12 text-sky-400/15" />
      <Shield className="pointer-events-none absolute bottom-[28%] left-[15%] h-9 w-9 text-[#FDE047]/15" />

      <div className="relative mx-auto max-w-6xl">
        <Reveal>
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FDE047] text-sm font-black text-slate-900">
                  CT
                </span>
                <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">
                  Trading Pipeline Control Room
                </h2>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/50 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Engine system online
              </span>
            </div>

            {/* Pipeline — top row */}
            <div className="flex items-center justify-between gap-1 sm:gap-2">
              {topRow.map((node, i) => (
                <div key={node.id} className="flex flex-1 items-center">
                  <div className="mx-auto">
                    <PipelineNode label={node.label} Icon={node.Icon} accent={node.accent} />
                  </div>
                  {i < topRow.length - 1 ? <DashedConnector /> : null}
                </div>
              ))}
            </div>

            {/* Curve down on the right (visual) */}
            <div className="my-2 hidden justify-end pr-[8%] sm:flex" aria-hidden>
              <div className="h-8 w-px border-l-2 border-dashed border-sky-400/50" />
            </div>

            {/* Pipeline — bottom row (reversed flow visually LTR for readability) */}
            <div className="mt-4 flex items-center justify-between gap-1 sm:gap-2">
              {bottomRow.map((node, i) => (
                <div key={node.id} className="flex flex-1 items-center">
                  <div className="mx-auto">
                    <PipelineNode label={node.label} Icon={node.Icon} accent={node.accent} />
                  </div>
                  {i < bottomRow.length - 1 ? <DashedConnector /> : null}
                </div>
              ))}
            </div>

            {/* Stats grid */}
            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {STATS.map((s, i) => {
                const Icon = s.Icon;
                return (
                  <Reveal key={s.label} delay={i * 60}>
                    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#0a1628]/70 p-4 backdrop-blur-md transition hover:border-sky-400/40">
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-400/30 bg-sky-500/10 text-sky-300">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div>
                          <p
                            className={cn(
                              "text-2xl font-extrabold tracking-tight",
                              s.highlight ? "text-[#FDE047]" : "text-white",
                            )}
                          >
                            {s.value}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">{s.label}</p>
                        </div>
                      </div>
                      <span className="absolute bottom-2 right-3 h-0.5 w-8 rounded-full bg-[#FDE047]/80" />
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
