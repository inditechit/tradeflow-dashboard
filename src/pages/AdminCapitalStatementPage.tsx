import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { FileText, Loader2, RefreshCw, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE } from "@/config/api";
import { UserSearchSelect } from "@/components/admin/UserSearchSelect";
import { AdminTableColumnPicker } from "@/components/admin/AdminTableColumnPicker";
import { Button } from "@/components/ui/button";
import { plTextClass } from "@/utils/plColors";
import {
  STATEMENT_BASELINE_COLUMNS,
  STATEMENT_BASELINE_COLUMNS_STORAGE_KEY,
  STATEMENT_ENTRIES_COLUMNS,
  STATEMENT_ENTRIES_COLUMNS_STORAGE_KEY,
  STATEMENT_TRADING_COLUMNS,
  STATEMENT_TRADING_COLUMNS_STORAGE_KEY,
  defaultStatementColumnVisibility,
  loadStatementColumnVisibility,
  saveStatementColumnVisibility,
  type StatementBaselineColumnId,
  type StatementEntriesColumnId,
  type StatementTradingColumnId,
} from "@/utils/adminCapitalStatementTableColumns";

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

type BaselinePeriod = {
  from: string | null;
  to: string | null;
  baseline_usd: number;
  reason: string;
  change_usd?: number;
  kind?: string;
  ongoing?: boolean;
};

type TradingRow = {
  at: string | null;
  ticket: string | null;
  symbol: string | null;
  user_share_usd: number;
  admin_share_usd: number;
  master_profit_usd: number | null;
  status: string;
  note?: string | null;
};

type StatementSummary = {
  user_capital_deposited_usd: number;
  admin_capital_usd: number;
  true_capital_invested_usd: number;
  deposit_from_profit_usd: number;
  affiliate_to_wallet_usd: number;
  total_withdrawn_usd: number;
  current_wallet_usd: number;
  current_trading_usd?: number;
  current_safe_usd?: number;
  deposit_baseline_usd?: number;
  settle_baseline_usd?: number;
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
  baseline_history?: BaselinePeriod[];
  trading?: TradingRow[];
};

