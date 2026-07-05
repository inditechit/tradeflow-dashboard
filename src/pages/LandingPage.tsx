import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useVerifiedSession } from "@/hooks/useVerifiedSession";
import { useApp } from "@/context/AppContext";
import { captureReferralKeyFromUrl, usePackages } from "@/hooks/usePackages";
import { Reveal } from "@/components/landing/Reveal";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  BarChart3,
  Check,
  Clock,
  Layers,
  Lock,
  Mail,
  MessageSquare,
  Shield,
  Target,
  Timer,
  TrendingUp,
  Unlock,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveEmployeeLandingPath } from "@/utils/employeeExploreMode";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  TRIAL_WITHDRAW_NOTICE,
  WITHDRAW_USP,
  CONTACT_EMAIL,
} from "@/constants/packages";
import { PackagePriceDisplay } from "@/components/packages/PackagePriceDisplay";

const BRAND = "Copy Trade Engine";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="group relative py-1 transition-colors duration-300 hover:text-slate-900"
    >
      {children}
      <span className="absolute -bottom-0.5 left-0 h-0.5 w-0 rounded-full bg-[#FFD700] transition-all duration-300 ease-out group-hover:w-full" />
    </a>
  );
}

function HeroGlow() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.08) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] animate-float rounded-full bg-[#FFD700]/25 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 animate-float-slow rounded-full bg-emerald-400/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 h-56 w-56 animate-float rounded-full bg-yellow-300/20 blur-3xl [animation-delay:2s]" />
    </>
  );
}

const cardHover =
  "transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg hover:shadow-yellow-900/5 hover:border-yellow-200/60";

const KEY_FEATURES = [
  {
    title: "Trend & Trap Based Logic",
    text: "Built around market trend identification and trap zone detection.",
  },
  {
    title: "Risk-Based Configuration",
    text: "Select a risk level that matches your individual preferences.",
  },
  {
    title: "Smart Capital Allocation",
    text: "Divide available capital into multiple parts for structured exposure management.",
  },
  {
    title: "Automated Execution Support",
    text: "Reduce manual intervention by following predefined conditions.",
  },
  {
    title: "Gold (XAU/USD) Focused",
    text: "Optimized for analyzing and operating in the Gold market.",
  },
  {
    title: "Adaptive Market Approach",
    text: "Work across different market conditions using rule-based automation.",
  },
  {
    title: "User-Friendly Setup",
    text: "Simple onboarding, configuration, and ongoing support.",
  },
  {
    title: "Performance Updates",
    text: "Receive updates and information through designated communication channels.",
  },
  {
    title: "No Fixed Return Commitments",
    text: `${BRAND} is a software tool. Market risk remains at all times, and no profits or returns are guaranteed.`,
  },
];

const WITHDRAW_STEPS = [
  {
    step: "1",
    title: "Stop or let trades settle",
    text: "Close your copy exposure anytime. Equity = wallet + open P/L + pending closed credits.",
  },
  {
    step: "2",
    title: "Request withdrawal",
    text: "Enter amount (min $10), confirm your TRC20 address, and submit from the Withdraw page.",
  },
  {
    step: "3",
    title: "Admin approval",
    text: "Our team verifies balance and compliance. Paid-plan users get priority in the queue.",
  },
  {
    step: "4",
    title: "USDT in 5 sec – 1 min",
    text: "Once approved, outbound USDT is broadcast to Tron — typically within 5 seconds to 1 minute.",
  },
];

