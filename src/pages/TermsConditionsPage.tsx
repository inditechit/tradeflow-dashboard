import { Link } from "react-router-dom";
import { ArrowLeft, ScrollText } from "lucide-react";
import { CONTACT_EMAIL } from "@/constants/packages";

const BRAND = "Copy Trade Engine";
const LAST_UPDATED = "30 June 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

export default function TermsConditionsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <div className="mt-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFD700]/20 text-slate-900">
            <ScrollText className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Terms &amp; Conditions</h1>
            <p className="text-xs text-slate-500">Last updated: {LAST_UPDATED}</p>
          </div>
        </div>

        <p className="mt-6 text-sm leading-relaxed text-slate-600">
          These Terms govern your use of {BRAND}. By depositing funds, subscribing to a package or
          using the copy-trading wallet you accept these Terms. Please read the trading, profit-share
          and balance-correction sections carefully.
        </p>

        <Section title="1. How Copy Trading Works">
          <p>
            Your funds are mirrored against the master trading account. For each master trade you are
            allocated a proportional share based on your wallet capital relative to the total active
            capital in the pool at the moment the trade opens. A larger wallet receives a larger
            share; a smaller wallet receives a smaller share. You only participate in trades that
            open while your subscription is active and your wallet balance is positive.
          </p>
        </Section>

        <Section title="2. Profit Sharing (Per-Trade Model)">
          <ul className="list-disc space-y-1 pl-5">
            <li>Profit and loss are calculated and applied <strong>on each individual trade</strong> as it closes.</li>
            <li>
              Profit first restores your wallet up to your <strong>deposit baseline</strong> (your
              net deposits). This recovery portion is credited 100% to you.
            </li>
            <li>
              Only profit <strong>above</strong> your baseline is shared. By default the split is
              50% to you and 50% as the platform performance fee (your exact percentage is shown on
              your package).
            </li>
            <li>
              <strong>Losses are borne 100% by your wallet.</strong> The platform does not take a
              share of losses; it only shares in profit above your baseline.
            </li>
          </ul>
        </Section>

        <Section title="3. Losses and Wallet Reaching Zero">
          <p>
            Trading involves risk. Because losses are applied to your wallet, a series of losing
            trades can reduce your balance, and your wallet can reach zero. If your wallet reaches
            zero you stop participating in further trades until you add funds. Balances below your
            deposit reflect real trading losses, not a deduction by the platform.
          </p>
        </Section>

        <Section title="4. Assignment / Lot Fees">
          <p>
            A per-lot assignment fee may apply to each trade allocated to you, charged at the time of
            allocation. The applicable rate is shown in your account and is deducted from your
            wallet.
          </p>
        </Section>

        <Section title="5. Packages, Subscription & Expiry">
          <ul className="list-disc space-y-1 pl-5">
            <li>Access to copy trading requires an active package or trial.</li>
            <li>
              When your package <strong>expires without renewal</strong>, you exit the pool. Trades
              that close after your subscription has ended are not settled to your wallet — you do
              not gain or lose from positions after you have left.
            </li>
            <li>An administrator may extend your subscription; the extension is treated as continuous coverage up to the new end date.</li>
          </ul>
        </Section>

        <Section title="6. Deposits & Withdrawals">
          <ul className="list-disc space-y-1 pl-5">
            <li>Deposits are credited to your trading wallet and increase your baseline.</li>
            <li>Withdrawals are debited from your wallet (plus any applicable network/processing fee) and reduce your baseline.</li>
            <li>You may withdraw your available wallet balance subject to verification and platform rules.</li>
          </ul>
        </Section>

        <Section title="7. Balance Corrections & Recalculation">
          <p>
            Every balance is derived from an auditable ledger of deposits, withdrawals, fees,
            per-trade allocations and per-trade settlements. If a software or data error causes a
            wallet to display an incorrect figure, we reserve the right to recalculate balances from
            this source-of-truth ledger to restore the correct, accurate amount.
          </p>
          <p>
            A correction may move a balance up or down. A downward correction is{" "}
            <strong>not a confiscation of your funds</strong> — it removes amounts that were shown in
            error and were never the result of your real deposits or genuine realised trading
            profit. We will notify affected users when a correction is applied and can provide a
            transaction-level breakdown on request.
          </p>
        </Section>

        <Section title="8. Affiliate / Referral Earnings">
          <p>
            Affiliate commissions are credited to your affiliate wallet under the published referral
            rules. Transfers from the affiliate wallet to your trading wallet are recorded as
            deposits and follow the same trading and settlement terms above.
          </p>
        </Section>

        <Section title="9. Risk Disclosure">
          <p>
            Trading financial instruments carries a high level of risk and may not be suitable for
            all investors. Past performance is not indicative of future results. You may lose some or
            all of your deposited capital. Only trade with funds you can afford to lose.
          </p>
        </Section>

        <Section title="10. Changes to These Terms">
          <p>
            We may update these Terms from time to time. Continued use of the platform after changes
            take effect constitutes acceptance of the updated Terms.
          </p>
        </Section>

        <Section title="11. Contact Us">
          <p>
            Questions about these Terms? Contact us at{" "}
            <a className="font-medium text-slate-900 underline" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <div className="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-400">
          <p>
            See also our{" "}
            <Link to="/privacy-policy" className="font-medium text-slate-600 underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
