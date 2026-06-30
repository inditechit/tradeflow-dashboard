import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
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

export default function PrivacyPolicyPage() {
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
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Privacy Policy</h1>
            <p className="text-xs text-slate-500">Last updated: {LAST_UPDATED}</p>
          </div>
        </div>

        <p className="mt-6 text-sm leading-relaxed text-slate-600">
          This Privacy Policy explains how {BRAND} ("we", "us", "our") collects, uses, stores and
          protects your information when you use our copy-trading platform, wallet and related
          services. By creating an account you agree to the practices described here.
        </p>

        <Section title="1. Information We Collect">
          <p>We collect the following categories of information:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Account details:</strong> name, email, mobile number, country and login credentials.</li>
            <li><strong>KYC / verification data:</strong> identity and address documents where required by law.</li>
            <li><strong>Financial data:</strong> deposits, withdrawals, wallet balances, package purchases, affiliate earnings and trade allocations.</li>
            <li><strong>Usage data:</strong> device, browser, IP address, and activity logs for security and fraud prevention.</li>
          </ul>
        </Section>

        <Section title="2. How We Use Your Information">
          <ul className="list-disc space-y-1 pl-5">
            <li>To operate your trading wallet, allocate master trades and settle profit/loss.</li>
            <li>To process deposits, withdrawals, package subscriptions and affiliate payouts.</li>
            <li>To verify identity, prevent fraud and comply with legal obligations.</li>
            <li>To send service notifications, including balance corrections and account updates.</li>
            <li>To improve and secure the platform.</li>
          </ul>
        </Section>

        <Section title="3. Wallet, Trade & Balance Records">
          <p>
            Your wallet balance is derived from an auditable ledger of real events: deposits,
            withdrawals, package fees, per-trade allocations and per-trade settlements. We retain a
            complete history of these records so that any balance can be independently recalculated
            and explained. If a calculation error is detected, we may recompute balances from this
            source-of-truth ledger to restore the correct figure.
          </p>
        </Section>

        <Section title="4. How We Share Information">
          <p>
            We do not sell your personal data. We share information only with: payment and
            blockchain processors needed to move funds; identity-verification providers; and
            authorities where legally required. Service providers are bound to use data only for the
            services they provide to us.
          </p>
        </Section>

        <Section title="5. Data Security">
          <p>
            We use industry-standard safeguards including encryption in transit, access controls and
            activity logging. No method of transmission or storage is 100% secure, but we
            continuously work to protect your data.
          </p>
        </Section>

        <Section title="6. Data Retention">
          <p>
            Financial and KYC records are retained for as long as your account is active and for the
            period required by applicable law and audit obligations after closure.
          </p>
        </Section>

        <Section title="7. Your Rights">
          <ul className="list-disc space-y-1 pl-5">
            <li>Access a copy of the personal data we hold about you.</li>
            <li>Request correction of inaccurate information.</li>
            <li>Request deletion, subject to legal and financial retention requirements.</li>
            <li>Request an explanation of any wallet balance or settlement.</li>
          </ul>
        </Section>

        <Section title="8. Contact Us">
          <p>
            For privacy questions or data requests, contact us at{" "}
            <a className="font-medium text-slate-900 underline" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <div className="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-400">
          <p>
            See also our{" "}
            <Link to="/terms" className="font-medium text-slate-600 underline">
              Terms &amp; Conditions
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