function money(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function fmtDay(iso: string | null | undefined) {
  if (!iso) return "now";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function kindBadgeClass(kind: string) {
  switch (kind) {
    case "user_deposit":
    case "recharge":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "deposit_from_profit":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "admin_capital":
    case "admin_set":
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
  const [baselineColumnVisibility, setBaselineColumnVisibility] = useState(() =>
    loadStatementColumnVisibility(STATEMENT_BASELINE_COLUMNS_STORAGE_KEY, STATEMENT_BASELINE_COLUMNS),
  );
  const [entriesColumnVisibility, setEntriesColumnVisibility] = useState(() =>
    loadStatementColumnVisibility(STATEMENT_ENTRIES_COLUMNS_STORAGE_KEY, STATEMENT_ENTRIES_COLUMNS),
  );
  const [tradingColumnVisibility, setTradingColumnVisibility] = useState(() =>
    loadStatementColumnVisibility(STATEMENT_TRADING_COLUMNS_STORAGE_KEY, STATEMENT_TRADING_COLUMNS),
  );

  const showBaselineCol = useCallback(
    (id: StatementBaselineColumnId) => baselineColumnVisibility[id] === true,
    [baselineColumnVisibility],
  );
  const showEntriesCol = useCallback(
    (id: StatementEntriesColumnId) => entriesColumnVisibility[id] === true,
    [entriesColumnVisibility],
  );
  const showTradingCol = useCallback(
    (id: StatementTradingColumnId) => tradingColumnVisibility[id] === true,
    [tradingColumnVisibility],
  );

  const baselineVisibleCount = useMemo(
    () => STATEMENT_BASELINE_COLUMNS.filter((c) => showBaselineCol(c.id)).length,
    [showBaselineCol],
  );
  const entriesVisibleCount = useMemo(
    () => STATEMENT_ENTRIES_COLUMNS.filter((c) => showEntriesCol(c.id)).length,
    [showEntriesCol],
  );
  const tradingVisibleCount = useMemo(
    () => STATEMENT_TRADING_COLUMNS.filter((c) => showTradingCol(c.id)).length,
    [showTradingCol],
  );

  const handleBaselineColumnChange = useCallback(
    (next: Record<StatementBaselineColumnId, boolean>) => {
      setBaselineColumnVisibility(next);
      saveStatementColumnVisibility(STATEMENT_BASELINE_COLUMNS_STORAGE_KEY, next);
    },
    [],
  );
  const handleEntriesColumnChange = useCallback(
    (next: Record<StatementEntriesColumnId, boolean>) => {
      setEntriesColumnVisibility(next);
      saveStatementColumnVisibility(STATEMENT_ENTRIES_COLUMNS_STORAGE_KEY, next);
    },
    [],
  );
  const handleTradingColumnChange = useCallback(
    (next: Record<StatementTradingColumnId, boolean>) => {
      setTradingColumnVisibility(next);
      saveStatementColumnVisibility(STATEMENT_TRADING_COLUMNS_STORAGE_KEY, next);
    },
    [],
  );

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
  const baselineHistory = statement?.baseline_history ?? [];
  const trading = statement?.trading ?? [];

  return (
    <div className="mx-auto max-w-6xl px-0 py-4 sm:px-2 md:px-6 md:py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <FileText className="h-6 w-6 text-slate-700" />
            Capital statement
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Baseline history, capital cash events, then trading settlements at the bottom.
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

          {/* —— TOP: summary + baselines —— */}
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              title="Deposit baseline (now)"
              value={money(Number(s.deposit_baseline_usd ?? 0))}
              sub={
                s.settle_baseline_usd != null
                  ? `Exit settle floor ${money(Number(s.settle_baseline_usd))}`
                  : "Recovery baseline"
              }
              accent="indigo"
            />
            <SummaryCard
              title="Trading / Safe"
              value={money(Number(s.current_trading_usd ?? s.current_wallet_usd))}
              sub={`Safe ${money(Number(s.current_safe_usd ?? 0))}`}
              accent="slate"
            />
            <SummaryCard
              title="User capital deposited"
              value={money(s.user_capital_deposited_usd)}
              sub="True investment from user"
              accent="emerald"
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
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <SummaryCard
              title="Deposit from profit"
              value={money(s.deposit_from_profit_usd)}
              sub="Admin re-credit after profit withdrawn"
              accent="amber"
            />
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
                  ? "0 — user already withdrew ≥ capital"
                  : "User capital not yet recovered"
              }
              accent={s.loss_on_user_capital_usd <= 0.01 ? "emerald" : "red"}
            />
          </div>

          {s.note ? (
            <p className="mb-4 rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
              {s.note}
            </p>
          ) : null}

          {/* —— Baseline history —— */}
          <div className="mb-6 overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-indigo-100 bg-indigo-50/40 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Deposit baseline history</h2>
                <p className="mt-0.5 text-xs text-slate-600">
                  From this day → that day, baseline was this amount (recharge / withdraw / admin set).
                </p>
              </div>
              <AdminTableColumnPicker
                columns={STATEMENT_BASELINE_COLUMNS}
                visibility={baselineColumnVisibility}
                onChange={handleBaselineColumnChange}
                onReset={() =>
                  handleBaselineColumnChange(
                    defaultStatementColumnVisibility(STATEMENT_BASELINE_COLUMNS),
                  )
                }
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/95">
                    {STATEMENT_BASELINE_COLUMNS.filter((c) => showBaselineCol(c.id)).map((col) => (
                      <th
                        key={col.id}
                        className={`px-4 py-3 text-xs font-bold uppercase text-slate-500 sm:px-6 ${col.headerClassName ?? ""}`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {baselineHistory.length === 0 ? (
                    <tr>
                      <td colSpan={baselineVisibleCount || 1} className="px-6 py-10 text-center text-slate-500">
                        No baseline history for this user.
                      </td>
                    </tr>
                  ) : (
                    baselineHistory.map((p, i) => (
                      <tr
                        key={`${p.from}-${p.to}-${i}`}
                        className={`border-b border-slate-100 ${p.ongoing ? "bg-indigo-50/30" : "hover:bg-slate-50/80"}`}
                      >
                        {showBaselineCol("from") ? (
                          <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-700 sm:px-6">
                            {p.from ? fmtDay(p.from) : "start"}
                          </td>
                        ) : null}
                        {showBaselineCol("to") ? (
                          <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-700 sm:px-6">
                            {p.ongoing ? (
                              <span className="font-semibold text-indigo-800">now (current)</span>
                            ) : (
                              fmtDay(p.to)
                            )}
                          </td>
                        ) : null}
                        {showBaselineCol("baseline") ? (
                          <td className="px-4 py-3 text-right text-base font-extrabold tabular-nums text-slate-900 sm:px-6">
                            {money(p.baseline_usd)}
                          </td>
                        ) : null}
                        {showBaselineCol("reason") ? (
                          <td className="px-4 py-3 sm:px-6">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${kindBadgeClass(p.kind || "")}`}
                            >
                              {p.reason}
                            </span>
                            {p.change_usd != null && Math.abs(p.change_usd) > 0.009 ? (
                              <span
                                className={`ml-2 text-xs font-semibold tabular-nums ${plTextClass(p.change_usd)}`}
                              >
                                {p.change_usd >= 0 ? "+" : ""}
                                {money(p.change_usd)}
                              </span>
                            ) : null}
                          </td>
                        ) : null}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* —— Capital cash entries —— */}
          <div className="mb-6 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl shadow-neutral-900/8">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Capital cash entries</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Deposits, withdrawals, admin credits · {statement.entries.length} row(s)
                </p>
              </div>
              <AdminTableColumnPicker
                columns={STATEMENT_ENTRIES_COLUMNS}
                visibility={entriesColumnVisibility}
                onChange={handleEntriesColumnChange}
                onReset={() =>
                  handleEntriesColumnChange(
                    defaultStatementColumnVisibility(STATEMENT_ENTRIES_COLUMNS),
                  )
                }
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/95">
                    {STATEMENT_ENTRIES_COLUMNS.filter((c) => showEntriesCol(c.id)).map((col) => (
                      <th
                        key={col.id}
                        className={`px-4 py-3 text-xs font-bold uppercase text-slate-500 sm:px-6 ${col.headerClassName ?? ""}`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {statement.entries.length === 0 ? (
                    <tr>
                      <td colSpan={entriesVisibleCount || 1} className="px-6 py-12 text-center text-slate-500">
                        No deposit or withdrawal events for this user.
                      </td>
                    </tr>
                  ) : (
                    statement.entries.map((e, i) => (
                      <tr
                        key={`${e.at}-${e.source_id ?? i}`}
                        className="border-b border-slate-100 hover:bg-yellow-50/30"
                      >
                        {showEntriesCol("date") ? (
                          <td className="whitespace-nowrap px-4 py-3 text-sm tabular-nums text-slate-600 sm:px-6">
                            {fmtWhen(e.at)}
                          </td>
                        ) : null}
                        {showEntriesCol("entry") ? (
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
                        ) : null}
                        {showEntriesCol("amount") ? (
                          <td
                            className={`px-4 py-3 text-right text-sm font-bold tabular-nums sm:px-6 ${plTextClass(e.amount_usd)}`}
                          >
                            {e.amount_usd >= 0 ? "+" : ""}
                            {money(e.amount_usd)}
                          </td>
                        ) : null}
                        {showEntriesCol("capital") ? (
                          <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-700 sm:px-6">
                            {money(e.running_user_capital_usd)}
                          </td>
                        ) : null}
                        {showEntriesCol("from_profit") ? (
                          <td className="px-4 py-3 text-right text-sm tabular-nums text-amber-800 sm:px-6">
                            {money(e.running_from_profit_usd)}
                          </td>
                        ) : null}
                        {showEntriesCol("withdrawn") ? (
                          <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-700 sm:px-6">
                            {money(e.running_withdrawn_usd)}
                          </td>
                        ) : null}
                        {showEntriesCol("cash") ? (
                          <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-700 sm:px-6">
                            {money(e.running_cash_usd)}
                          </td>
                        ) : null}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* —— BOTTOM: trading —— */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Trading settlements</h2>
                <p className="mt-0.5 text-xs text-slate-600">
                  Settled trades for this user (newest first) · engine net{" "}
                  <span className="font-semibold tabular-nums">{money(s.settlements_net_usd)}</span>{" "}
                  across {s.settlements_count} trade(s) · implied P/L{" "}
                  <span className={`font-semibold tabular-nums ${plTextClass(s.implied_trading_pl_usd)}`}>
                    {money(s.implied_trading_pl_usd)}
                  </span>
                </p>
              </div>
              <AdminTableColumnPicker
                columns={STATEMENT_TRADING_COLUMNS}
                visibility={tradingColumnVisibility}
                onChange={handleTradingColumnChange}
                onReset={() =>
                  handleTradingColumnChange(
                    defaultStatementColumnVisibility(STATEMENT_TRADING_COLUMNS),
                  )
                }
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/95">
                    {STATEMENT_TRADING_COLUMNS.filter((c) => showTradingCol(c.id)).map((col) => (
                      <th
                        key={col.id}
                        className={`px-4 py-3 text-xs font-bold uppercase text-slate-500 sm:px-6 ${col.headerClassName ?? ""}`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trading.length === 0 ? (
                    <tr>
                      <td colSpan={tradingVisibleCount || 1} className="px-6 py-12 text-center text-slate-500">
                        No settled trades on record for this user.
                      </td>
                    </tr>
                  ) : (
                    trading.map((t, i) => (
                      <tr
                        key={`${t.ticket ?? "x"}-${t.at ?? i}`}
                        className="border-b border-slate-100 hover:bg-slate-50/80"
                      >
                        {showTradingCol("settled") ? (
                          <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-600 sm:px-6">
                            {fmtWhen(t.at)}
                          </td>
                        ) : null}
                        {showTradingCol("ticket") ? (
                          <td className="px-4 py-3 font-mono text-xs text-slate-800 sm:px-6">
                            {t.ticket ?? "—"}
                          </td>
                        ) : null}
                        {showTradingCol("symbol") ? (
                          <td className="px-4 py-3 text-slate-700 sm:px-6">{t.symbol ?? "—"}</td>
                        ) : null}
                        {showTradingCol("user_share") ? (
                          <td
                            className={`px-4 py-3 text-right font-semibold tabular-nums sm:px-6 ${plTextClass(t.user_share_usd)}`}
                          >
                            {money(t.user_share_usd)}
                          </td>
                        ) : null}
                        {showTradingCol("admin_share") ? (
                          <td className="px-4 py-3 text-right tabular-nums text-slate-700 sm:px-6">
                            {money(t.admin_share_usd)}
                          </td>
                        ) : null}
                        {showTradingCol("master_profit") ? (
                          <td
                            className={`px-4 py-3 text-right tabular-nums sm:px-6 ${plTextClass(t.master_profit_usd ?? 0)}`}
                          >
                            {t.master_profit_usd != null ? money(t.master_profit_usd) : "—"}
                          </td>
                        ) : null}
                        {showTradingCol("status") ? (
                          <td className="px-4 py-3 text-slate-600 sm:px-6">{t.status || "—"}</td>
                        ) : null}
                        {showTradingCol("note") ? (
                          <td className="max-w-[14rem] truncate px-4 py-3 text-xs text-slate-500 sm:px-6">
                            {t.note || "—"}
                          </td>
                        ) : null}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {userId != null ? (
              <div className="border-t border-slate-100 px-4 py-3 text-right sm:px-6">
                <Link
                  to={`/admin/users/${userId}/trades`}
                  className="text-sm font-semibold text-slate-800 underline"
                >
                  Open full trades page →
                </Link>
              </div>
            ) : null}
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
