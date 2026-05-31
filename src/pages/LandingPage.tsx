import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useVerifiedSession } from "@/hooks/useVerifiedSession";
import {
  ArrowRight,
  BarChart3,
  Check,
  Clock,
  Copy,
  Headphones,
  Lock,
  Mail,
  MessageSquare,
  Shield,
  Timer,
  TrendingUp,
  Unlock,
  Wallet,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  SUBSCRIPTION_PACKAGES,
  TRIAL_WITHDRAW_NOTICE,
  WITHDRAW_USP,
  CONTACT_EMAIL,
} from "@/constants/packages";

const HIGHLIGHTS = [
  {
    icon: Timer,
    title: "3-minute withdrawals",
    text: WITHDRAW_USP.detail,
  },
  {
    icon: Copy,
    title: "Proportional copy trading",
    text: "Every open MT5 master trade is split by wallet share. You see only your slice of volume, fees, and P/L.",
  },
  {
    icon: TrendingUp,
    title: "Live equity dashboard",
    text: "Wallet balance, open P/L, closed pending credits, and total equity — updated as markets move.",
  },
  {
    icon: Wallet,
    title: "USDT TRC20 wallet",
    text: "Recharge in USD, track a full ledger, and withdraw to your saved Tron address after approval.",
  },
  {
    icon: Shield,
    title: "Transparent settlement",
    text: "Performance fees apply on profit only. Losses hit your allocation first — no hidden platform cuts on red trades.",
  },
  {
    icon: Headphones,
    title: "Human support",
    text: "In-app tickets, admin voice support when you opt in, and KYC-backed account verification.",
  },
];

const STATS = [
  { value: "~3 min", label: "USDT payout after approval" },
  { value: "7 days", label: "Free trial to test the engine" },
  { value: "Pro-rata", label: "Volume split across funded users" },
  { value: "24/7", label: "Live trade sync & dashboard" },
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
    title: "USDT in ~3 minutes",
    text: "Once approved, outbound USDT is broadcast to Tron — typically within three minutes.",
  },
];

