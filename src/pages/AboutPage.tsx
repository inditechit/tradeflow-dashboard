import { PublicMarketingChrome } from "@/components/marketing/PublicMarketingChrome";
import { usePageMeta } from "@/hooks/usePageMeta";

const BRAND = "Copy Trade Engine";

export default function AboutPage() {
  usePageMeta(
    "About us",
    `Learn about ${BRAND} — automated gold copy trading with transparent risk and capital controls.`,
  );

  return (
    <PublicMarketingChrome>
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="text-4xl font-bold text-slate-900">About {BRAND}</h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-600">
          We built {BRAND} so traders can participate in systematic XAUUSD copy trading without
          drowning in charts, spreadsheets, or opaque fee structures.
        </p>
        <div className="mt-10 space-y-6 leading-relaxed text-slate-700">
          <p>
            Our engine follows a defined methodology around trend and trap zones. You choose a risk
            profile; capital allocation and settlement rules stay consistent and auditable in your
            dashboard.
          </p>
          <p>
            Safe Wallet and Trading Wallet keep protected funds separate from at-risk trading
            capital. Withdrawals, packages, and affiliate tools live in the same account.
          </p>
          <p>
            Trading involves substantial risk of loss. Nothing on this site is financial advice.
            Only risk capital you can afford to lose.
          </p>
        </div>
      </div>
    </PublicMarketingChrome>
  );
}
