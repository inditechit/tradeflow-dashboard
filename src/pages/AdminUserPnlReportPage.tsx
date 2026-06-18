import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  FileBarChart,
  Loader2,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Shield,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE } from "@/config/api";
import { UserSearchSelect } from "@/components/admin/UserSearchSelect";
import { plTextClass } from "@/utils/plColors";

type ReportUser = {
  id: number;
  name: string;
  email: string;
  trading_active: boolean;
  wallet_usd: number;
  deposit_baseline_usd: number;
};

type TradeRow = {
  assignment_id: number;
  ticket_id: string;
  status: string;
  close_time: string | null;
  open_time: string | null;
  mt5_profit: number;
  volume_share_pct: number;
  display_pl_usd: number;
  admin_profit_pct: number;
  user_kept_pct: number;
  assign_fee_usd: number;
  settlement_usd: number;
  total_wallet_impact_usd: number;
  admin_absorbed: boolean;
  fee_exceeds_display: boolean;
};

type UserReport = {
  user: ReportUser;
  wallet_composition: {
    by_group: Record<string, { total_usd: number; row_count: number }>;
    pl_vs_deposit_usd: number;
  };
  trading_control: {
    trading_active_now: boolean;
    last_stopped_at: string | null;
    last_restarted_at: string | null;
    never_restarted_since_last_stop: boolean;
    events: Array<{ type: string; at: string; note?: string; source?: string }>;
  };
  cap_profile: {
    is_year_pack: boolean;
    wallet_cap_usd?: number | null;
    profit_gate_usd?: number | null;
    gate_unlocked?: boolean | null;
    cap_savings_usd?: number;
    room_to_cap_usd?: number;
    effective_user_pct_now?: number;
  };
  open_assigns_diagnosis: {
    open_count: number;
    assigns: Array<{
      assignment_id: number;
      ticket_id: string;
      assign_created_at: string;
      absorbed_by_admin_on_close: boolean;
      reason: string;
      needs_review: boolean;
      mt5_profit: number;
    }>;
    notes: string[];
  };
  recharges: { total_usd: number; count: number };
  summary: {
    trade_count: number;
    open_count: number;
    closed_count: number;
    total_profit_display_usd: number;
    total_loss_display_usd: number;
    net_display_pl_usd: number;
    total_assign_fees_usd: number;
    total_settlement_usd: number;
    total_wallet_impact_usd: number;
    absorbed_assign_count: number;
  };
  trades: TradeRow[];
  trade_total: number;
  ledger_timeline: Array<{
    id: number;
    delta_usd: number;
    balance_after: number;
    entry_type: string;
    note: string | null;
    created_at: string;
  }>;
  narrative: string[];
};

type CompareUser = {
  user_id: number;
  name: string;
  wallet_usd: number;
  deposit_usd: number;
  trading_active: boolean;
  last_stopped_at: string | null;
  last_restarted_at: string | null;
  open_assigns: number;
  total_fees_usd: number;
  cap_savings_usd: number;
  is_year_pack: boolean;
  gate_unlocked: boolean | null;
  net_display_pl_usd: number;
  total_wallet_impact_usd: number;
  trade_count: number;
};

const REASON_LABELS: Record<string, string> = {
  absorbed_at_stop: "Stopped — admin absorbs on close",
  assigned_after_restart: "Assigned after restart",
  assigned_after_restart_while_now_stopped: "After restart, now stopped again",
  assigned_after_stop_without_absorb_marker: "After stop — no absorb marker (review)",
  open_before_stop_not_absorbed: "Open before stop — not absorbed (review)",
  open_on_mt5: "Open on MT5",
};

