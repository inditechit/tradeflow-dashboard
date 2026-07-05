import { Link } from "react-router-dom";
import { Ban } from "lucide-react";
import { LegalPageShell, LegalSection } from "@/components/legal/LegalPageShell";
import { LEGAL_BRAND, SUPPORT_HOURS } from "@/constants/legal";
import { TRIAL_WITHDRAW_NOTICE, WITHDRAW_USP } from "@/constants/packages";

export default function RefundPolicyPage() {
  return (
    <LegalPageShell
      title="Refund Policy"
      icon={Ban}
      intro={
        <>
          {LEGAL_BRAND} provides a <strong>software-based copy-trading service</strong>, not a physical
          product. Subscription packages grant time-limited access to the platform, trade allocation,
          and support — they are <strong>not refundable</strong> once purchased. Your trading wallet
          balance is separate: you may withdraw available funds subject to platform rules, verification,
          and active-trade settlement.
        </>
      }
    >
      <LegalSection title="1. Services vs. Products">
        <p>
          Package fees (1 Month, 3 Month, 6 Month, 1 Year, and similar plans) pay for{" "}
          <strong>access to our copy-trading technology and infrastructure</strong> for a fixed period.
          Because the service begins immediately upon activation — including wallet setup, trade
          mirroring, and platform access — these fees are treated as consumed digital services and are
          <strong> final and non-refundable</strong>.
        </p>
        <p>
          This is separate from your <strong>trading wallet</strong>, which holds capital you deposit
          for copy trading. Wallet funds are yours to manage within the rules below.
        </p>
      </LegalSection>

      <LegalSection title="2. No Refunds on Package Purchases">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Once a paid package is purchased and activated, the subscription fee is{" "}
            <strong>non-refundable</strong>, including partial refunds for unused days.
          </li>
          <li>
            This applies whether payment was made by USDT, wallet balance, admin credit, or any other
            approved method.
          </li>
          <li>
            Promotional or discounted pricing does not change this policy — all package sales are
            final.
          </li>
          <li>
            Chargebacks or payment disputes on package fees may result in account suspension pending
            review.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Try Before You Buy — Free 7-Day Trial">
        <p>
          We offer a <strong>FREE 7-DAY TRIAL</strong> so you can evaluate copy trading before buying a
          paid plan. {TRIAL_WITHDRAW_NOTICE} During the trial you may stop copy trading; performance
          fees apply only on positive results per the published trial terms.
        </p>
        <p>
          We strongly recommend completing the trial and reviewing your experience before purchasing
          any paid package. Purchasing a package indicates that you have had adequate opportunity to
          assess the service.
        </p>
      </LegalSection>

      <LegalSection title="4. Withdrawing Your Wallet Balance (Not a Refund)">
        <p>
          Withdrawing money from your trading wallet is <strong>not a package refund</strong> — it is
          a withdrawal of your own capital and any net trading results credited to your wallet, subject
          to:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Successful identity / KYC verification where required.</li>
          <li>No open copy-trade positions (or settled P/L after you stop trading).</li>
          <li>Minimum withdrawal amount and network fee as shown in the app.</li>
          <li>Admin approval and TRC20 payout to your registered address.</li>
          <li>
            Paid plans: {WITHDRAW_USP.short}
          </li>
        </ul>
        <p>
          Trading losses, assignment (lot) fees, and performance-share deductions reduce your
          withdrawable balance. Those deductions are not refundable — they reflect actual service
          usage and market outcomes.
        </p>
      </LegalSection>

      <LegalSection title="5. What We Do Not Refund">
        <ul className="list-disc space-y-1 pl-5">
          <li>Subscription / package fees after activation.</li>
          <li>Per-trade assignment (lot) fees already charged at allocation.</li>
          <li>Platform performance-share fees on profitable trades above your deposit baseline.</li>
          <li>Network or processing fees on withdrawals.</li>
          <li>Losses from market movement — copy trading carries risk and balances can decrease.</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Balance Corrections">
        <p>
          If a software error causes an incorrect wallet display, we may recalculate balances from our
          auditable ledger to restore the correct figure. A downward correction removes amounts that
          were never supported by real deposits or genuine trading results — this is not a refund
          denial but a correction of an erroneous credit. See our{" "}
          <Link to="/terms" className="font-medium text-slate-900 underline">
            Terms &amp; Conditions
          </Link>{" "}
          for full details.
        </p>
      </LegalSection>

      <LegalSection title="7. Exceptional Circumstances">
        <p>
          In rare cases — such as duplicate payment for the same package or a verified technical
          failure where no service was delivered — we may, at our sole discretion, offer a credit or
          adjustment. This is not a guarantee of refund and does not set a precedent. Contact us with
          transaction proof (TX hash, payment ID, date).
        </p>
      </LegalSection>

      <LegalSection title="8. Support & Response Times">
        <p>{SUPPORT_HOURS.supportAccounts}</p>
        <p>{SUPPORT_HOURS.itSupport}</p>
        <p>{SUPPORT_HOURS.offHoursNote}</p>
        <p>
          Refund or billing enquiries should be sent with your registered email, user ID, and payment
          reference. Responses are provided on working days only.
        </p>
      </LegalSection>

      <LegalSection title="9. Agreement">
        <p>
          By purchasing a package or depositing funds you confirm that you have read and accept this
          Refund Policy together with our{" "}
          <Link to="/terms" className="font-medium text-slate-900 underline">
            Terms &amp; Conditions
          </Link>{" "}
          and{" "}
          <Link to="/privacy-policy" className="font-medium text-slate-900 underline">
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
