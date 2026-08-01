import { ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { LegalPageShell, LegalSection } from "@/components/legal/LegalPageShell";
import { LEGAL_BRAND } from "@/constants/legal";

export default function TradingLossSopPage() {
  return (
    <LegalPageShell
      title="Trading Loss Responsibility (SOP)"
      icon={ShieldAlert}
      intro={
        <>
          This Standard Operating Procedure explains how wallet balances change on {LEGAL_BRAND}, how
          the platform <strong>shares profits and losses</strong> within an open cycle, who is
          responsible when funds decrease beyond that buffer, and what support can and cannot do. See
          also our{" "}
          <Link to="/terms" className="font-medium text-slate-900 underline">
            Terms &amp; Conditions
          </Link>
          .
        </>
      }
    >
      <LegalSection title="1. Purpose">
        <p>
          To make it clear that when a user&apos;s wallet balance goes down because of copy-traded market
          activity, assignment fees, or withdrawals initiated by the user, the user — not the platform —
          bears that loss. This SOP applies to all users, support staff, and administrators handling
          balance or P/L enquiries.
        </p>
      </LegalSection>

      <LegalSection title="2. Core principle — shared cycle, then user capital">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>You choose to deposit and trade.</strong> Funds are allocated to live market trades
            that can win or lose.
          </li>
          <li>
            <strong>Admin shares cycle profit and losses.</strong> While an admin claim from cycle
            profit is open, the platform absorbs the same share % of losses from that buffer only.
            Losses beyond the buffer hit your Trading capital.
          </li>
          <li>
            <strong>A lower balance reflects real trading results</strong> after published sharing
            rules and fees — not an arbitrary confiscation.
          </li>
          <li>
            <strong>If your wallet reaches zero</strong>, you stop joining new trades until you add funds
            again. No automatic refund or compensation is owed for market losses beyond the sharing
            rules.
          </li>
          <li>
            <strong>You are responsible</strong> for only depositing money you can afford to lose and for
            understanding copy-trading risk before subscribing.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. How wallet decreases happen (normal cases)">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Trade settlement (loss):</strong> When a master trade closes at a loss, your
            proportional gross is settled; admin absorbs their share from the open claim buffer first,
            then any remainder is debited from your Trading wallet.
          </li>
          <li>
            <strong>Assignment / lot fee:</strong> A per-lot fee is charged when a trade is allocated to
            you. This is separate from P/L and is disclosed in your account.
          </li>
          <li>
            <strong>Withdrawal:</strong> Amounts you withdraw (plus any fee) reduce your wallet and your
            deposit baseline.
          </li>
          <li>
            <strong>Package purchase:</strong> Subscription fees paid from the wallet reduce your balance
            as a service charge, not a trading loss.
          </li>
          <li>
            <strong>Multiple small losses:</strong> A wallet can reach zero over many trades and fees — not
            necessarily from one large hit.
          </li>
        </ul>
        <p>
          In all of the above cases, the user is responsible. Support will provide a transaction
          breakdown on request but will not reverse legitimate market losses.
        </p>
      </LegalSection>

      <LegalSection title="4. What the platform is NOT responsible for">
        <ul className="list-disc space-y-1 pl-5">
          <li>Market direction, volatility, or master-account P/L on any given trade.</li>
          <li>
            Confusion between <strong>master trade P/L</strong> (full ticket size on the admin account) and{" "}
            <strong>your wallet impact</strong> (your smaller proportional share).
          </li>
          <li>Losses from trades that opened while you had an active package and positive wallet.</li>
          <li>Blockchain delays, network congestion, or third-party payment timing.</li>
          <li>Decisions to recharge, withdraw, or let a balance run to zero without withdrawing.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. When the platform may correct a balance">
        <p>
          Corrections are allowed only when a <strong>proven software or data error</strong> caused the
          wallet to show an amount not supported by the auditable ledger (deposits, withdrawals, fees,
          allocations, settlements). See{" "}
          <Link to="/terms" className="font-medium text-slate-900 underline">
            Terms §9 — Balance Corrections &amp; Recalculation
          </Link>
          .
        </p>
        <p>
          A downward correction removes <em>incorrectly displayed</em> balance — it is not compensation
          for normal trading losses. Users are notified when a correction is applied.
        </p>
      </LegalSection>

      <LegalSection title="6. What support will do">
        <ul className="list-disc space-y-1 pl-5">
          <li>Confirm your user ID, recharge history, and current wallet from the ledger.</li>
          <li>List settlements and fees tied to specific tickets and dates.</li>
          <li>Explain pool share, baseline recovery, and profit-share rules if relevant.</li>
          <li>Escalate to technical review only if there is evidence of a system bug — not for market loss.</li>
        </ul>
      </LegalSection>

      <LegalSection title="7. What support will not do">
        <ul className="list-disc space-y-1 pl-5">
          <li>Refund or credit wallets for normal copy-trading losses.</li>
          <li>Refund package subscription fees after activation (see Refund Policy).</li>
          <li>Guarantee profits, fixed returns, or recovery of lost capital from trading.</li>
          <li>Change historical settlements because the user regrets participating in losing trades.</li>
        </ul>
      </LegalSection>

      <LegalSection title="8. User acknowledgement">
        <p>
          By signing up, accepting the legal checkbox, depositing funds, or using copy trading, you confirm
          that you have read this SOP together with the Terms, Refund Policy, and Risk Disclosure, and that
          you accept <strong>full responsibility for any loss of wallet balance arising from trading
          activity and published fees</strong>, except where a documented platform error is corrected under
          Terms §9.
        </p>
      </LegalSection>

      <LegalSection title="9. Related policies">
        <p>
          <Link to="/terms" className="font-medium text-slate-900 underline">
            Terms &amp; Conditions
          </Link>{" "}
          (§3 Profit Sharing, §4 Losses, §13 Risk Disclosure, §14 Limitation of Liability) ·{" "}
          <Link to="/refund-policy" className="font-medium text-slate-900 underline">
            Refund Policy
          </Link>{" "}
          ·{" "}
          <Link to="/privacy-policy" className="font-medium text-slate-900 underline">
            Privacy Policy
          </Link>
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