function fmt(n: number | undefined | null) {
  return Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toIsoDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  valueClass,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${valueClass ?? "text-slate-900"}`}>{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
        </div>
        <Icon className="h-5 w-5 shrink-0 text-slate-400" />
      </div>
    </div>
  );
}

const AdminUserPnlReportPage = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [userId, setUserId] = useState<number | null>(null);
  const [compareUserId, setCompareUserId] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [ticket, setTicket] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<UserReport | null>(null);
  const [compareRows, setCompareRows] = useState<CompareUser[] | null>(null);
  const [compareNotes, setCompareNotes] = useState<string[]>([]);
  const [walletGap, setWalletGap] = useState<number | null>(null);

  useEffect(() => {
    const u = searchParams.get("user") || searchParams.get("user_id");
    const c = searchParams.get("compare") || searchParams.get("compare_users");
    if (u && /^\d+$/.test(u)) setUserId(Number(u));
    if (c && /^\d+$/.test(c)) setCompareUserId(Number(c));
  }, [searchParams]);

  const runReport = useCallback(async () => {
    if (!userId) {
      toast({ title: "Select a user", variant: "destructive" });
      return;
    }
    setLoading(true);
    setReport(null);
    setCompareRows(null);
    setCompareNotes([]);
    setWalletGap(null);

    try {
      const qs = new URLSearchParams();
      if (compareUserId) qs.set("compare_users", `${userId},${compareUserId}`);
      else qs.set("user_id", String(userId));
      if (dateFrom) qs.set("date_from", `${dateFrom}T00:00:00.000Z`);
      if (dateTo) qs.set("date_to", `${dateTo}T23:59:59.999Z`);
      if (ticket.trim()) qs.set("ticket", ticket.trim());

      const res = await fetch(`${API_BASE}/admin/reports/user-pnl?${qs}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Report failed");

      if (data.comparison && Array.isArray(data.reports)) {
        const primary = data.reports.find((r: UserReport) => r.user?.id === userId) ?? data.reports[0];
        setReport(primary);
        setCompareRows(data.comparison.users ?? []);
        setCompareNotes(data.comparison.notes ?? []);
        setWalletGap(data.comparison.wallet_gap_usd ?? null);
      } else if (data.report) {
        setReport(data.report);
      }
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Could not load report",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [userId, compareUserId, dateFrom, dateTo, ticket, toast]);

  useEffect(() => {
    if (userId) void runReport();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- initial load from URL only

  const setQuickRange = (days: number | null) => {
    if (days == null) {
      setDateFrom("");
      setDateTo("");
      return;
    }
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setDateFrom(toIsoDateInput(start));
    setDateTo(toIsoDateInput(end));
  };

  const wc = report?.wallet_composition?.by_group ?? {};
  const tc = report?.trading_control;
  const cap = report?.cap_profile;
  const openDx = report?.open_assigns_diagnosis;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <FileBarChart className="h-7 w-7 text-[#E6B800]" />
          User P/L report
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Full wallet breakdown: fees, cap savings, stop/restart history, open assigns diagnosis.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-slate-500">Primary user</label>
            <UserSearchSelect value={userId} onChange={(id) => setUserId(id)} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Compare with (optional)</label>
            <UserSearchSelect value={compareUserId} onChange={(id) => setCompareUserId(id)} placeholder="e.g. #125" />
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <input type="date" className="rounded-lg border px-3 py-2 text-sm text-black" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <input type="date" className="rounded-lg border px-3 py-2 text-sm text-black" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <input className="w-36 rounded-lg border px-3 py-2 text-sm text-black" placeholder="Ticket" value={ticket} onChange={(e) => setTicket(e.target.value)} />
          <button type="button" onClick={() => setQuickRange(7)} className="rounded-lg border px-3 py-2 text-xs">7d</button>
          <button type="button" onClick={() => setQuickRange(30)} className="rounded-lg border px-3 py-2 text-xs">30d</button>
          <button type="button" onClick={() => setQuickRange(null)} className="rounded-lg border px-3 py-2 text-xs">All</button>
          <button
            type="button"
            onClick={() => void runReport()}
            disabled={loading || !userId}
            className="flex items-center gap-2 rounded-lg bg-[#FFD700] px-5 py-2 text-sm font-semibold text-black disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Run report
          </button>
        </div>
      </div>

      {loading && !report && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
        </div>
      )}

      {report && (
        <>
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-800">
                {report.user.name || "User"} · #{report.user.id}
              </p>
              {report.user.trading_active ? (
                <span className="flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                  <PlayCircle className="h-3 w-3" /> Trading active
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                  <PauseCircle className="h-3 w-3" /> Stop trading
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-slate-700">
              Wallet <span className="font-mono font-semibold">${fmt(report.user.wallet_usd)}</span>
              {" · "}Deposit ${fmt(report.user.deposit_baseline_usd)}
              {" · "}P/L vs deposit{" "}
              <span className={`font-mono font-semibold ${plTextClass(report.wallet_composition.pl_vs_deposit_usd)}`}>
                ${fmt(report.wallet_composition.pl_vs_deposit_usd)}
              </span>
            </p>
          </div>

          {tc && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-semibold text-slate-800">Stop / restart history</h2>
              <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
                <p>
                  <span className="text-slate-500">Last stopped:</span>{" "}
                  {tc.last_stopped_at ? new Date(tc.last_stopped_at).toLocaleString() : "—"}
                </p>
                <p>
                  <span className="text-slate-500">Last restarted:</span>{" "}
                  {tc.last_restarted_at ? new Date(tc.last_restarted_at).toLocaleString() : "Never / not recorded"}
                </p>
                <p>
                  <span className="text-slate-500">Status:</span>{" "}
                  {tc.never_restarted_since_last_stop ? "Stopped, not restarted" : tc.trading_active_now ? "Active" : "Stopped"}
                </p>
              </div>
              {tc.events.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600">
                  {tc.events.map((ev, i) => (
                    <li key={i}>
                      <span className={ev.type === "stopped" ? "text-amber-700" : "text-emerald-700"}>
                        {ev.type === "stopped" ? "STOP" : "RESTART"}
                      </span>{" "}
                      {new Date(ev.at).toLocaleString()}
                      {ev.source === "inferred" && <span className="text-slate-400"> (inferred)</span>}
                      {ev.note ? ` — ${ev.note}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {compareRows && compareRows.length >= 2 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b px-4 py-3">
                <h2 className="font-semibold text-slate-800">User comparison</h2>
                {walletGap != null && <p className="text-xs text-slate-500">Wallet gap: ${fmt(walletGap)}</p>}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-slate-600">
                    <th className="p-3 font-semibold">User</th>
                    <th className="p-3 font-semibold">Trading</th>
                    <th className="p-3 font-semibold">Wallet</th>
                    <th className="p-3 font-semibold">Fees</th>
                    <th className="p-3 font-semibold">Cap saved</th>
                    <th className="p-3 font-semibold">Open</th>
                    <th className="p-3 font-semibold">Net P/L</th>
                    <th className="p-3 font-semibold">Wallet Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {compareRows.map((r) => (
                    <tr key={r.user_id} className="border-t border-slate-100">
                      <td className="p-3">{r.name} #{r.user_id}{r.is_year_pack && <span className="ml-1 text-[10px] text-purple-600">1yr</span>}</td>
                      <td className="p-3">{r.trading_active ? "Active" : "Stopped"}</td>
                      <td className="p-3 font-mono">${fmt(r.wallet_usd)}</td>
                      <td className="p-3 font-mono text-red-600">${fmt(r.total_fees_usd)}</td>
                      <td className="p-3 font-mono text-emerald-600">${fmt(r.cap_savings_usd)}</td>
                      <td className="p-3">{r.open_assigns}</td>
                      <td className={`p-3 font-mono ${plTextClass(r.net_display_pl_usd)}`}>${fmt(r.net_display_pl_usd)}</td>
                      <td className={`p-3 font-mono ${plTextClass(r.total_wallet_impact_usd)}`}>${fmt(r.total_wallet_impact_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {compareNotes.map((n, i) => (
                <p key={i} className="border-t px-4 py-2 text-xs text-slate-600">{n}</p>
              ))}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total profit" value={`$${fmt(report.summary.total_profit_display_usd)}`} icon={TrendingUp} valueClass="text-emerald-600" />
            <StatCard title="Total loss" value={`$${fmt(report.summary.total_loss_display_usd)}`} icon={TrendingDown} valueClass="text-red-600" />
            <StatCard title="Assign fees" value={`$${fmt(report.summary.total_assign_fees_usd)}`} sub="Lot-based at open" icon={Wallet} valueClass="text-red-600" />
            <StatCard
              title="Cap savings"
              value={cap?.is_year_pack ? `$${fmt(cap.cap_savings_usd)}` : "N/A"}
              sub={cap?.is_year_pack ? (cap.gate_unlocked ? "Gate unlocked" : `Room to cap $${fmt(cap.room_to_cap_usd)}`) : "Not year-pack"}
              icon={Shield}
              valueClass="text-emerald-600"
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-slate-800">Wallet composition (ledger)</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(wc).map(([group, v]) => (
                <div key={group} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                  <p className="text-xs font-medium uppercase text-slate-500">{group.replace(/_/g, " ")}</p>
                  <p className={`mt-1 font-mono text-lg font-semibold ${plTextClass(v.total_usd)}`}>${fmt(v.total_usd)}</p>
                  <p className="text-[10px] text-slate-400">{v.row_count} entries</p>
                </div>
              ))}
            </div>
          </div>

          {cap?.is_year_pack && (
            <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-4">
              <h2 className="font-semibold text-slate-800">Year-pack cap</h2>
              <p className="mt-1 text-sm text-slate-700">
                Cap ${fmt(cap.wallet_cap_usd)} (deposit + ${fmt(cap.profit_gate_usd)}) · User keeps {cap.effective_user_pct_now}% on wins ·
                Total saved by cap: <span className="font-mono font-semibold text-emerald-700">${fmt(cap.cap_savings_usd)}</span>
              </p>
            </div>
          )}

          {openDx && openDx.open_count > 0 && (
            <div className="overflow-x-auto rounded-xl border border-amber-200 bg-amber-50/30 shadow-sm">
              <div className="border-b border-amber-100 px-4 py-3">
                <h2 className="font-semibold text-slate-800">Open assigns ({openDx.open_count})</h2>
                <p className="text-xs text-slate-600">
                  Stopped users can still have open assigns — absorbed ones are expected; user gets $0 on close.
                </p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-slate-600">
                    <th className="p-3">Ticket</th>
                    <th className="p-3">Assigned</th>
                    <th className="p-3">MT5 P/L</th>
                    <th className="p-3">Absorbed</th>
                    <th className="p-3">Why still assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {openDx.assigns.map((a) => (
                    <tr key={a.assignment_id} className={`border-t ${a.needs_review ? "bg-red-50/50" : ""}`}>
                      <td className="p-3 font-mono text-xs">{a.ticket_id}</td>
                      <td className="p-3 text-xs">{new Date(a.assign_created_at).toLocaleString()}</td>
                      <td className={`p-3 font-mono ${plTextClass(a.mt5_profit)}`}>${fmt(a.mt5_profit)}</td>
                      <td className="p-3">{a.absorbed_by_admin_on_close ? "Yes" : "No"}</td>
                      <td className="p-3 text-xs">{REASON_LABELS[a.reason] ?? a.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {report.narrative.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <h2 className="flex items-center gap-2 font-semibold text-slate-800">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                Admin explanation
              </h2>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-700">
                {report.narrative.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-semibold text-slate-800">Trades</h2>
              <span className="text-xs text-slate-500">{report.trades.length} / {report.trade_total}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-600">
                  <th className="p-3">Ticket</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Share</th>
                  <th className="p-3">Display P/L</th>
                  <th className="p-3">User %</th>
                  <th className="p-3">Fee</th>
                  <th className="p-3">Settlement</th>
                  <th className="p-3">Wallet impact</th>
                </tr>
              </thead>
              <tbody>
                {report.trades.map((t) => (
                  <tr key={t.assignment_id} className={`border-t ${t.fee_exceeds_display ? "bg-amber-50/40" : ""}`}>
                    <td className="p-3 font-mono text-xs">
                      {t.ticket_id}
                      {t.admin_absorbed && <span className="ml-1 rounded bg-purple-100 px-1 text-[10px]">absorbed</span>}
                    </td>
                    <td className="p-3 capitalize">{t.status}</td>
                    <td className="p-3 font-mono">{t.volume_share_pct.toFixed(2)}%</td>
                    <td className={`p-3 font-mono ${plTextClass(t.display_pl_usd)}`}>${fmt(t.display_pl_usd)}</td>
                    <td className="p-3 font-mono text-xs">{t.user_kept_pct}%</td>
                    <td className="p-3 font-mono">${fmt(t.assign_fee_usd)}</td>
                    <td className={`p-3 font-mono ${plTextClass(t.settlement_usd)}`}>${fmt(t.settlement_usd)}</td>
                    <td className={`p-3 font-mono font-semibold ${plTextClass(t.total_wallet_impact_usd)}`}>${fmt(t.total_wallet_impact_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {report.ledger_timeline.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b px-4 py-3 font-semibold text-slate-800">Wallet ledger (period)</div>
              <table className="w-full text-sm">
                <tbody>
                  {report.ledger_timeline.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="p-2 text-xs text-slate-500 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                      <td className={`p-2 font-mono ${plTextClass(r.delta_usd)}`}>{r.delta_usd >= 0 ? "+" : ""}{fmt(r.delta_usd)}</td>
                      <td className="p-2 text-xs">{r.entry_type}</td>
                      <td className="p-2 text-xs text-slate-600 truncate max-w-[200px]">{r.note ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminUserPnlReportPage;
