import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, MapPin, RefreshCw, Search } from "lucide-react";
import { API_BASE } from "@/config/api";
import { Button } from "@/components/ui/button";
import { ListPaginationBar } from "@/components/trades/TradesPaginationBar";
import { cn } from "@/lib/utils";
import { AdminUserTradesLink } from "@/components/admin/AdminUserTradesLink";

type LoginLocationLog = {
  id: number;
  user_id: number;
  logged_at: string;
  latitude: number | string | null;
  longitude: number | string | null;
  address: string | null;
  location_available: number | boolean;
  login_method: string;
  user_name?: string | null;
  user_email?: string | null;
  user_telegram?: string | null;
  address_repeat_count?: number | string | null;
};

const PAGE_SIZE = 40;

function fmtDateTime(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(String(v).replace(" ", "T"));
  if (!Number.isFinite(d.getTime())) return String(v);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export default function AdminLoginLocationLogsPage() {
  const [logs, setLogs] = useState<LoginLocationLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [userIdFilter, setUserIdFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [draftFilter, setDraftFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String((page - 1) * PAGE_SIZE),
      });
      if (userIdFilter && /^\d+$/.test(userIdFilter)) {
        qs.set("userId", userIdFilter);
      } else if (searchFilter) {
        qs.set("search", searchFilter);
      }
      const res = await fetch(`${API_BASE}/admin/login-location-logs?${qs}`);
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || "Failed to load logs");
      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setTotal(Number(data.total || 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, userIdFilter, searchFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyFilter = () => {
    const trimmed = draftFilter.trim();
    setPage(1);
    if (/^\d+$/.test(trimmed)) {
      setUserIdFilter(trimmed);
      setSearchFilter("");
    } else {
      setUserIdFilter("");
      setSearchFilter(trimmed);
    }
  };

  const filterByUserId = (id: number) => {
    const idStr = String(id);
    setDraftFilter(idStr);
    setUserIdFilter(idStr);
    setSearchFilter("");
    setPage(1);
  };

  const clearFilters = () => {
    setDraftFilter("");
    setUserIdFilter("");
    setSearchFilter("");
    setPage(1);
  };

  const hasActiveFilter = Boolean(userIdFilter || searchFilter);

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <MapPin className="h-6 w-6 text-neutral-800" />
            Login locations
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Where users logged in from (GPS or unavailable). Append-only history.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
          className="gap-1.5"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="min-w-[160px] flex-1">
          <label className="mb-1 block text-xs font-semibold text-slate-500">User name or ID</label>
          <input
            value={draftFilter}
            onChange={(e) => setDraftFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyFilter();
            }}
            placeholder="Name, email, telegram, or user id"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <Button type="button" onClick={applyFilter} className="gap-1.5 bg-yellow-900 text-white hover:bg-yellow-800">
          <Search className="h-4 w-4" />
          Filter
        </Button>
        {hasActiveFilter ? (
          <Button type="button" variant="ghost" onClick={clearFilters}>
            Clear
          </Button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Coords</th>
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    No login location logs yet.
                  </td>
                </tr>
              ) : (
                logs.map((row) => {
                  const available = Number(row.location_available) === 1;
                  const lat = row.latitude != null ? Number(row.latitude) : NaN;
                  const lng = row.longitude != null ? Number(row.longitude) : NaN;
                  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
                  return (
                    <tr key={row.id} className="border-b border-slate-50 align-top last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-700">
                        {fmtDateTime(row.logged_at)}
                      </td>
                      <td className="px-4 py-3">
                        <AdminUserTradesLink
                          userId={row.user_id}
                          name={row.user_name || `User #${row.user_id}`}
                          className="font-semibold"
                        />
                        <p className="text-xs text-slate-500">
                          <button
                            type="button"
                            onClick={() => filterByUserId(row.user_id)}
                            className="font-semibold tabular-nums text-yellow-900 underline-offset-2 hover:underline"
                            title="Show all logins for this user"
                          >
                            #{row.user_id}
                          </button>
                          {row.user_email ? ` · ${row.user_email}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "rounded-md border px-2 py-0.5 text-xs font-semibold capitalize",
                            row.login_method === "google"
                              ? "border-sky-200 bg-sky-50 text-sky-900"
                              : "border-slate-200 bg-slate-50 text-slate-700",
                          )}
                        >
                          {row.login_method || "password"}
                        </span>
                      </td>
                      <td className="max-w-xs px-4 py-3 text-slate-800">
                        {available ? (
                          <span className="inline-flex flex-wrap items-center gap-1.5">
                            <span>{row.address || "Coordinates only (geocode unavailable)"}</span>
                            {Number(row.address_repeat_count) > 1 ? (
                              <span
                                className="rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-violet-900"
                                title="Times this user logged from this address"
                              >
                                ×{Number(row.address_repeat_count)}
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-amber-800">Location unavailable</span>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-xs text-slate-600">
                        {hasCoords ? (
                          <a
                            href={mapsUrl(lat, lng)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-sky-700 hover:underline"
                          >
                            {lat.toFixed(5)}, {lng.toFixed(5)}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <ListPaginationBar
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          itemLabel="logs"
        />
      </div>
    </div>
  );
}
