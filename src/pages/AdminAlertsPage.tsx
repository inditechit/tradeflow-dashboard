import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  BellRing,
  Loader2,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  CheckCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE } from "@/config/api";
import { Button } from "@/components/ui/button";
import { ListPaginationBar } from "@/components/trades/TradesPaginationBar";
import { cn } from "@/lib/utils";

type AdminAlertRow = {
  id: number;
  alert_type: string;
  user_id: number | null;
  title: string;
  message: string;
  link_url: string | null;
  read_at: string | null;
  created_at: string;
  user_name?: string | null;
  user_email?: string | null;
};

type TradingEvent = {
  type: "stopped" | "restarted";
  at: string;
  note?: string | null;
  source?: string;
};

type TradingControl = {
  trading_active_now: boolean;
  last_stopped_at: string | null;
  last_restarted_at: string | null;
  never_restarted_since_last_stop: boolean;
  stop_count: number;
  restart_count: number;
  toggle_count: number;
  events: TradingEvent[];
};

type AlertDetail = {
  alert: AdminAlertRow;
  user: {
    id: number;
    name: string | null;
    email: string | null;
    trading_active: boolean;
  } | null;
  trading_control: TradingControl | null;
};

const PAGE_SIZE = 40;

function fmtDateTime(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(String(v).replace(" ", "T"));
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function alertTypeLabel(t: string) {
  if (t === "user_stop_trading") return "Stop trading";
  if (t === "user_restart_trading") return "Restart trading";
  return t.replace(/_/g, " ");
}

function isTradingAlert(t: string) {
  return t === "user_stop_trading" || t === "user_restart_trading";
}

const AdminAlertsPage = () => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedAlertId = useMemo(() => {
    const raw = searchParams.get("alert");
    return raw && /^\d+$/.test(raw) ? Number(raw) : null;
  }, [searchParams]);

  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [rows, setRows] = useState<AdminAlertRow[]>([]);
  const [listLoading, setListLoading] = useState(true);

  const [detail, setDetail] = useState<AlertDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadList = useCallback(
    async (pageNum = 1) => {
      setListLoading(true);
      try {
        const qs = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String((pageNum - 1) * PAGE_SIZE),
        });
        if (filter === "unread") qs.set("unread", "1");
        const res = await fetch(`${API_BASE}/admin/alerts?${qs}`);
        const data = await res.json();
        if (data.success) {
          setRows(data.rows ?? []);
          setTotal(Number(data.total ?? 0));
          setUnread(Number(data.unread ?? 0));
          setPage(pageNum);
        } else {
          toast({ title: "Error", description: data.error, variant: "destructive" });
        }
      } catch {
        toast({ title: "Network error", variant: "destructive" });
      } finally {
        setListLoading(false);
      }
    },
    [filter, toast],
  );

  const loadDetail = useCallback(
    async (alertId: number) => {
      setDetailLoading(true);
      try {
        const res = await fetch(`${API_BASE}/admin/alerts/${alertId}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Could not load alert");
        setDetail({
          alert: data.alert,
          user: data.user ?? null,
          trading_control: data.trading_control ?? null,
        });
        if (!data.alert.read_at) {
          await fetch(`${API_BASE}/admin/alerts/${alertId}/read`, { method: "PATCH" });
          setRows((prev) =>
            prev.map((r) =>
              r.id === alertId ? { ...r, read_at: new Date().toISOString() } : r,
            ),
          );
          setUnread((c) => Math.max(0, c - 1));
        }
      } catch (e) {
        toast({
          title: "Error",
          description: e instanceof Error ? e.message : "Could not load alert",
          variant: "destructive",
        });
        setDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void loadList(1);
  }, [loadList]);

  useEffect(() => {
    if (selectedAlertId) void loadDetail(selectedAlertId);
    else setDetail(null);
  }, [selectedAlertId, loadDetail]);

  const selectAlert = (id: number) => {
    setSearchParams({ alert: String(id) });
  };

  const markAllRead = async () => {
    try {
      await fetch(`${API_BASE}/admin/alerts/read-all`, { method: "POST" });
      setUnread(0);
      setRows((prev) => prev.map((r) => ({ ...r, read_at: r.read_at ?? new Date().toISOString() })));
      toast({ title: "All alerts marked read" });
    } catch {
      toast({ title: "Could not mark all read", variant: "destructive" });
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const tc = detail?.trading_control;
  const events = tc?.events ?? [];

  return (
    <div className="mx-auto max-w-[90rem] space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
            <BellRing className="h-7 w-7 text-[#E6B800]" />
            Admin alerts
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Stop / restart trading and other admin events. Click an alert to see full start–stop history.
          </p>
          {unread > 0 && (
            <p className="mt-1 text-xs font-medium text-amber-700">{unread} unread</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void loadList(page)}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Refresh
          </Button>
          {unread > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={() => void markAllRead()}>
              <CheckCheck className="mr-1.5 h-4 w-4" />
              Mark all read
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(280px,360px)_1fr]">
        {/* Alert list */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex border-b border-slate-200">
            {(["all", "unread"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "flex-1 px-4 py-3 text-sm font-semibold capitalize transition-colors",
                  filter === f
                    ? "border-b-2 border-[#FFD700] text-slate-900"
                    : "text-slate-500 hover:text-slate-700",
                )}
              >
                {f}
              </button>
            ))}
          </div>

          {listLoading && rows.length === 0 ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">No alerts</p>
          ) : (
            <ul className="max-h-[32rem] divide-y divide-slate-100 overflow-y-auto">
              {rows.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => selectAlert(a.id)}
                    className={cn(
                      "w-full px-4 py-3 text-left transition-colors hover:bg-slate-50",
                      selectedAlertId === a.id && "bg-[#FFF9E6]",
                      !a.read_at && "border-l-4 border-l-[#FFD700]",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          "text-sm font-semibold",
                          a.read_at ? "text-slate-600" : "text-slate-900",
                        )}
                      >
                        {a.title}
                      </span>
                      {isTradingAlert(a.alert_type) && (
                        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-600">
                          {a.alert_type === "user_stop_trading" ? "Stop" : "Start"}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{a.message}</p>
                    <p className="mt-1 text-[10px] text-slate-400">{fmtDateTime(a.created_at)}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <ListPaginationBar
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={PAGE_SIZE}
            onPageChange={(p) => void loadList(p)}
            itemLabel="alerts"
          />
        </div>

        {/* Detail panel */}
        <div className="min-h-[24rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {!selectedAlertId ? (
            <div className="flex h-full min-h-[24rem] flex-col items-center justify-center p-8 text-center text-slate-500">
              <BellRing className="mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm">Select an alert to view details and trading history</p>
            </div>
          ) : detailLoading ? (
            <div className="flex min-h-[24rem] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : detail ? (
            <div className="p-6">
              <div className="border-b border-slate-100 pb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {alertTypeLabel(detail.alert.alert_type)}
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">{detail.alert.title}</h2>
                <p className="mt-2 text-sm text-slate-600">{detail.alert.message}</p>
                <p className="mt-2 text-xs text-slate-400">{fmtDateTime(detail.alert.created_at)}</p>
              </div>

              {detail.user && (
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">
                      {detail.user.name || "User"}{" "}
                      <span className="text-slate-500">#{detail.user.id}</span>
                    </p>
                    <p className="truncate text-xs text-slate-500">{detail.user.email}</p>
                  </div>
                  {detail.user.trading_active ? (
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">
                      <PlayCircle className="h-3.5 w-3.5" /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                      <PauseCircle className="h-3.5 w-3.5" /> Stopped
                    </span>
                  )}
                  <Link
                    to={`/admin/user-pnl-report?user=${detail.user.id}`}
                    className="text-xs font-semibold text-[#B8860B] hover:underline"
                  >
                    P/L report
                  </Link>
                  <Link
                    to={`/admin/users/${detail.user.id}/trades`}
                    className="text-xs font-semibold text-slate-600 hover:underline"
                  >
                    Trades
                  </Link>
                </div>
              )}

              {tc && (
                <div className="mt-6">
                  <h3 className="text-sm font-bold text-slate-800">Copy trading start / stop history</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Total: {tc.stop_count} stop{tc.stop_count === 1 ? "" : "s"},{" "}
                    {tc.restart_count} restart{tc.restart_count === 1 ? "" : "s"} ({tc.toggle_count}{" "}
                    events)
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-3">
                      <p className="text-xs font-medium uppercase text-amber-800">Stops</p>
                      <p className="text-2xl font-bold text-amber-900">{tc.stop_count}</p>
                    </div>
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
                      <p className="text-xs font-medium uppercase text-emerald-800">Restarts</p>
                      <p className="text-2xl font-bold text-emerald-900">{tc.restart_count}</p>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <p className="text-xs font-medium uppercase text-slate-500">Last stopped</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {fmtDateTime(tc.last_stopped_at)}
                      </p>
                    </div>
                  </div>

                  {events.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-500">
                      No start/stop events recorded yet.
                    </p>
                  ) : (
                    <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                          <tr>
                            <th className="p-3">#</th>
                            <th className="p-3">Action</th>
                            <th className="p-3">When</th>
                            <th className="p-3">Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...events].reverse().map((ev, idx) => (
                            <tr key={`${ev.at}-${ev.type}-${idx}`} className="border-t border-slate-100">
                              <td className="p-3 font-mono text-xs text-slate-400">
                                {events.length - idx}
                              </td>
                              <td className="p-3">
                                {ev.type === "stopped" ? (
                                  <span className="inline-flex items-center gap-1 font-medium text-amber-800">
                                    <PauseCircle className="h-4 w-4" /> Stopped
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 font-medium text-emerald-800">
                                    <PlayCircle className="h-4 w-4" /> Restarted
                                  </span>
                                )}
                              </td>
                              <td className="p-3 whitespace-nowrap text-slate-700">
                                {fmtDateTime(ev.at)}
                              </td>
                              <td className="p-3 max-w-xs truncate text-xs text-slate-500" title={ev.note ?? ""}>
                                {ev.note || "—"}
                                {ev.source === "inferred" ? (
                                  <span className="ml-1 text-amber-600">(inferred)</span>
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {tc.never_restarted_since_last_stop && (
                    <p className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-800">
                      User has not restarted since their last stop.
                    </p>
                  )}
                </div>
              )}

              {!tc && detail.user && (
                <p className="mt-6 text-sm text-slate-500">No trading control history for this user.</p>
              )}
            </div>
          ) : (
            <div className="flex min-h-[24rem] items-center justify-center p-8 text-sm text-slate-500">
              Alert not found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAlertsPage;
