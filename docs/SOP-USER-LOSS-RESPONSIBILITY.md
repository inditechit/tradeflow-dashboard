# SOP: User responsibility for trading losses

**Product:** Copy Trade Engine  
**Last updated:** 5 July 2026  
**Audience:** Support, accounts, admin  
**Public page:** `/trading-loss-sop` (share this link with users)

---

## 1. Purpose

Standardise how we handle complaints about wallet decreases. **Trading losses are the user’s responsibility.** We explain the ledger; we do not refund market losses.

---

## 2. Policy statement (use in replies)

> Copy trading mirrors live market trades to your wallet. When trades close at a loss, that loss is applied to your wallet in full. The platform does not guarantee profits and does not refund normal trading losses. You accepted this when you agreed to our Terms and deposited funds. We can send a ticket-by-ticket breakdown from your ledger on request.

---

## 3. When the user is responsible (no refund / no credit)

| Situation | User responsible? | Action |
|-----------|-------------------|--------|
| Trade settled at a loss | **Yes** | Explain ticket, date, gross P/L, user share |
| Wallet reached $0 from multiple losses + fees | **Yes** | Show chronological ledger |
| Assignment / lot fee charged | **Yes** | Point to fee at assign time |
| User withdrew funds | **Yes** | Show withdrawal row |
| Package fee from wallet | **Yes** | Service fee, not trading — Refund Policy |
| User recharged then lost on **new** trades | **Yes** | Normal copy trading |
| Master ticket shows large negative P/L but user share was small | **Yes** | Clarify master vs wallet columns |
| User “did not understand” copy trading | **Yes** | Refer to Terms + this SOP + trial |

---

## 4. When to escalate (possible platform issue)

Escalate to tech/admin **only** if evidence shows:

- Wallet balance inconsistent with ledger (sum of entries ≠ displayed balance)
- User settled on a trade that opened **before** their recharge (wrong assign) — verify ticket `open_time` vs first recharge after cutoff
- Duplicate settlement or missing recharge not reflected in ledger
- Documented rebuild/correction not communicated (Terms §9)

Do **not** escalate solely because the user lost money on valid trades.

---

## 5. Support workflow

1. **Identify user** — user ID, Telegram, email.
2. **Pull facts** — wallet now, last recharge, withdrawals, open package.
3. **Ledger review** — `user_balance_ledger_v2`: recharges, `trade_assign_fee`, `trade_settlement`, withdrawals since the date they mention.
4. **Per-ticket check** — `trade_allocations_v2` + `trade_settlements_v2` for disputed tickets.
5. **Classify** — normal loss (close ticket) vs bug (escalate with ticket list).
6. **Respond** — use templates below; link `/trading-loss-sop` and `/terms`.
7. **Log** — note user ID, summary, outcome (explained / escalated).

---

## 6. Response templates

### 6.1 Standard loss explanation

```
Hi [Name],

We reviewed your wallet (User #[ID]). Your balance changed because of copy-traded market results and published fees — not a platform withdrawal or confiscation.

Summary:
- Recharge(s): [amount / date]
- Assign fees: [total or count]
- Trade settlements (losses): [total or key tickets]
- Withdrawals: [if any]
- Current wallet: $[balance]

Each loss is your proportional share when the master trade closed. Losses are 100% on your wallet per our Terms (§3–§4). We cannot refund normal trading losses.

Full policy: [site]/trading-loss-sop

If you want a full ticket list, reply with the date range and we will send it.

— Support
```

### 6.2 Wallet reached zero

```
Hi [Name],

Your wallet reached $0 after [N] settlements and assign fees between [date] and [date]. There was no single incorrect charge — cumulative trading losses and fees used your balance.

You were only assigned to trades while your package was active and your wallet was positive. You are not charged for new trades until you recharge.

Policy: [site]/trading-loss-sop
```

### 6.3 Master P/L vs your wallet (e.g. “-$400” confusion)

```
Hi [Name],

The large negative number you see on a master/admin trade is the full ticket P/L on the master account — not what was debited from your wallet.

Your wallet impact for that ticket was $[user_share] (your pool % × master result). Please check the “Impact” / user share column, not master P/L alone.

— Support
```

### 6.4 Decline refund request

```
Hi [Name],

We cannot refund or credit your wallet for market losses. Copy trading carries risk; you accepted this in our Terms when you deposited.

Package fees are for service access and are non-refundable after activation (Refund Policy).

We are happy to provide a ledger breakdown. We cannot reverse legitimate settlements.

— Support
```

---

## 7. Prohibited commitments

Support must **not** promise:

- Refund of trading losses  
- Guaranteed recovery of capital  
- “We will fix your balance” without tech confirmation of a ledger bug  
- Compensation for voluntary recharge after prior losses  

---

## 8. References

- Public: `/trading-loss-sop`, `/terms`, `/refund-policy`  
- Terms §3 (profit/loss split), §4 (wallet zero), §9 (corrections only for errors), §13–§14 (risk & liability)  
- Internal: admin user P/L report, ledger v2 tables  

---

## 9. Revision history

| Date | Change |
|------|--------|
| 2026-07-05 | Initial SOP — user responsibility for trading losses |