const FAQ = [
  {
    q: "Is the 7-day trial really free?",
    a: "Yes. Activate once per account. You still fund your wallet to copy live trades, but the subscription itself costs $0.",
  },
  {
    q: "Why are trial withdrawals locked?",
    a: "During the free trial your capital stays locked for 7 days so you can experience copy trading without instant cash-out. You may stop trading anytime; withdrawal unlocks when the trial ends.",
  },
  {
    q: "How fast are withdrawals on paid plans?",
    a: WITHDRAW_USP.short,
  },
  {
    q: "What markets do you copy?",
    a: "The engine mirrors master MT5 positions (e.g. XAUUSD) with proportional lot allocation based on each user's wallet share.",
  },
  {
    q: "What fees apply?",
    a: "A per-lot platform fee and admin profit share apply on winning trades only. Losses are absorbed by the user's allocation without performance fee.",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { isReady, role } = useVerifiedSession();

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactDone, setContactDone] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady || !role) return;
    navigate(role === "admin" ? "/admin/dashboard" : "/user/dashboard", { replace: true });
  }, [isReady, role, navigate]);

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
      `Copy Trade Engine inquiry from ${contactName.trim()}`;
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
            <a href="#usp" className="hover:text-slate-900">3-min withdraw</a>
            <a href="#about" className="hover:text-slate-900">Features</a>
            <a href="#plans" className="hover:text-slate-900">Plans</a>
            <a href="#faq" className="hover:text-slate-900">FAQ</a>
            <a href="#contact" className="hover:text-slate-900">Contact</a>
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
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-b from-yellow-50/80 via-white to-white px-4 py-16 sm:px-6 sm:py-24">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#FFD700]/20 blur-3xl" />
          <div className="relative mx-auto max-w-6xl">
            <div className="flex flex-wrap gap-3">
              <p className="inline-flex items-center gap-2 rounded-full border border-yellow-200 bg-[#FFF9E6] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-900">
                <BarChart3 className="h-4 w-4" />
                Multi-user copy trading
              </p>
              <p className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-emerald-800">
                <Timer className="h-4 w-4" />
                {WITHDRAW_USP.headline}
              </p>
            </div>
            <h1 className="mt-6 max-w-4xl text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Mirror expert trades.{" "}
              <span className="text-yellow-700">Cash out in minutes.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-slate-600">
              Copy Trade Engine connects you to live MT5 strategies with proportional volume,
              a secure USD wallet, transparent P/L, and our signature{" "}
              <strong className="font-semibold text-slate-800">{WITHDRAW_USP.headline}</strong> on
              paid plans — one of the fastest USDT (TRC20) payout flows in the industry.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Button size="lg" asChild className="bg-[#FFD700] text-black hover:bg-[#E6C200]">
                <Link to="/signup">
                  Start free 7-day trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#contact">Talk to us</a>
              </Button>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="border-b border-slate-100 bg-slate-900 px-4 py-10 text-white sm:px-6">
          <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="text-center sm:text-left">
                <p className="text-3xl font-extrabold text-[#FFD700]">{s.value}</p>
                <p className="mt-1 text-sm text-slate-300">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 3-min USP */}
        <section id="usp" className="border-b border-slate-100 px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="text-sm font-bold uppercase tracking-wider text-yellow-700">Our USP</p>
                <h2 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
                  {WITHDRAW_USP.headline}
                </h2>
                <p className="mt-4 text-lg text-slate-600">{WITHDRAW_USP.detail}</p>
                <ul className="mt-6 space-y-3">
                  {WITHDRAW_STEPS.map((item) => (
                    <li key={item.step} className="flex gap-3 text-sm text-slate-700">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FFD700] text-xs font-bold text-black">
                        {item.step}
                      </span>
                      <div>
                        <span className="font-semibold text-slate-900">{item.title}</span>
                        <span className="text-slate-600"> — {item.text}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-yellow-200 bg-gradient-to-br from-yellow-50 to-white p-8 shadow-lg shadow-yellow-900/5">
                <div className="flex items-center gap-3 text-emerald-700">
                  <Unlock className="h-8 w-8" />
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
                <p className="mt-6 text-xs text-slate-500">
                  You can stop copy trading during the trial — funds move to wallet equity, but
                  outbound withdrawal stays locked until day 7.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="about" className="border-b border-slate-100 px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 max-w-2xl">
              <h2 className="text-3xl font-bold text-slate-900">Everything in one platform</h2>
              <p className="mt-3 text-slate-600">
                From signup to settlement — built for traders who want clarity, speed, and control.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

        {/* How it works */}
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
                  title: "Create & verify",
                  text: "Sign up, complete profile/KYC, and fund your USD wallet via USDT recharge.",
                },
                {
                  step: "2",
                  title: "Pick a plan",
                  text: "Start with the free 7-day trial or choose a paid pack for full access and fast withdrawals.",
                },
                {
                  step: "3",
                  title: "Copy & cash out",
                  text: "Trades sync to your dashboard. Stop anytime. Withdraw USDT in ~3 minutes after approval (paid plans).",
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

        {/* Plans */}
        <section id="plans" className="px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">Subscription plans</h2>
              <p className="mx-auto mt-3 max-w-2xl text-slate-600">
                Trial users: funds locked 7 days (stop trading allowed). Paid users:{" "}
                <strong className="text-slate-800">{WITHDRAW_USP.headline}</strong> after approval.
              </p>
            </div>
            <div className="grid h-full gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {SUBSCRIPTION_PACKAGES.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative flex h-full flex-col rounded-2xl border bg-white p-6 shadow-sm transition-all hover:shadow-md ${
                    plan.popular
                      ? "border-2 border-[#FFD700] shadow-lg shadow-yellow-900/10 lg:-translate-y-1"
                      : plan.isTrial
                        ? "border-2 border-emerald-300 shadow-md"
                        : "border-slate-200"
                  }`}
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
                    <div className="mt-4 flex items-baseline gap-2">
                      {plan.isTrial ? (
                        <span className="text-4xl font-extrabold text-emerald-600">FREE</span>
                      ) : (
                        <>
                          <span className="text-4xl font-extrabold text-slate-900">${plan.price}</span>
                          <span className="text-lg font-medium text-slate-400 line-through">
                            ${plan.originalPrice}
                          </span>
                        </>
                      )}
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
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-slate-100 bg-slate-50 px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-3xl font-bold text-slate-900">Frequently asked questions</h2>
            <dl className="mt-10 space-y-6">
              {FAQ.map((item) => (
                <div key={item.q} className="rounded-xl border border-slate-200 bg-white p-6">
                  <dt className="font-semibold text-slate-900">{item.q}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-slate-600">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-yellow-700">Contact</p>
              <h2 className="mt-2 text-3xl font-bold text-slate-900">Questions before you start?</h2>
              <p className="mt-4 text-slate-600">
                Ask about plans, trial fund lock, withdrawals, or onboarding. We typically reply within
                one business day.
              </p>
              <ul className="mt-8 space-y-4 text-sm text-slate-700">
                <li className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-yellow-700" />
                  Paid withdrawals processed in ~3 minutes after approval
                </li>
                <li className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-yellow-700" />
                  Secure signup with email verification
                </li>
                <li className="flex items-center gap-3">
                  <MessageSquare className="h-5 w-5 text-yellow-700" />
                  In-app support tickets for active users
                </li>
              </ul>
            </div>

            <form
              onSubmit={handleContact}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-neutral-900/5 sm:p-8"
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
                    placeholder="Trial, withdrawals, partnership…"
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
                className="mt-6 w-full bg-[#FFD700] text-black hover:bg-[#E6C200]"
              >
                Send via email
              </Button>
              <p className="mt-3 text-center text-xs text-slate-500">
                Opens your email app to {CONTACT_EMAIL} — no server upload required.
              </p>
            </form>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50 px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm font-semibold text-slate-800">Copy Trade Engine</p>
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} Copy Trade Engine · {WITHDRAW_USP.headline} on paid plans
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
