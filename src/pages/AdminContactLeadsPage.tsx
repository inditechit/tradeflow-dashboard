import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail, RefreshCw } from "lucide-react";
import { API_BASE } from "@/config/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ListPaginationBar } from "@/components/trades/TradesPaginationBar";
import { cn } from "@/lib/utils";

type Lead = {
  id: number;
  name: string;
  email: string;
  mobile: string | null;
  message: string;
  status: string;
  created_at: string;
};

const PAGE_SIZE = 40;

export default function AdminContactLeadsPage() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String((page - 1) * PAGE_SIZE),
      });
      if (statusFilter) qs.set("status", statusFilter);
      const res = await fetch(`${API_BASE}/admin/contact-leads?${qs}`);
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || "Failed to load");
      setLeads(Array.isArray(data.leads) ? data.leads : []);
      setTotal(Number(data.total || 0));
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load leads",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (id: number, status: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/contact-leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || "Update failed");
      await load();
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Error",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Mail className="h-6 w-6" /> Contact leads
          </h1>
          <p className="text-sm text-slate-500">Submissions from the marketing contact form.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {["", "new", "read", "archived"].map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => {
              setPage(1);
              setStatusFilter(s);
            }}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold",
              statusFilter === s
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700",
            )}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Message</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && leads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    No leads yet.
                  </td>
                </tr>
              ) : (
                leads.map((l) => (
                  <tr key={l.id} className="border-b border-slate-50 align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {l.created_at ? new Date(String(l.created_at).replace(" ", "T")).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{l.name}</p>
                      <p className="text-xs text-slate-500">{l.email}</p>
                      <p className="text-xs text-slate-500">{l.mobile || "—"}</p>
                    </td>
                    <td className="max-w-md px-4 py-3 text-slate-700 whitespace-pre-wrap">{l.message}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-xs font-semibold capitalize",
                          l.status === "new"
                            ? "bg-amber-50 text-amber-900"
                            : l.status === "read"
                              ? "bg-sky-50 text-sky-900"
                              : "bg-slate-100 text-slate-600",
                        )}
                      >
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {l.status !== "read" && (
                          <button
                            type="button"
                            className="text-left text-xs font-semibold text-sky-700 hover:underline"
                            onClick={() => void setStatus(l.id, "read")}
                          >
                            Mark read
                          </button>
                        )}
                        {l.status !== "archived" && (
                          <button
                            type="button"
                            className="text-left text-xs font-semibold text-slate-600 hover:underline"
                            onClick={() => void setStatus(l.id, "archived")}
                          >
                            Archive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
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
          itemLabel="leads"
        />
      </div>
    </div>
  );
}
