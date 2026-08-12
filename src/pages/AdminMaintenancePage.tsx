import { useCallback, useEffect, useMemo, useState } from "react";
import { Construction, Loader2, Search, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE } from "@/config/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AdminUserTradesLink } from "@/components/admin/AdminUserTradesLink";

type MaintUser = {
  id: number;
  name: string;
  email: string;
  mobile?: string;
  under_maintenance: boolean;
};

const AdminMaintenancePage = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [users, setUsers] = useState<MaintUser[]>([]);
  const [underCount, setUnderCount] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/maintenance`);
      const data = await res.json();
      if (!data.success) {
        toast({
          title: "Error",
          description: data.error || "Failed to load maintenance settings",
          variant: "destructive",
        });
        return;
      }
      setMessage(String(data.message || ""));
      setUsers(Array.isArray(data.users) ? data.users : []);
      setUnderCount(Number(data.under_maintenance_count ?? 0));
      setSelected(new Set());
    } catch {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const hay = [u.name, u.email, u.mobile, String(u.id)]
        .map((v) => String(v ?? "").toLowerCase())
        .join(" ");
      return hay.includes(q);
    });
  }, [users, query]);

  const filteredIds = useMemo(() => filtered.map((u) => u.id), [filtered]);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const someFilteredSelected = filteredIds.some((id) => selected.has(id));

  const toggleOne = (id: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAllFiltered = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of filteredIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const saveMessage = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/admin/maintenance/message`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Saved", description: "Maintenance message updated." });
        setMessage(String(data.message || message));
      } else {
        toast({ title: "Save failed", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Save failed", description: "Network error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const applyMaintenance = async (opts: {
    selectAll?: boolean;
    enabled: boolean;
    userIds?: number[];
  }) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/admin/maintenance/users`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: opts.enabled ? "Maintenance enabled" : "Maintenance cleared",
          description: `${data.updated ?? 0} user(s) updated.`,
        });
        await load();
      } else {
        toast({ title: "Failed", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed", description: "Network error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const enableSelected = () => {
    const userIds = [...selected];
    if (!userIds.length) {
      toast({ title: "Select users", description: "Pick at least one user.", variant: "destructive" });
      return;
    }
    void applyMaintenance({ userIds, enabled: true });
  };

  const disableSelected = () => {
    const userIds = [...selected];
    if (!userIds.length) {
      toast({ title: "Select users", description: "Pick at least one user.", variant: "destructive" });
      return;
    }
    void applyMaintenance({ userIds, enabled: false });
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-900" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100">
          <Construction className="h-6 w-6 text-amber-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User maintenance mode</h1>
          <p className="mt-1 text-sm text-slate-500">
            Show a maintenance screen to selected users only. Admins are never blocked.
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <label className="text-sm font-semibold text-slate-800">Message shown to users</label>
        <Textarea
          className="mt-2 min-h-[88px]"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="The platform is under maintenance..."
        />
        <Button className="mt-3" disabled={saving} onClick={() => void saveMessage()}>
          Save message
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          <Users className="h-3.5 w-3.5" />
          {underCount} / {users.length} under maintenance
        </span>
        <Button
          variant="default"
          className="bg-amber-600 hover:bg-amber-700"
          disabled={saving}
          onClick={() => void applyMaintenance({ selectAll: true, enabled: true })}
        >
          Enable for all users
        </Button>
        <Button
          variant="outline"
          disabled={saving}
          onClick={() => void applyMaintenance({ selectAll: true, enabled: false })}
        >
          Clear all maintenance
        </Button>
        <Button variant="secondary" disabled={saving || !selected.size} onClick={enableSelected}>
          Enable selected ({selected.size})
        </Button>
        <Button variant="ghost" disabled={saving || !selected.size} onClick={disableSelected}>
          Disable selected
        </Button>
      </div>

      <div className="mb-3 relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          className="pl-9"
          placeholder="Search name, email, id..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="w-12 px-4 py-3">
                  <Checkbox
                    checked={allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false}
                    onCheckedChange={(v) => toggleAllFiltered(v === true)}
                    aria-label="Select all visible users"
                  />
                </th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selected.has(u.id)}
                      onCheckedChange={(v) => toggleOne(u.id, v === true)}
                      aria-label={`Select ${u.name}`}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <AdminUserTradesLink userId={u.id} name={u.name || "—"} className="font-medium" />
                    <span className="ml-2 text-xs text-slate-400">#{u.id}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.email || "—"}</td>
                  <td className="px-4 py-3">
                    {u.under_maintenance ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                        Maintenance
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Normal</span>
                    )}
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    No users match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminMaintenancePage;
