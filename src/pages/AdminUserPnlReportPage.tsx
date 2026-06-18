import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  FileBarChart,
  Loader2,
  PauseCircle,
  PlayCircle,
  RefreshCw,
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
  display_pl_usd: number;
  volume_share_pct: number;
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
  narrative: string[];
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

function money(n: number | undefined | null, colored = true) {
  const v = Number(n ?? 0);
  return (
    <span className={`font-mono font-semibold tabular-nums ${colored ? plTextClass(v) : ""}`}>
      ${fmt(v)}
    </span>
  );
}

function toIsoDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

function UserHeader({ r }: { r: UserReport }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-bold text-slate-900">
        {r.user.name || "User"} <span className="text-slate-500">#{r.user.id}</span>
      </p>
      <p className="truncate text-xs text-slate-500">{r.user.email}</p>
      <div className="mt-1.5">
        {r.user.trading_active ? (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
            <PlayCircle className="h-3 w-3" /> Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
            <PauseCircle className="h-3 w-3" /> Stopped
          </span>
        )}
        {r.cap_profile.is_year_pack && (
          <span className="ml-1 rounded bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
            1-year pack
          </span>
        )}
      </div>
    </div>
  );
}

function CompareRow({
  label,
  left,
  right,
  diff,
  highlight,
}: {
  label: string;
  left: React.ReactNode;
  right: React.ReactNode;
  diff?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[minmax(8rem,1fr)_1fr_1fr_5.5rem] gap-3 border-b border-slate-100 px-4 py-2.5 text-sm last:border-b-0 ${highlight ? "bg-amber-50/40" : ""}`}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500 self-center">{label}</div>
      <div className="min-w-0 self-center">{left}</div>
      <div className="min-w-0 self-center">{right}</div>
      <div className="hidden text-right text-xs font-mono text-slate-500 self-center sm:block">{diff ?? "—"}</div>
    </div>
  );
}

function diffMoney(a: number, b: number) {
  const d = round2(a - b);
  if (Math.abs(d) < 0.01) return <span>—</span>;
  return <span className={plTextClass(d)}>{d >= 0 ? "+" : ""}{fmt(d)}</span>;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function SideBySideCompare({
  left,
  right,
  notes,
  walletGap,
}: {
  left: UserReport;
  right: UserReport;
  notes: string[];
  walletGap: number | null;
}) {
  const walletGroups = useMemo(() => {
    const keys = new Set([
      ...Object.keys(left.wallet_composition.by_group ?? {}),
      ...Object.keys(right.wallet_composition.by_group ?? {}),
    ]);
    return [...keys].sort();
  }, [left, right]);

  return (
    <div className="space-y-6">
      {walletGap != null && (
        <div className="rounded-xl border border-[#FFD700]/40 bg-[#FFF9E6] px-4 py-3 text-sm text-slate-800">
          Wallet gap (higher − lower): <span className="font-mono font-bold">${fmt(walletGap)}</span>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-[minmax(8rem,1fr)_1fr_1fr_5.5rem] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-xs font-semibold uppercase text-slate-500">Metric</div>
          <UserHeader r={left} />
          <UserHeader r={right} />
          <div className="hidden text-right text-xs font-semibold uppercase text-slate-500 sm:block">Δ</div>
        </div>

        <CompareRow
          label="Wallet balance"
          left={money(left.user.wallet_usd)}
          right={money(right.user.wallet_usd)}
          diff={diffMoney(left.user.wallet_usd, right.user.wallet_usd)}
          highlight
        />
        <CompareRow
          label="Deposit baseline"
          left={money(left.user.deposit_baseline_usd, false)}
          right={money(right.user.deposit_baseline_usd, false)}
          diff={diffMoney(left.user.deposit_baseline_usd, right.user.deposit_baseline_usd)}
        />
        <CompareRow
          label="P/L vs deposit"
          left={money(left.wallet_composition.pl_vs_deposit_usd)}
          right={money(right.wallet_composition.pl_vs_deposit_usd)}
          diff={diffMoney(left.wallet_composition.pl_vs_deposit_usd, right.wallet_composition.pl_vs_deposit_usd)}
          highlight
        />
        <CompareRow
          label="Recharges (period)"
          left={money(left.recharges.total_usd, false)}
          right={money(right.recharges.total_usd, false)}
          diff={diffMoney(left.recharges.total_usd, right.recharges.total_usd)}
        />
        <CompareRow
          label="Total profit"
          left={money(left.summary.total_profit_display_usd)}
          right={money(right.summary.total_profit_display_usd)}
          diff={diffMoney(left.summary.total_profit_display_usd, right.summary.total_profit_display_usd)}
        />
        <CompareRow
          label="Total loss"
          left={money(left.summary.total_loss_display_usd)}
          right={money(right.summary.total_loss_display_usd)}
          diff={diffMoney(left.summary.total_loss_display_usd, right.summary.total_loss_display_usd)}
        />
        <CompareRow
          label="Net display P/L"
          left={money(left.summary.net_display_pl_usd)}
          right={money(right.summary.net_display_pl_usd)}
          diff={diffMoney(left.summary.net_display_pl_usd, right.summary.net_display_pl_usd)}
          highlight
        />
        <CompareRow
          label="Assign fees"
          left={money(-Math.abs(left.summary.total_assign_fees_usd))}
          right={money(-Math.abs(right.summary.total_assign_fees_usd))}
          diff={diffMoney(left.summary.total_assign_fees_usd, right.summary.total_assign_fees_usd)}
        />
        <CompareRow
          label="Settlements"
          left={money(left.summary.total_settlement_usd)}
          right={money(right.summary.total_settlement_usd)}
          diff={diffMoney(left.summary.total_settlement_usd, right.summary.total_settlement_usd)}
        />
        <CompareRow
          label="Wallet impact"
          left={money(left.summary.total_wallet_impact_usd)}
          right={money(right.summary.total_wallet_impact_usd)}
          diff={diffMoney(left.summary.total_wallet_impact_usd, right.summary.total_wallet_impact_usd)}
          highlight
        />
        <CompareRow
          label="Cap savings"
          left={
            left.cap_profile.is_year_pack ? money(left.cap_profile.cap_savings_usd) : <span className="text-slate-400">N/A</span>
          }
          right={
            right.cap_profile.is_year_pack ? money(right.cap_profile.cap_savings_usd) : <span className="text-slate-400">N/A</span>
          }
          diff={
            left.cap_profile.is_year_pack || right.cap_profile.is_year_pack
              ? diffMoney(left.cap_profile.cap_savings_usd ?? 0, right.cap_profile.cap_savings_usd ?? 0)
              : "—"
          }
        />
        <CompareRow
          label="Trades (filter)"
          left={<span>{left.summary.trade_count} <span className="text-slate-400">({left.summary.closed_count} closed)</span></span>}
          right={<span>{right.summary.trade_count} <span className="text-slate-400">({right.summary.closed_count} closed)</span></span>}
          diff={<span>{left.summary.trade_count - right.summary.trade_count >= 0 ? "+" : ""}{left.summary.trade_count - right.summary.trade_count}</span>}
        />
        <CompareRow
          label="Open assigns"
          left={<span>{left.open_assigns_diagnosis.open_count}</span>}
          right={<span>{right.open_assigns_diagnosis.open_count}</span>}
          diff={<span>{left.open_assigns_diagnosis.open_count - right.open_assigns_diagnosis.open_count}</span>}
        />
        <CompareRow
          label="Last stopped"
          left={
            <span className="text-xs">
              {left.trading_control.last_stopped_at
                ? new Date(left.trading_control.last_stopped_at).toLocaleString()
                : "—"}
            </span>
          }
          right={
            <span className="text-xs">
              {right.trading_control.last_stopped_at
                ? new Date(right.trading_control.last_stopped_at).toLocaleString()
                : "—"}
            </span>
          }
        />
        <CompareRow
          label="Last restarted"
          left={
            <span className="text-xs">
              {left.trading_control.last_restarted_at
                ? new Date(left.trading_control.last_restarted_at).toLocaleString()
                : "Never"}
            </span>
          }
          right={
            <span className="text-xs">
              {right.trading_control.last_restarted_at
                ? new Date(right.trading_control.last_restarted_at).toLocaleString()
                : "Never"}
            </span>
          }
        />
        {left.cap_profile.is_year_pack || right.cap_profile.is_year_pack ? (
          <>
            <CompareRow
              label="Wallet cap"
              left={
                left.cap_profile.is_year_pack ? money(left.cap_profile.wallet_cap_usd ?? 0, false) : <span className="text-slate-400">—</span>
              }
              right={
                right.cap_profile.is_year_pack ? money(right.cap_profile.wallet_cap_usd ?? 0, false) : <span className="text-slate-400">—</span>
              }
            />
            <CompareRow
              label="Gate status"
              left={
                left.cap_profile.is_year_pack
                  ? left.cap_profile.gate_unlocked
                    ? "Unlocked (50/50)"
                    : "Locked (100%)"
                  : "—"
              }
              right={
                right.cap_profile.is_year_pack
                  ? right.cap_profile.gate_unlocked
                    ? "Unlocked (50/50)"
                    : "Locked (100%)"
                  : "—"
              }
            />
          </>
        ) : null}
      </div>

      {walletGroups.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b px-4 py-3 font-semibold text-slate-800">Wallet ledger breakdown</div>
          <div className="grid grid-cols-[minmax(8rem,1fr)_1fr_1fr_5.5rem] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500">
            <div>Category</div>
            <div>#{left.user.id}</div>
            <div>#{right.user.id}</div>
            <div className="hidden sm:block text-right">Δ</div>
          </div>
          {walletGroups.map((g) => {
            const lv = left.wallet_composition.by_group[g]?.total_usd ?? 0;
            const rv = right.wallet_composition.by_group[g]?.total_usd ?? 0;
            return (
              <CompareRow
                key={g}
                label={g.replace(/_/g, " ")}
                left={money(lv)}
                right={money(rv)}
                diff={diffMoney(lv, rv)}
              />
            );
          })}
        </div>
      )}

      {notes.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <h2 className="flex items-center gap-2 font-semibold text-slate-800">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            Comparison notes
          </h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-700">
            {notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {[left, right].map((r) => (
          <div key={r.user.id} className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b px-4 py-3">
              <p className="font-semibold text-slate-800">Admin notes — #{r.user.id}</p>
            </div>
            <ul className="max-h-48 overflow-y-auto p-4 text-xs leading-relaxed text-slate-700 list-disc list-inside space-y-1">
              {r.narrative.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {[left, right].map((r) => (
          <div key={r.user.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-semibold text-slate-800">Trades — #{r.user.id}</h2>
              <span className="text-xs text-slate-500">
                {r.trades.length} / {r.trade_total}
              </span>
            </div>
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-left text-slate-600">
                    <th className="p-2">Ticket</th>
                    <th className="p-2">P/L</th>
                    <th className="p-2">Fee</th>
                    <th className="p-2">Wallet</th>
                  </tr>
                </thead>
                <tbody>
                  {r.trades.map((t) => (
                    <tr key={t.assignment_id} className={`border-t ${t.fee_exceeds_display ? "bg-amber-50/50" : ""}`}>
                      <td className="p-2 font-mono">
                        {t.ticket_id}
                        {t.admin_absorbed && <span className="ml-0.5 text-[9px] text-purple-600">abs</span>}
                      </td>
                      <td className={`p-2 font-mono ${plTextClass(t.display_pl_usd)}`}>${fmt(t.display_pl_usd)}</td>
                      <td className="p-2 font-mono">${fmt(t.assign_fee_usd)}</td>
                      <td className={`p-2 font-mono font-semibold ${plTextClass(t.total_wallet_impact_usd)}`}>
                        ${fmt(t.total_wallet_impact_usd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {(left.open_assigns_diagnosis.open_count > 0 || right.open_assigns_diagnosis.open_count > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {[left, right].map((r) => (
            <div key={r.user.id} className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/20 shadow-sm">
              <div className="border-b border-amber-100 px-4 py-3">
                <h2 className="font-semibold text-slate-800">
                  Open assigns — #{r.user.id} ({r.open_assigns_diagnosis.open_count})
                </h2>
              </div>
              {r.open_assigns_diagnosis.open_count === 0 ? (
                <p className="p-4 text-sm text-slate-500">No open assigns</p>
              ) : (
                <div className="max-h-56 overflow-auto">
                  <table className="w-full text-xs">
                    <tbody>
                      {r.open_assigns_diagnosis.assigns.map((a) => (
                        <tr key={a.assignment_id} className={`border-t border-amber-100 ${a.needs_review ? "bg-red-50/50" : ""}`}>
                          <td className="p-2 font-mono">{a.ticket_id}</td>
                          <td className={`p-2 font-mono ${plTextClass(a.mt5_profit)}`}>${fmt(a.mt5_profit)}</td>
                          <td className="p-2">{a.absorbed_by_admin_on_close ? "Absorbed" : "—"}</td>
                          <td className="p-2 text-slate-600">{REASON_LABELS[a.reason] ?? a.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SingleUserReport({ report }: { report: UserReport }) {
  const wc = report.wallet_composition.by_group ?? {};
  const tc = report.trading_control;
  const cap = report.cap_profile;
  const openDx = report.open_assigns_diagnosis;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
        <UserHeader r={report} />
        <p className="mt-3 text-sm text-slate-700">
          Wallet {money(report.user.wallet_usd)} · Deposit {money(report.user.deposit_baseline_usd, false)} · P/L vs
          deposit {money(report.wallet_composition.pl_vs_deposit_usd)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Total profit", report.summary.total_profit_display_usd],
          ["Total loss", report.summary.total_loss_display_usd],
          ["Net P/L", report.summary.net_display_pl_usd],
          ["Wallet impact", report.summary.total_wallet_impact_usd],
        ].map(([label, val]) => (
          <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${plTextClass(Number(val))}`}>${fmt(Number(val))}</p>
          </div>
        ))}
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
              {tc.last_restarted_at ? new Date(tc.last_restarted_at).toLocaleString() : "Never"}
            </p>
            <p>
              <span className="text-slate-500">Status:</span>{" "}
              {tc.never_restarted_since_last_stop ? "Stopped, not restarted" : tc.trading_active_now ? "Active" : "Stopped"}
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-slate-800">Wallet composition</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(wc).map(([group, v]) => (
            <div key={group} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
              <p className="text-xs font-medium uppercase text-slate-500">{group.replace(/_/g, " ")}</p>
              <p className={`mt-1 font-mono text-lg font-semibold ${plTextClass(v.total_usd)}`}>${fmt(v.total_usd)}</p>
            </div>
          ))}
        </div>
      </div>

      {cap?.is_year_pack && (
        <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-4 text-sm text-slate-700">
          Year-pack cap ${fmt(cap.wallet_cap_usd)} · Saved by cap {money(cap.cap_savings_usd)}
        </div>
      )}

      {report.narrative.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <h2 className="font-semibold text-slate-800">Admin explanation</h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-700">
            {report.narrative.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {openDx.open_count > 0 && (
        <div className="overflow-x-auto rounded-xl border border-amber-200 bg-amber-50/30 shadow-sm">
          <div className="border-b px-4 py-3 font-semibold">Open assigns ({openDx.open_count})</div>
          <table className="w-full text-sm">
            <tbody>
              {openDx.assigns.map((a) => (
                <tr key={a.assignment_id} className="border-t">
                  <td className="p-2 font-mono text-xs">{a.ticket_id}</td>
                  <td className={`p-2 font-mono ${plTextClass(a.mt5_profit)}`}>${fmt(a.mt5_profit)}</td>
                  <td className="p-2 text-xs">{REASON_LABELS[a.reason] ?? a.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b px-4 py-3 font-semibold">
          Trades ({report.trades.length}/{report.trade_total})
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-600">
              <th className="p-3">Ticket</th>
              <th className="p-3">Display P/L</th>
              <th className="p-3">Fee</th>
              <th className="p-3">Settlement</th>
              <th className="p-3">Wallet impact</th>
            </tr>
          </thead>
          <tbody>
            {report.trades.map((t) => (
              <tr key={t.assignment_id} className="border-t">
                <td className="p-3 font-mono text-xs">{t.ticket_id}</td>
                <td className={`p-3 font-mono ${plTextClass(t.display_pl_usd)}`}>${fmt(t.display_pl_usd)}</td>
                <td className="p-3 font-mono">${fmt(t.assign_fee_usd)}</td>
                <td className={`p-3 font-mono ${plTextClass(t.settlement_usd)}`}>${fmt(t.settlement_usd)}</td>
                <td className={`p-3 font-mono font-semibold ${plTextClass(t.total_wallet_impact_usd)}`}>
                  ${fmt(t.total_wallet_impact_usd)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
  const [reports, setReports] = useState<UserReport[]>([]);
  const [compareNotes, setCompareNotes] = useState<string[]>([]);
  const [walletGap, setWalletGap] = useState<number | null>(null);

  useEffect(() => {
    const u = searchParams.get("user") || searchParams.get("user_id");
    const c = searchParams.get("compare") || searchParams.get("compare_users");
    if (u && /^\d+$/.test(u)) setUserId(Number(u));
    if (c && /^\d+$/.test(c)) setCompareUserId(Number(c));
  }, [searchParams]);

  const comparePair = useMemo(() => {
    if (reports.length < 2 || !userId || !compareUserId) return null;
    const left = reports.find((r) => r.user.id === userId) ?? reports[0];
    const right = reports.find((r) => r.user.id === compareUserId) ?? reports[1];
    return { left, right };
  }, [reports, userId, compareUserId]);

  const singleReport = reports.length === 1 ? reports[0] : reports.find((r) => r.user.id === userId) ?? null;

  const runReport = useCallback(async () => {
    if (!userId) {
      toast({ title: "Select a user", variant: "destructive" });
      return;
    }
    setLoading(true);
    setReports([]);
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
        setReports(data.reports);
        setCompareNotes(data.comparison.notes ?? []);
        setWalletGap(data.comparison.wallet_gap_usd ?? null);
      } else if (data.report) {
        setReports([data.report]);
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <div className="mx-auto max-w-[90rem] space-y-6 p-6 md:p-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <FileBarChart className="h-7 w-7 text-[#E6B800]" />
          User P/L report
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Compare two users side by side — wallet, fees, cap, stop history, trades.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-slate-500">User A</label>
            <UserSearchSelect value={userId} onChange={(id) => setUserId(id)} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">User B (compare)</label>
            <UserSearchSelect value={compareUserId} onChange={(id) => setCompareUserId(id)} placeholder="e.g. #121" />
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

      {loading && reports.length === 0 && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
        </div>
      )}

      {comparePair && (
        <SideBySideCompare
          left={comparePair.left}
          right={comparePair.right}
          notes={compareNotes}
          walletGap={walletGap}
        />
      )}

      {!comparePair && singleReport && <SingleUserReport report={singleReport} />}
    </div>
  );
};

export default AdminUserPnlReportPage;
