import { ScrollText } from "lucide-react";
import { Link } from "react-router-dom";
import { LegalPageShell, LegalSection } from "@/components/legal/LegalPageShell";
import { LEGAL_BRAND } from "@/constants/legal";
import { SUPPORT_HOURS } from "@/constants/legal";
import { TRIAL_WITHDRAW_NOTICE, WITHDRAW_USP } from "@/constants/packages";

export default function TermsConditionsPage() {
  return (
    <LegalPageShell
      title="Terms & Conditions"
      icon={ScrollText}
      intro={
        <>
          These Terms govern your use of {LEGAL_BRAND}. By depositing funds, subscribing to a package,
          activating a trial or using the copy-trading wallet you accept these Terms. Please read the
          trading, profit-share, refund and support sections carefully.
        </>
      }
    >
      <LegalSection title="1. Nature of the Service">
        <p>
          {LEGAL_BRAND} is a <strong>software tool</strong> that mirrors a master trading account to
          your wallet using proportional capital allocation. We provide technology, trade allocation,
          settlement and wallet infrastructure — not investment advice or guaranteed returns. Market
          risk remains with you at all times.
        </p>
      </LegalSection>

      <LegalSection title="2. How Copy Trading Works">
        <p>
          Your funds are mirrored against the master trading account. For each master trade you are
          allocated a proportional share based on your wallet capital relative to the total active
          capital in the pool at the moment the trade opens. A larger wallet receives a larger share; a
          smaller wallet receives a smaller share. You only participate in trades that open while your
          subscription is active and your wallet balance is positive.
        </p>
        <p>
          Our focus includes structured approaches to Gold (XAU/USD) and related instruments using
          trend, risk configuration and capital-allocation rules described on our website.
        </p>
      </LegalSection>

      <LegalSection title="3. Profit Sharing (Per-Trade Model)">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Profit and loss are calculated and applied <strong>on each individual trade</strong> as it
            closes.
          </li>
          <li>
            Profit first restores your wallet up to your <strong>deposit baseline</strong> (your net
            deposits). This recovery portion is credited 100% to you.
          </li>
          <li>
            Only profit <strong>above</strong> your baseline is shared. By default the split is 50% to
            you and 50% as the platform performance fee (your exact percentage is shown on your
            package).
          </li>
          <li>
            <strong>Losses are borne 100% by your wallet.</strong> The platform does not take a share of
            losses; it only shares in profit above your baseline.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Losses and Wallet Reaching Zero">
        <p>
          Trading involves risk. Because losses are applied to your wallet, a series of losing trades
          can reduce your balance, and your wallet can reach zero. If your wallet reaches zero you stop
          participating in further trades until you add funds. Balances below your deposit reflect real
          trading losses, not a deduction by the platform.
        </p>
        <p>
          Full details on user responsibility for losses are in our{" "}
          <Link to="/trading-loss-sop" className="font-medium text-slate-900 underline">
            Trading Loss Responsibility (SOP)
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="5. Assignment / Lot Fees">
        <p>
          A per-lot assignment fee may apply to each trade allocated to you (including BTCUSD at the
          published rate), charged at allocation time. The applicable rate is shown in your account and
          is deducted from your wallet.
        </p>
      </LegalSection>

      <LegalSection title="6. Packages, Trial & Subscription">
        <ul className="list-disc space-y-1 pl-5">
          <li>Access to copy trading requires an active package or the free 7-day trial.</li>
          <li>
            <strong>Free trial:</strong> {TRIAL_WITHDRAW_NOTICE}
          </li>
          <li>
            <strong>Paid packages</strong> (1 Month, 3 Month, 6 Month, 1 Year, etc.) grant access for the
            purchased duration only.
          </li>
          <li>
            Package fees are for <strong>service access</strong> and are{" "}
            <strong>non-refundable</strong> once purchased — see our Refund Policy.
          </li>
          <li>
            When your package <strong>expires without renewal</strong>, you exit the pool. Trades that
            close after your subscription has ended are not settled to your wallet.
          </li>
          <li>
            An administrator may extend your subscription; the extension is treated as continuous
            coverage up to the new end date.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Deposits & Withdrawals">
        <ul className="list-disc space-y-1 pl-5">
          <li>Deposits (USDT TRC20) are credited to your trading wallet and increase your baseline.</li>
          <li>
            Withdrawals are debited from your wallet (plus any applicable fee) and reduce your baseline.
          </li>
          <li>
            You may withdraw your available wallet balance when you have no open copy positions and meet
            verification requirements.
          </li>
          <li>{WITHDRAW_USP.short}</li>
          <li>
            Withdrawing wallet funds is not a refund of package fees — see our Refund Policy for the
            distinction.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="8. Refund Policy Summary">
        <p>
          We sell a <strong>service</strong>, not a physical product. Package subscription fees are{" "}
          <strong>final and non-refundable</strong> after activation. Use the free 7-day trial to
          evaluate the platform before purchasing. Full details are in our Refund Policy.
        </p>
      </LegalSection>

      <LegalSection title="9. Balance Corrections & Recalculation">
        <p>
          Every balance is derived from an auditable ledger of deposits, withdrawals, fees, per-trade
          allocations and per-trade settlements. If a software or data error causes a wallet to display
          an incorrect figure, we reserve the right to recalculate balances from this source-of-truth
          ledger to restore the correct amount.
        </p>
        <p>
          A downward correction is <strong>not a confiscation of your funds</strong> — it removes amounts
          that were shown in error and were never supported by your real deposits or genuine realised
          trading profit. We will notify affected users when a correction is applied and can provide a
          transaction-level breakdown on request.
        </p>
      </LegalSection>

      <LegalSection title="10. Affiliate / Referral Earnings">
        <p>
          Affiliate commissions are credited to your affiliate wallet under the published referral
          rules. Transfers from the affiliate wallet to your trading wallet are recorded as deposits and
          follow the same trading and settlement terms above.
        </p>
      </LegalSection>

      <LegalSection title="11. User Responsibilities">
        <ul className="list-disc space-y-1 pl-5">
          <li>Provide accurate registration and KYC information.</li>
          <li>Keep login credentials and withdrawal addresses secure.</li>
          <li>Only deposit funds you can afford to lose.</li>
          <li>Comply with applicable laws in your jurisdiction regarding online trading services.</li>
          <li>Not attempt to manipulate allocations, abuse trials or circumvent platform limits.</li>
        </ul>
      </LegalSection>

      <LegalSection title="12. Support & Working Hours">
        <p>{SUPPORT_HOURS.supportAccounts}</p>
        <p>{SUPPORT_HOURS.itSupport}</p>
        <p>{SUPPORT_HOURS.offHoursNote}</p>
        <p>
          Urgent trading or wallet issues reported outside working hours are queued for the next
          available business day. Life-safety emergencies should not be directed to this platform.
        </p>
      </LegalSection>

      <LegalSection title="13. Risk Disclosure">
        <p>
          Trading financial instruments carries a high level of risk and may not be suitable for all
          investors. Past performance is not indicative of future results. You may lose some or all of
          your deposited capital. {LEGAL_BRAND} does not guarantee profits or fixed returns.
        </p>
      </LegalSection>

      <LegalSection title="14. Limitation of Liability">
        <p>
          To the maximum extent permitted by law, {LEGAL_BRAND} is not liable for market losses,
          downtime, third-party network delays (including blockchain congestion), or force-majeure events.
          Our total liability for any claim relating to the service is limited to the fees you paid us in
          the three months preceding the claim, except where law requires otherwise.
        </p>
      </LegalSection>

      <LegalSection title="15. Changes to These Terms">
        <p>
          We may update these Terms from time to time. Continued use of the platform after changes take
          effect constitutes acceptance of the updated Terms.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
