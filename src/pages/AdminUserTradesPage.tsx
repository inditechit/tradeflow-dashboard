import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/config/api";
import { formatIsoDateTime } from "@/utils/mt5TradeDates";
import {
  fmtMt5Price,
  isOpenTrade,
  rowFinalWalletPl,
  rowGrossPl,
  type UserTradeRowLike,
} from "@/utils/userTradePl";
import { plTextClass } from "@/utils/plColors";

type UserTradeRow = UserTradeRowLike & {
  assignment_id?: number;
  open_time?: string | null;
  close_time?: string | null;
  assignment_created_at?: string | null;
};

type StatusFilter = "all" | "open" | "closed";

function fmtUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function tradeOpenedAt(r: UserTradeRow): string {
  return formatIsoDateTime(r.open_time ?? r.assignment_created_at ?? null);
}

function tradeClosedAt(r: UserTradeRow): string {
  if (isOpenTrade(r)) return "—";
  return formatIsoDateTime(r.close_time ?? null);
}

const AdminUserTradesPage = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [rows, setRows] = useState<UserTradeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const [profileRes, tradesRes] = await Promise.all([
        fetch(`${API_BASE}/user/profile/${userId}`),
        fetch(`${API_BASE}/user/trades/${userId}?since_last_recharge=0&limit=5000`),
      ]);
      const profileData = await profileRes.json();
      const tradesData = await tradesRes.json();
      if (profileData?.success && profileData.profile?.name) {
        setUserName(String(profileData.profile.name));
      }
      if (tradesData?.success && Array.isArray(tradesData.trades)) {
        setRows(tradesData.trades as UserTradeRow[]);
      }
    } catch (err) {
      console.error("AdminUserTradesPage fetch:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filteredRows = useMemo(() => {
    if (statusFilter === "all") return rows;
    if (statusFilter === "open") return rows.filter((r) => isOpenTrade(r));
    return rows.filter((r) => !isOpenTrade(r));
  }, [rows, statusFilter]);

  const openCount = useMemo(() => rows.filter((r) => isOpenTrade(r)).length, [rows]);
  const closedCount = rows.length - openCount;

  if (!userId) {
    return <Navigate to="/admin/users" replace />;
  }

  return (
    <div className="mx-auto max-w-7xl px-0 py-4 sm:px-2 md:px-6 md:py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => navigate("/admin/users")}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Users
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              {userName || "User"} — assigned trades
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              User #{userId} · {openCount} open · {closedCount} closed · {rows.length} total
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit gap-2"
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["all", `All (${rows.length})`],
            ["open", `Open (${openCount})`],
            ["closed", `Closed (${closedCount})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatusFilter(key)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              statusFilter === key
                ? "bg-yellow-800 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl shadow-neutral-900/8">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Ticket</th>
                <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Symbol</th>
                <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Opened</th>
                <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Closed</th>
                <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Assigned</th>
                <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Vol.</th>
                <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Fee</th>
                <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">P/L</th>
                <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Final</th>
                <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                    <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-yellow-800" />
                    Loading…
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                    No trades found
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const open = isOpenTrade(r);
                  const grossPl = rowGrossPl(r);
                  const finalPl = rowFinalWalletPl(r);
                  const vol = Number(r.allocated_volume ?? 0);
                  const fee = Number(r.proportional_fee ?? 0);
                  const buyPrice = Number(r.price);

                  return (
                    <tr key={String(r.assignment_id ?? r.ticket_id)} className="hover:bg-yellow-50/40">
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">{r.ticket_id}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">{r.symbol ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                        {tradeOpenedAt(r)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                        {tradeClosedAt(r)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">
                        {formatIsoDateTime(r.assignment_created_at ?? null)}
                      </td>
                      <td className="px-4 py-3 text-sm tabular-nums text-slate-600">
                        {vol > 0 ? vol.toFixed(4) : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm tabular-nums text-slate-600">
                        {fee > 0 ? fmtUsd(fee) : "—"}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm font-bold tabular-nums ${
                          grossPl >= 0 ? plTextClass(1) : plTextClass(-1)
                        }`}
                      >
                        {fmtUsd(grossPl)}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm font-bold tabular-nums ${
                          finalPl >= 0 ? plTextClass(1) : plTextClass(-1)
                        }`}
                      >
                        {fmtUsd(finalPl)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            open
                              ? "bg-sky-50 text-sky-700"
                              : "border border-slate-200 bg-slate-100 text-slate-700"
                          }`}
                        >
                          {open ? String(r.mt5_status ?? "Open") : "Closed"}
                        </span>
                        {buyPrice > 0 && (
                          <div className="mt-1 text-[11px] text-slate-400 tabular-nums">
                            @ {fmtMt5Price(buyPrice, r.symbol)}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminUserTradesPage;