const FAQ = [
  {
    q: `What is ${BRAND}?`,
    a: `${BRAND} is an automation-based software solution designed to support market analysis and execution through predefined rules and risk management settings.`,
  },
  {
    q: "Is the 7-day trial really free?",
    a: "Yes. Activate once per account. You still fund your wallet to copy live trades, but the subscription itself costs $0.",
  },
  {
    q: "Why are trial withdrawals locked?",
    a: "During the free trial your capital stays locked for 7 days. You may stop trading anytime; withdrawal unlocks when the trial ends.",
  },
  {
    q: "How fast are withdrawals on paid plans?",
    a: WITHDRAW_USP.short,
  },
  {
    q: "Are returns guaranteed?",
    a: `No. ${BRAND} is a software tool. Market risk remains at all times, and no profits or returns are guaranteed.`,
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { isReady, role } = useVerifiedSession();
  const { currentUser } = useApp();
  const { packages: subscriptionPlans, loading: plansLoading, referralApplied, couponApplied } =
    usePackages(currentUser?.userId);

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactDone, setContactDone] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady || !role) return;
    if (role === "admin") {
      navigate("/admin/dashboard", { replace: true });
    } else if (role === "employee" && currentUser?.userId) {
      navigate(resolveEmployeeLandingPath(currentUser.userId, currentUser.employeePermissions ?? []), {
        replace: true,
      });
    } else {
      navigate("/user/dashboard", { replace: true });
    }
  }, [isReady, role, navigate, currentUser?.userId, currentUser?.employeePermissions]);

  useEffect(() => {
    captureReferralKeyFromUrl();
  }, []);

  const handleContact = (e: React.FormEvent) => {
    e.preventDefault();
    setContactError(null);
    setContactDone(null);

    if (!contactName.trim() || !contactEmail.trim() || !contactMessage.trim()) {
      setContactError("Name, email, and message are required.");
      return;
    }

    const subject =
      contactSubject.trim() ||
      `${BRAND} inquiry from ${contactName.trim()}`;
    const body = [
      `Name: ${contactName.trim()}`,
      `Email: ${contactEmail.trim()}`,
      contactPhone.trim() ? `Phone: ${contactPhone.trim()}` : null,
      "",
      contactMessage.trim(),
    ]
      .filter(Boolean)
      .join("\n");

    const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    setContactDone("Opening your email app — send the message to complete your inquiry.");
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-md animate-slide-down opacity-0">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            to="/"
            className="group flex items-center gap-2 font-bold text-slate-900 transition-transform duration-300 hover:scale-[1.02]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFD700] text-black shadow-sm transition-shadow duration-300 group-hover:animate-pulse-glow">
              <Zap className="h-5 w-5" />
            </span>
            <span className="text-lg tracking-tight">{BRAND}</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <NavLink href="#why">Why us</NavLink>
            <NavLink href="#features">Features</NavLink>
            <NavLink href="#usp">Fast withdraw</NavLink>
            <NavLink href="#plans">Plans</NavLink>
            <NavLink href="#faq">FAQ</NavLink>
            <NavLink href="#contact">Contact</NavLink>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" asChild className="text-slate-700 transition-transform hover:scale-105">
              <Link to="/login">Log in</Link>
            </Button>
            <Button
              asChild
              className="bg-[#FFD700] text-black shadow-md shadow-yellow-900/10 transition-all duration-300 hover:scale-105 hover:bg-[#E6C200] hover:shadow-lg"
            >
              <Link to="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-b from-yellow-50/90 via-white to-white px-4 py-16 sm:px-6 sm:py-28">
          <HeroGlow />
          <div className="relative mx-auto max-w-6xl">
            <div className="flex flex-wrap gap-3">
              <p
                className="inline-flex items-center gap-2 rounded-full border border-yellow-200 bg-[#FFF9E6] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-900 opacity-0 animate-fade-up shadow-sm"
                style={{ animationDelay: "0ms" }}
              >
                <BarChart3 className="h-4 w-4" />
                Automation-based trading software
              </p>
              <p
                className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-emerald-800 opacity-0 animate-fade-up shadow-sm"
                style={{ animationDelay: "120ms" }}
              >
                <Timer className="h-4 w-4 animate-pulse" />
                {WITHDRAW_USP.headline}
              </p>
            </div>
            <h1
              className="mt-6 max-w-4xl text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 opacity-0 animate-fade-up sm:text-5xl lg:text-6xl"
              style={{ animationDelay: "180ms" }}
            >
              Automated Market Analysis &{" "}
              <span className="bg-gradient-to-r from-yellow-700 via-[#FFD700] to-yellow-700 bg-[length:200%_auto] bg-clip-text text-transparent animate-shimmer">
                Execution Support
              </span>
            </h1>
            <p
              className="mt-4 max-w-3xl text-xl font-medium text-slate-700 opacity-0 animate-fade-up"
              style={{ animationDelay: "280ms" }}
            >
              Powered by Trend & Trap Logic, Risk-Based Settings, and Smart Capital Allocation.
            </p>
            <p
              className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-600 opacity-0 animate-fade-up"
              style={{ animationDelay: "380ms" }}
            >
              {BRAND} is designed to help users automate their market execution process through
              intelligent risk settings, structured capital allocation, and rule-based automation —
              while maintaining full awareness of market risk.
            </p>
            <div
              className="mt-10 flex flex-wrap gap-4 opacity-0 animate-fade-up"
              style={{ animationDelay: "480ms" }}
            >
              <Button
                size="lg"
                asChild
                className="group bg-[#FFD700] text-black shadow-lg shadow-yellow-900/15 transition-all duration-300 hover:scale-105 hover:bg-[#E6C200] hover:shadow-xl"
              >
                <Link to="/signup">
                  Start free 7-day trial
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="transition-all duration-300 hover:scale-105 hover:border-yellow-300 hover:bg-yellow-50/50"
              >
                <a href="#features">Explore features</a>
              </Button>
            </div>
          </div>
        </section>

        {/* Stats strip */}
        <section className="border-b border-slate-100 bg-slate-900 px-4 py-10 text-white sm:px-6">
          <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { value: "5 sec–1 min", label: "USDT payout after approval" },
              { value: "7 days", label: "Free trial to test the platform" },
              { value: "XAU/USD", label: "Gold-focused automation" },
              { value: "24/7", label: "Live trade sync & dashboard" },
            ].map((s, i) => (
              <Reveal key={s.label} delay={i * 90}>
                <div className="text-center sm:text-left">
                  <p className="text-3xl font-extrabold text-[#FFD700]">{s.value}</p>
                  <p className="mt-1 text-sm text-slate-300">{s.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Why Choose */}
        <section id="why" className="border-b border-slate-100 px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
                Why Choose {BRAND}?
              </h2>
              <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-600">
                {BRAND} is an automation-based software solution designed to support market analysis
                and execution through predefined rules and risk management settings.
              </p>
            </Reveal>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              {[
                {
                  icon: Target,
                  title: "Rule-based automation",
                  text: "Predefined conditions drive analysis and execution — less guesswork, more structure.",
                },
                {
                  icon: Layers,
                  title: "Structured capital",
                  text: "Smart allocation splits exposure so you stay in control of risk per segment.",
                },
                {
                  icon: TrendingUp,
                  title: "XAU/USD focus",
                  text: "Built and optimized for Gold market analysis and copy-trade execution.",
                },
              ].map((card, i) => {
                const Icon = card.icon;
                return (
                  <Reveal key={card.title} delay={i * 100}>
                    <div className={cn("rounded-2xl border border-slate-100 bg-slate-50 p-6", cardHover)}>
                      <Icon className="mb-3 h-8 w-8 text-yellow-700 transition-transform duration-300 group-hover:scale-110" />
                      <h3 className="font-semibold text-slate-900">{card.title}</h3>
                      <p className="mt-2 text-sm text-slate-600">{card.text}</p>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* Key Features */}
        <section id="features" className="border-b border-slate-100 bg-slate-50 px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <h2 className="text-3xl font-bold text-slate-900">Key Features</h2>
              <p className="mt-3 max-w-2xl text-slate-600">
                Everything you need to analyze, allocate, and execute with confidence — on one platform.
              </p>
            </Reveal>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {KEY_FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={(i % 3) * 80 + Math.floor(i / 3) * 40} as="li">
                  <div
                    className={cn(
                      "group flex h-full gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm",
                      cardHover,
                    )}
                  >
                    <Check
                      className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 transition-transform duration-300 group-hover:scale-125"
                      strokeWidth={3}
                      aria-hidden
                    />
                    <div>
                      <h3 className="font-semibold text-slate-900">{f.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{f.text}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </ul>
            <Reveal delay={200}>
              <div className="mt-10 flex gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-5 py-4 text-sm text-amber-950">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />
                <p>
                  <strong className="font-semibold">Risk disclosure:</strong> {BRAND} is a software
                  tool. Trading involves substantial risk. No profits or returns are guaranteed.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Fast withdraw USP */}
        <section id="usp" className="relative overflow-hidden border-b border-slate-100 px-4 py-16 sm:px-6 sm:py-20">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-yellow-50/50 via-transparent to-emerald-50/30 animate-gradient-shift bg-[length:200%_200%]" />
          <div className="relative mx-auto max-w-6xl">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
              <Reveal direction="left">
                <p className="text-sm font-bold uppercase tracking-wider text-yellow-700">Our USP</p>
                <h2 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
                  {WITHDRAW_USP.headline}
                </h2>
                <p className="mt-4 text-lg text-slate-600">{WITHDRAW_USP.detail}</p>
                <ul className="mt-6 space-y-3">
                  {WITHDRAW_STEPS.map((item, i) => (
                    <Reveal key={item.step} delay={i * 80} direction="left">
                      <li className="flex gap-3 text-sm text-slate-700">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FFD700] text-xs font-bold text-black shadow-sm transition-transform duration-300 hover:scale-110">
                          {item.step}
                        </span>
                        <div>
                          <span className="font-semibold text-slate-900">{item.title}</span>
                          <span className="text-slate-600"> — {item.text}</span>
                        </div>
                      </li>
                    </Reveal>
                  ))}
                </ul>
              </Reveal>
              <Reveal direction="right" delay={150}>
                <div
                  className={cn(
                    "rounded-2xl border border-yellow-200 bg-gradient-to-br from-yellow-50 to-white p-8 shadow-lg shadow-yellow-900/5",
                    cardHover,
                  )}
                >
                  <div className="flex items-center gap-3 text-emerald-700">
                    <Unlock className="h-8 w-8 animate-float" />
                    <div>
                      <p className="font-bold text-slate-900">Paid plans</p>
                      <p className="text-sm text-slate-600">{WITHDRAW_USP.short}</p>
                    </div>
                  </div>
                  <div className="my-6 border-t border-yellow-100" />
                  <div className="flex items-center gap-3 text-amber-800">
                    <Lock className="h-8 w-8" />
                    <div>
                      <p className="font-bold text-slate-900">Free trial</p>
                      <p className="text-sm text-slate-600">{TRIAL_WITHDRAW_NOTICE}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="bg-white px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <h2 className="text-center text-3xl font-bold text-slate-900">How it works</h2>
              <p className="mx-auto mt-3 max-w-xl text-center text-slate-600">
                From signup to automated execution — three simple steps.
              </p>
            </Reveal>
            <ol className="mt-12 grid gap-8 md:grid-cols-3">
              {[
                {
                  step: "1",
                  title: "Create & configure",
                  text: "Sign up, choose your risk profile, and fund your wallet.",
                },
                {
                  step: "2",
                  title: "Activate a plan",
                  text: "Start the free 7-day trial or pick a paid pack for full access and fast withdrawals.",
                },
                {
                  step: "3",
                  title: "Automate & track",
                  text: "Trades sync to your dashboard. Stop anytime. Withdraw USDT in 5 sec–1 min after approval (paid plans).",
                },
              ].map((item, i) => (
                <Reveal key={item.step} delay={i * 120} as="li">
                  <div
                    className={cn(
                      "relative rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center shadow-sm",
                      cardHover,
                    )}
                  >
                    <span className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#FFD700] text-sm font-bold text-black shadow-md transition-transform duration-300 hover:rotate-6 hover:scale-110">
                      {item.step}
                    </span>
                    <h3 className="font-semibold text-slate-900">{item.title}</h3>
                    <p className="mt-2 text-sm text-slate-600">{item.text}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* Plans */}
        <section id="plans" className="border-t border-slate-100 px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <div className="mb-12 text-center">
                <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">Subscription plans</h2>
                <p className="mx-auto mt-3 max-w-2xl text-slate-600">
                  Trial users: funds locked 7 days (stop trading allowed). Paid users:{" "}
                  <strong className="text-slate-800">{WITHDRAW_USP.headline}</strong> after approval.
                </p>
              </div>
            </Reveal>
            <div className="grid h-full gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {plansLoading ? (
                <p className="col-span-full text-center text-slate-500">Loading plans…</p>
              ) : null}
              {subscriptionPlans.map((plan, i) => (
                <Reveal key={plan.id} delay={i * 70}>
                  <div
                    className={cn(
                      "relative flex h-full flex-col rounded-2xl border bg-white p-6 shadow-sm",
                      cardHover,
                      plan.popular &&
                        "border-2 border-[#FFD700] shadow-lg shadow-yellow-900/10 lg:-translate-y-1",
                      plan.isTrial && "border-2 border-emerald-300 shadow-md",
                      !plan.popular && !plan.isTrial && "border-slate-200",
                    )}
                  >
                  {plan.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#FFD700] px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-black">
                      Most popular
                    </span>
                  )}
                  {plan.isTrial && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-500 px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                      Free trial
                    </span>
                  )}
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                    <div className="mt-4">
                      <PackagePriceDisplay
                        pkg={plan}
                        size="lg"
                        referralApplied={referralApplied}
                        couponApplied={couponApplied}
                      />
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">{plan.description}</p>
                    <ul className="mt-6 space-y-2.5">
                      {plan.features.slice(0, 5).map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-yellow-700" strokeWidth={3} />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Button
                    asChild
                    className={`mt-8 w-full ${
                      plan.popular
                        ? "bg-[#FFD700] text-black hover:bg-[#E6C200]"
                        : plan.isTrial
                          ? "bg-emerald-500 text-white hover:bg-emerald-600"
                          : "bg-slate-100 text-slate-900 hover:bg-slate-200"
                    }`}
                  >
                    <Link to="/signup">{plan.isTrial ? "Start free trial" : `Get ${plan.name}`}</Link>
                  </Button>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-slate-100 bg-slate-50 px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-3xl">
            <Reveal>
              <h2 className="text-center text-3xl font-bold text-slate-900">
                Frequently asked questions
              </h2>
            </Reveal>
            <dl className="mt-10 space-y-6">
              {FAQ.map((item, i) => (
                <Reveal key={item.q} delay={i * 80}>
                  <div className={cn("rounded-xl border border-slate-200 bg-white p-6", cardHover)}>
                    <dt className="font-semibold text-slate-900">{item.q}</dt>
                    <dd className="mt-2 text-sm leading-relaxed text-slate-600">{item.a}</dd>
                  </div>
                </Reveal>
              ))}
            </dl>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2">
            <Reveal direction="left">
              <p className="text-sm font-bold uppercase tracking-wider text-yellow-700">Contact</p>
              <h2 className="mt-2 text-3xl font-bold text-slate-900">Questions before you start?</h2>
              <p className="mt-4 text-slate-600">
                Ask about risk settings, plans, trial fund lock, withdrawals, or onboarding. We
                typically reply within one business day.
              </p>
              <ul className="mt-8 space-y-4 text-sm text-slate-700">
                {[
                  { icon: Clock, text: "Paid withdrawals processed in 5 seconds to 1 minute after approval" },
                  { icon: Mail, text: "Secure signup with email verification" },
                  { icon: MessageSquare, text: "In-app support tickets for active users" },
                  { icon: Shield, text: "No fixed return commitments — market risk always applies" },
                ].map(({ icon: Icon, text }, i) => (
                  <li key={text} className="flex items-center gap-3 opacity-0 animate-fade-up" style={{ animationDelay: `${400 + i * 100}ms` }}>
                    <Icon className="h-5 w-5 shrink-0 text-yellow-700" />
                    {text}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal direction="right" delay={120}>
            <form
              onSubmit={handleContact}
              className={cn(
                "rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-neutral-900/5 sm:p-8",
                cardHover,
              )}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="contact-name">Name *</Label>
                  <Input
                    id="contact-name"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-email">Email *</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    required
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-phone">Phone (optional)</Label>
                  <Input
                    id="contact-phone"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+91 …"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="contact-subject">Subject</Label>
                  <Input
                    id="contact-subject"
                    value={contactSubject}
                    onChange={(e) => setContactSubject(e.target.value)}
                    placeholder="Trial, risk settings, withdrawals…"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="contact-message">Message *</Label>
                  <Textarea
                    id="contact-message"
                    required
                    rows={5}
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    placeholder="How can we help?"
                  />
                </div>
              </div>
              {contactDone && (
                <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {contactDone}
                </p>
              )}
              {contactError && (
                <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {contactError}
                </p>
              )}
              <Button
                type="submit"
                className="mt-6 w-full bg-[#FFD700] text-black transition-all duration-300 hover:scale-[1.02] hover:bg-[#E6C200] hover:shadow-lg"
              >
                Send via email
              </Button>
              <p className="mt-3 text-center text-xs text-slate-500">
                Opens your email app to {CONTACT_EMAIL} — no server upload required.
              </p>
            </form>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50 px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm font-semibold text-slate-800">{BRAND}</p>
            <p className="max-w-md text-center text-xs text-slate-500 sm:text-left">
              © {new Date().getFullYear()} {BRAND}. Market risk applies. No guaranteed returns.{" "}
              {WITHDRAW_USP.headline} on paid plans.
            </p>
            <div className="flex gap-6 text-sm text-slate-600">
              <Link to="/login" className="hover:text-slate-900">Log in</Link>
              <Link to="/signup" className="hover:text-slate-900">Sign up</Link>
            </div>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-slate-200 pt-6 text-xs text-slate-500">
            <Link to="/privacy-policy" className="hover:text-slate-900">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-slate-900">Terms &amp; Conditions</Link>
            <Link to="/refund-policy" className="hover:text-slate-900">Refund Policy</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
