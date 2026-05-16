import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Check,
  Copy,
  Shield,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 99,
    description: "Begin copy trading with essential tools and a focused portfolio.",
    features: [
      "Mirror up to 2 strategies",
      "Live trade feed",
      "Wallet & transaction history",
      "Email support",
    ],
    popular: false,
  },
  {
    id: "growth",
    name: "Growth",
    price: 299,
    description: "Scale with more strategies, affiliate access, and priority sync.",
    features: [
      "Mirror up to 5 strategies",
      "Priority trade sync",
      "P/L & trade history",
      "Affiliate program",
      "Priority support",
    ],
    popular: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: 599,
    description: "Higher limits, allocation controls, and daily settlement reports.",
    features: [
      "Mirror up to 12 strategies",
      "Advanced allocation",
      "Daily settlement reports",
      "Withdrawal priority",
      "Account manager",
    ],
    popular: false,
  },
  {
    id: "elite",
    name: "Elite",
    price: 999,
    description: "Maximum capacity, custom allocation, and white-glove onboarding.",
    features: [
      "Unlimited strategy mirrors",
      "Custom volume allocation",
      "API-ready reporting",
      "24/7 priority support",
      "Onboarding call",
    ],
    popular: false,
  },
] as const;

const HIGHLIGHTS = [
  {
    icon: Copy,
    title: "Copy proven strategies",
    text: "Follow master trades automatically. Your share of volume and P/L is calculated for you.",
  },
  {
    icon: TrendingUp,
    title: "Live performance",
    text: "Track open positions, estimated P/L, and settled results in one dashboard.",
  },
  {
    icon: Wallet,
    title: "Secure wallet",
    text: "Recharge, withdraw, and view every movement with a clear ledger.",
  },
  {
    icon: Shield,
    title: "Built for trust",
    text: "Verification, support tickets, and transparent settlement when trades close.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 font-bold text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFD700] text-black">
              <Zap className="h-5 w-5" />
            </span>
            <span className="text-lg tracking-tight">Copy Trade Engine</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#about" className="hover:text-slate-900">About</a>
            <a href="#plans" className="hover:text-slate-900">Plans</a>
            <a href="#how-it-works" className="hover:text-slate-900">How it works</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" asChild className="text-slate-700">
              <Link to="/login">Log in</Link>
            </Button>
            <Button asChild className="bg-[#FFD700] text-black hover:bg-[#E6C200]">
              <Link to="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-b from-yellow-50/80 via-white to-white px-4 py-16 sm:px-6 sm:py-24">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#FFD700]/20 blur-3xl" />
          <div className="relative mx-auto max-w-6xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-yellow-200 bg-[#FFF9E6] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-900">
              <BarChart3 className="h-4 w-4" />
              Multi-user copy trading
            </p>
            <h1 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Mirror expert trades.{" "}
              <span className="text-yellow-700">Your share, your wallet.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-slate-600">
              Copy Trade Engine connects you to live strategies with proportional volume and
              profit allocation, a secure USD wallet, and a clear history of every trade.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Button size="lg" asChild className="bg-[#FFD700] text-black hover:bg-[#E6C200]">
                <Link to="/signup">
                  Start free setup
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#plans">View plans</a>
              </Button>
            </div>
          </div>
        </section>

        <section id="about" className="border-b border-slate-100 px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 max-w-2xl">
              <h2 className="text-3xl font-bold text-slate-900">Built for copy traders</h2>
              <p className="mt-3 text-slate-600">
                One platform to follow master positions, see only your allocation, and manage
                funds without juggling spreadsheets or third-party tools.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {HIGHLIGHTS.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm shadow-neutral-900/5 transition-shadow hover:shadow-md"
                  >
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-50 text-yellow-800">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold text-slate-900">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="bg-slate-50 px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-3xl font-bold text-slate-900">How it works</h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-slate-600">
              Three steps from signup to copying live trades.
            </p>
            <ol className="mt-12 grid gap-8 md:grid-cols-3">
              {[
                {
                  step: "1",
                  title: "Create your account",
                  text: "Sign up, verify your profile, and fund your wallet in USD.",
                },
                {
                  step: "2",
                  title: "Choose a plan",
                  text: "Pick a subscription that matches how many strategies you want to mirror.",
                },
                {
                  step: "3",
                  title: "Copy & track",
                  text: "Open trades sync to your dashboard. Settlements update your balance when positions close.",
                },
              ].map((item) => (
                <li
                  key={item.step}
                  className="relative rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"
                >
                  <span className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#FFD700] text-sm font-bold text-black">
                    {item.step}
                  </span>
                  <h3 className="font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{item.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="plans" className="px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">Subscription plans</h2>
              <p className="mx-auto mt-3 max-w-xl text-slate-600">
                Choose the tier that fits your copy-trading goals. Upgrade anytime from your dashboard.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm transition-all hover:shadow-md ${
                    plan.popular
                      ? "border-2 border-[#FFD700] shadow-lg shadow-yellow-900/10 lg:-translate-y-1"
                      : "border-slate-200"
                  }`}
                >
                  {plan.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#FFD700] px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-black">
                      Most popular
                    </span>
                  )}
                  <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-slate-900">${plan.price}</span>
                    <span className="text-sm text-slate-500">/ month</span>
                  </div>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">{plan.description}</p>
                  <ul className="mt-6 space-y-2.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-yellow-700" strokeWidth={3} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    className={`mt-8 w-full ${
                      plan.popular
                        ? "bg-[#FFD700] text-black hover:bg-[#E6C200]"
                        : "bg-slate-100 text-slate-900 hover:bg-slate-200"
                    }`}
                  >
                    <Link to="/signup">Get {plan.name}</Link>
                  </Button>
                </div>
              ))}
            </div>
            <p className="mt-10 text-center text-sm text-slate-500">
              All plans include secure login, wallet access, and trade history. Trading involves risk.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50 px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm font-semibold text-slate-800">Copy Trade Engine</p>
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} Copy Trade Engine. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-slate-600">
            <Link to="/login" className="hover:text-slate-900">Log in</Link>
            <Link to="/signup" className="hover:text-slate-900">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
