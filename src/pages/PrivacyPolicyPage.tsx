import { ShieldCheck } from "lucide-react";
import { LegalPageShell, LegalSection } from "@/components/legal/LegalPageShell";
import { LEGAL_BRAND } from "@/constants/legal";
import { SUPPORT_HOURS } from "@/constants/legal";

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      icon={ShieldCheck}
      intro={
        <>
          This Privacy Policy explains how {LEGAL_BRAND} (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;)
          collects, uses, stores and protects your information when you use our copy-trading platform,
          wallet and related services. By creating an account you agree to the practices described here.
        </>
      }
    >
      <LegalSection title="1. Information We Collect">
        <p>We collect the following categories of information:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Account details:</strong> name, email, mobile number, Telegram handle, country and
            login credentials.
          </li>
          <li>
            <strong>KYC / verification data:</strong> identity and address documents where required by
            law or for withdrawal approval.
          </li>
          <li>
            <strong>Financial data:</strong> USDT deposits, withdrawals, wallet balances, package
            purchases, affiliate earnings, trade allocations and settlements.
          </li>
          <li>
            <strong>Trading activity:</strong> copy-trade participation, open/closed positions, fees
            and profit-share records.
          </li>
          <li>
            <strong>Usage data:</strong> device, browser, IP address, session activity and logs for
            security and fraud prevention.
          </li>
          <li>
            <strong>Communications:</strong> support tickets, emails and in-app notifications related
            to your account.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="2. How We Use Your Information">
        <ul className="list-disc space-y-1 pl-5">
          <li>To operate your trading wallet, allocate master trades and settle profit/loss per trade.</li>
          <li>To process deposits, withdrawals, package subscriptions and affiliate payouts.</li>
          <li>To verify identity, prevent fraud and comply with legal obligations.</li>
          <li>To send service notifications, including balance updates and account alerts.</li>
          <li>To provide customer support and resolve billing or technical issues.</li>
          <li>To improve platform security, performance and user experience.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Wallet, Trade & Balance Records">
        <p>
          Your wallet balance is derived from an auditable ledger of real events: deposits,
          withdrawals, package fees, per-trade allocations and per-trade settlements. We retain a
          complete history so any balance can be independently recalculated. If a calculation error is
          detected, we may recompute balances from this source-of-truth ledger to restore the correct
          figure, as described in our Terms &amp; Conditions.
        </p>
      </LegalSection>

      <LegalSection title="4. How We Share Information">
        <p>
          We do not sell your personal data. We share information only with: payment and blockchain
          processors needed to move USDT funds; identity-verification providers; and authorities where
          legally required. Service providers are bound to use data only for the services they provide
          to us.
        </p>
      </LegalSection>

      <LegalSection title="5. Data Security">
        <p>
          We use industry-standard safeguards including encryption in transit, access controls, OTP
          verification for sensitive actions and activity logging. No method of transmission or storage
          is 100% secure, but we continuously work to protect your data.
        </p>
      </LegalSection>

      <LegalSection title="6. Data Retention">
        <p>
          Financial, trading and KYC records are retained for as long as your account is active and for
          the period required by applicable law and audit obligations after closure. Ledger entries
          supporting wallet balances are kept to allow historical reconstruction.
        </p>
      </LegalSection>

      <LegalSection title="7. Your Rights">
        <ul className="list-disc space-y-1 pl-5">
          <li>Access a copy of the personal data we hold about you.</li>
          <li>Request correction of inaccurate information.</li>
          <li>Request deletion, subject to legal and financial retention requirements.</li>
          <li>Request an explanation of any wallet balance, fee or settlement line item.</li>
          <li>Opt out of non-essential marketing communications.</li>
        </ul>
      </LegalSection>

      <LegalSection title="8. Cookies & Session Data">
        <p>
          We use session tokens and local storage to keep you signed in and remember preferences.
          These are necessary for platform operation and are not used for third-party advertising.
        </p>
      </LegalSection>

      <LegalSection title="9. Support Availability">
        <p>{SUPPORT_HOURS.supportAccounts}</p>
        <p>{SUPPORT_HOURS.itSupport}</p>
        <p>{SUPPORT_HOURS.offHoursNote}</p>
        <p>
          Privacy or data requests submitted on closed days will be handled on the next working day for
          the relevant team.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. The &quot;Last updated&quot; date at the
          top will change when we do. Continued use of the platform after changes take effect constitutes
          acceptance of the updated policy.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
