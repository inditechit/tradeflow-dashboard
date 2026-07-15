import { useCallback, useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { FileText, Loader2, RefreshCw, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE } from "@/config/api";
import { UserSearchSelect } from "@/components/admin/UserSearchSelect";
import { Button } from "@/components/ui/button";
import { plTextClass } from "@/utils/plColors";

type StatementEntry = {
  at: string;
  kind: string;
  label: string;
  amount_usd: number;
  running_user_capital_usd: number;
  running_from_profit_usd: number;
  running_withdrawn_usd: number;
  running_cash_usd: number;
  payment_method?: string | null;
  tx_hash?: string | null;
  payout_usd?: number;
  fee_usd?: number;
  source?: string;
  source_id?: number;
};

type StatementSummary = {
  user_capital_deposited_usd: number;
  admin_capital_usd: number;
  true_capital_invested_usd: number;
  deposit_from_profit_usd: number;
  affiliate_to_wallet_usd: number;
  total_withdrawn_usd: number;
  current_wallet_usd: number;
  implied_trading_pl_usd: number;
  settlements_net_usd: number;
  settlements_count: number;
  net_user_cash_out_usd: number;
  capital_still_at_risk_usd: number;
  loss_on_user_capital_usd: number;
  note?: string;
};

type Statement = {
  generated_at: string;
  user: { id: number; name?: string | null; email?: string | null; telegram?: string | null };
  summary: StatementSummary;
  entries: StatementEntry[];
};

function money(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function kindBadgeClass(kind: string) {
  switch (kind) {
    case "user_deposit":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "deposit_from_profit":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "admin_capital":
      return "border-indigo-200 bg-indigo-50 text-indigo-900";
    case "withdrawal":
      return "border-sky-200 bg-sky-50 text-sky-900";
    case "affiliate_transfer":
      return "border-violet-200 bg-violet-50 text-violet-900";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

const AdminCapitalStatementPage = () => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const userIdParam = searchParams.get("userId")?.trim() ?? "";
  const [userId, setUserId] = useState<number | null>(
    userIdParam && /^\d+$/.test(userIdParam) ? Number(userIdParam) : null,
  );
  const [statement, setStatement] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (uid: number | null) => {
      if (uid == null) {
        setStatement(null);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/admin/capital-statement?userId=${uid}`);
        const data = await res.json();
        if (!data.success) {
          setStatement(null);
          toast({
            title: "Could not load statement",
            description: data.error || "Unknown error",
            variant: "destructive",
          });
          return;
        }
        setStatement(data.statement as Statement);
      } catch {
        setStatement(null);
        toast({ title: "Network error", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    const uid = searchParams.get("userId")?.trim() ?? "";
    const next = uid && /^\d+$/.test(uid) ? Number(uid) : null;
    setUserId(next);
    void load(next);
  }, [searchParams, load]);

  const setUser = (id: number | null) => {
    const next = new URLSearchParams(searchParams);
    if (id == null) next.delete("userId");
    else next.set("userId", String(id));
    setSearchParams(next);
  };

  const s = statement?.summary;

  return (
    <div className="mx-auto max-w-6xl px-0 py-4 sm:px-2 md:px-6 md:py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <FileText className="h-6 w-6 text-slate-700" />
            Capital statement
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Bank-style view of true user capital vs deposits from profit, withdrawals, and implied
            trading P/L — so admin re-credits after profit withdrawals do not inflate investment.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit gap-2"
          disabled={loading || userId == null}
          onClick={() => void load(userId)}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="min-w-[16rem] flex-1 sm:max-w-md">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            User
          </label>
          <UserSearchSelect
            value={userId}
            onChange={(id) => setUser(id)}
            placeholder="Search name, email, or ID…"
            showClearOption
            clearOptionLabel="Select a user"
          />
        </div>
        {userId != null && (
          <>
            <Button type="button" variant="outline" className="h-10 gap-1.5" onClick={() => setUser(null)}>
              <X className="h-4 w-4" />
              Clear
            </Button>
            <Link
              to={`/admin/users/${userId}/trades`}
              className="inline-flex h-10 items-center rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Trades
            </Link>
            <Link
              to={`/admin/financial-stats?userId=${userId}`}
              className="inline-flex h-10 items-center rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Earnings
            </Link>
          </>
        )}
      </div>

      {loading && !statement ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : !userId ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-16 text-center text-slate-500">
          Select a user to open their capital statement.
        </div>
      ) : statement && s ? (
        <>
          <div className="mb-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{statement.user.name || "User"}</span>
            <span className="font-mono text-slate-500"> #{statement.user.id}</span>
            {statement.user.email ? <span className="text-slate-500"> · {statement.user.email}</span> : null}
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              title="User capital deposited"
              value={money(s.user_capital_deposited_usd)}
              sub="True investment from user"
              accent="emerald"
            />
            <SummaryCard
              title="Deposit from profit"
              value={money(s.deposit_from_profit_usd)}
              sub="Admin re-credit after profit withdrawn"
              accent="amber"
            />
            <SummaryCard
              title="Total withdrawn"
              value={money(s.total_withdrawn_usd)}
              sub={
                s.net_user_cash_out_usd >= 0
                  ? `User net cash out ${money(s.net_user_cash_out_usd)}`
                  : `Still net in ${money(-s.net_user_cash_out_usd)}`
              }
              accent="sky"
            />
            <SummaryCard
              title="Current wallet"
              value={money(s.current_wallet_usd)}
              sub={`Implied trade P/L ${money(s.implied_trading_pl_usd)}`}
              accent="slate"
            />
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <SummaryCard
              title="True capital invested"
              value={money(s.true_capital_invested_usd)}
              sub={`User ${money(s.user_capital_deposited_usd)} + admin capital ${money(s.admin_capital_usd)}`}
              accent="indigo"
            />
            <SummaryCard
              title="Loss on user capital"
              value={money(s.loss_on_user_capital_usd)}
              sub={
                s.loss_on_user_capital_usd <= 0.01
                  ? "0 — user already withdrew ≥ capital (rest was profit)"
                  : "User capital not yet recovered via withdraw/wallet"
              }
              accent={s.loss_on_user_capital_usd <= 0.01 ? "emerald" : "red"}
            />
            <SummaryCard
              title="Settlements (engine)"
              value={money(s.settlements_net_usd)}
              sub={`${s.settlements_count} settled trade(s)`}
              accent="slate"
            />
          </div>

          {s.note ? (
            <p className="mb-4 rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
              {s.note}
            </p>
          ) : null}

          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl shadow-neutral-900/8">
            <div className="border-b border-slate-100 px-4 py-3 sm:px-6">
              <h2 className="text-base font-semibold text-slate-800">Statement entries</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Chronological cash events · {statement.entries.length} row(s)
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/95">
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500 sm:px-6">Date</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500 sm:px-6">Entry</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase text-slate-500 sm:px-6">
                      Amount
                    </th>
                    <th className="hidden px-4 py-3 text-right text-xs font-bold uppercase text-slate-500 sm:table-cell sm:px-6">
                      Capital
                    </th>
                    <th className="hidden px-4 py-3 text-right text-xs font-bold uppercase text-slate-500 md:table-cell sm:px-6">
                      From profit
                    </th>
                    <th className="hidden px-4 py-3 text-right text-xs font-bold uppercase text-slate-500 lg:table-cell sm:px-6">
                      Withdrawn
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {statement.entries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                        No deposit or withdrawal events for this user.
                      </td>
                    </tr>
                  ) : (
                    statement.entries.map((e, i) => (
                      <tr key={`${e.at}-${e.source_id ?? i}`} className="border-b border-slate-100 hover:bg-yellow-50/30">
                        <td className="whitespace-nowrap px-4 py-3 text-sm tabular-nums text-slate-600 sm:px-6">
                          {fmtWhen(e.at)}
                        </td>
                        <td className="px-4 py-3 sm:px-6">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${kindBadgeClass(e.kind)}`}
                          >
                            {e.label}
                          </span>
                          {e.payment_method ? (
                            <div className="mt-1 text-[11px] text-slate-500">{e.payment_method}</div>
                          ) : null}
                          {e.tx_hash ? (
                            <div className="mt-0.5 max-w-[14rem] truncate font-mono text-[10px] text-slate-400">
                              {e.tx_hash}
                            </div>
                          ) : null}
                        </td>
                        <td
                          className={`px-4 py-3 text-right text-sm font-bold tabular-nums sm:px-6 ${plTextClass(e.amount_usd)}`}
                        >
                          {e.amount_usd >= 0 ? "+" : ""}
                          {money(e.amount_usd)}
                        </td>
                        <td className="hidden px-4 py-3 text-right text-sm tabular-nums text-slate-700 sm:table-cell sm:px-6">
                          {money(e.running_user_capital_usd)}
                        </td>
                        <td className="hidden px-4 py-3 text-right text-sm tabular-nums text-amber-800 md:table-cell sm:px-6">
                          {money(e.running_from_profit_usd)}
                        </td>
                        <td className="hidden px-4 py-3 text-right text-sm tabular-nums text-slate-700 lg:table-cell sm:px-6">
                          {money(e.running_withdrawn_usd)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

function SummaryCard({
  title,
  value,
  sub,
  accent,
}: {
  title: string;
  value: string;
  sub?: string;
  accent: "emerald" | "amber" | "sky" | "slate" | "indigo" | "red";
}) {
  const border =
    accent === "emerald"
      ? "border-emerald-200 bg-emerald-50/50"
      : accent === "amber"
        ? "border-amber-200 bg-amber-50/60"
        : accent === "sky"
          ? "border-sky-200 bg-sky-50/50"
          : accent === "indigo"
            ? "border-indigo-200 bg-indigo-50/40"
            : accent === "red"
              ? "border-red-200 bg-red-50/50"
              : "border-slate-200 bg-white";
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${border}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</p>
      <p className="mt-1 text-xl font-extrabold tabular-nums text-slate-900">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-600">{sub}</p> : null}
    </div>
  );
}

export default AdminCapitalStatementPage;
