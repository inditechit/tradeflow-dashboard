import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, ShieldPlus, UserCog, UserRoundPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useApp } from "@/context/AppContext";
import { API_BASE } from "@/config/api";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { EmployeeAccessModal } from "@/components/admin/EmployeeAccessModal";
import { UserSearchSelect } from "@/components/admin/UserSearchSelect";
import { useEmployeeAccess } from "@/hooks/useEmployeeAccess";
import { Navigate } from "react-router-dom";

type EmployeeRow = {
  employee_id: number;
  user_id: number;
  name: string;
  email: string;
  mobile?: string | null;
  is_active: boolean;
  permissions: string[];
  created_at: string;
  created_by_name?: string | null;
};

const AdminEmployeesPage = () => {
  const { toast } = useToast();
  const { currentUser } = useApp();
  const { isAdmin } = useEmployeeAccess();
  const adminId = Number(currentUser?.userId);

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mobile, setMobile] = useState("");
  const [creating, setCreating] = useState(false);

  const [convertUserId, setConvertUserId] = useState<number | null>(null);
  const [convertUserLabel, setConvertUserLabel] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  const [accessOpen, setAccessOpen] = useState(false);
  const [accessTarget, setAccessTarget] = useState<EmployeeRow | null>(null);
  const [accessPerms, setAccessPerms] = useState<string[]>([]);
  const [savingAccess, setSavingAccess] = useState(false);
  const [pendingCreate, setPendingCreate] = useState<EmployeeRow | null>(null);

  const load = useCallback(async () => {
    if (!adminId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/employees?adminUserId=${adminId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to load");
      setEmployees(data.employees ?? []);
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Could not load employees",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [adminId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const openAccess = (row: EmployeeRow, perms: string[]) => {
    setAccessTarget(row);
    setAccessPerms(perms);
    setAccessOpen(true);
  };

  const saveAccess = async (permissions: string[]) => {
    if (!accessTarget || !adminId) return;
    setSavingAccess(true);
    try {
      const res = await fetch(`${API_BASE}/admin/employees/${accessTarget.user_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions, updatedByUserId: adminId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Save failed");
      toast({ title: "Access updated" });
      setAccessOpen(false);
      setAccessTarget(null);
      setPendingCreate(null);
      await load();
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Save failed",
        variant: "destructive",
      });
    } finally {
      setSavingAccess(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/admin/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          mobile: mobile.trim() || null,
          permissions: [],
          createdByUserId: adminId,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Create failed");
      toast({ title: "Employee created", description: "Set their panel access below." });
      setName("");
      setEmail("");
      setPassword("");
      setMobile("");
      await load();
      const row = data.employee as EmployeeRow;
      if (row) {
        setPendingCreate(row);
        openAccess(row, []);
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Create failed",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (row: EmployeeRow) => {
    if (!adminId) return;
    try {
      const res = await fetch(`${API_BASE}/admin/employees/${row.user_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !row.is_active, updatedByUserId: adminId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Update failed");
      await load();
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Update failed",
        variant: "destructive",
      });
    }
  };

  const candidatesUrl = useMemo(
    () => (adminId ? `${API_BASE}/admin/employees/candidates?adminUserId=${adminId}&limit=200` : ""),
    [adminId],
  );

  const handleConvert = async () => {
    if (!adminId || convertUserId == null) return;
    setConverting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/employees/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: convertUserId,
          createdByUserId: adminId,
          permissions: [],
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Convert failed");
      toast({
        title: "User converted",
        description: "Set their panel access below.",
      });
      setConvertUserId(null);
      setConvertUserLabel(null);
      await load();
      const row = data.employee as EmployeeRow;
      if (row) {
        setPendingCreate(row);
        openAccess(row, []);
      }
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Convert failed",
        variant: "destructive",
      });
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 md:p-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <UserCog className="h-7 w-7 text-emerald-600" />
          Employees
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Create new employee accounts or convert an existing user. Grant tab-by-tab access to filters, columns, and actions.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-800">
          <UserRoundPlus className="h-5 w-5" /> Convert existing user
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          Pick a regular user account — they keep their login and become an employee with limited admin access.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">User</label>
            <UserSearchSelect
              value={convertUserId}
              selectedLabel={convertUserLabel}
              showClearOption={false}
              placeholder="Search user to convert…"
              fetchUrl={candidatesUrl}
              onChange={(id, user) => {
                setConvertUserId(id);
                if (user) {
                  setConvertUserLabel(
                    `${user.name || "User"} · #${user.id}${user.email ? ` · ${user.email}` : ""}`,
                  );
                } else {
                  setConvertUserLabel(null);
                }
              }}
            />
          </div>
          <Button
            type="button"
            disabled={convertUserId == null || converting}
            className="shrink-0 bg-slate-800 text-white hover:bg-slate-900"
            onClick={() => void handleConvert()}
          >
            {converting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Convert & set access"}
          </Button>
        </div>
      </div>

      <form
        onSubmit={handleCreate}
        className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2"
      >
        <h2 className="sm:col-span-2 flex items-center gap-2 font-semibold text-slate-800">
          <ShieldPlus className="h-5 w-5" /> New employee
        </h2>
        <input
          required
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
        />
        <input
          required
          type="email"
          placeholder="Email (login)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
        />
        <PasswordInput
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
        />
        <input
          placeholder="Mobile (optional)"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
        />
        <div className="sm:col-span-2">
          <Button type="submit" disabled={creating} className="bg-[#FFD700] text-black hover:bg-[#E6C200]">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create & set access"}
          </Button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b px-4 py-3 font-semibold">Team ({employees.length})</div>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Access</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((row) => (
                <tr key={row.user_id} className="border-t">
                  <td className="p-3 font-medium">
                    {row.name}
                    <div className="font-mono text-[10px] text-slate-400">#{row.user_id}</div>
                  </td>
                  <td className="p-3">{row.email}</td>
                  <td className="p-3 text-slate-600">{row.permissions.length} permission(s)</td>
                  <td className="p-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        row.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {row.is_active ? "Active" : "Off"}
                    </span>
                  </td>
                  <td className="p-3 text-right space-x-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => openAccess(row, row.permissions)}>
                      Edit access
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => void toggleActive(row)}>
                      {row.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </td>
                </tr>
              ))}
              {!employees.length && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    No employees yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <EmployeeAccessModal
        open={accessOpen}
        onClose={() => {
          setAccessOpen(false);
          setAccessTarget(null);
          setPendingCreate(null);
        }}
        employeeName={accessTarget?.name ?? pendingCreate?.name ?? "Employee"}
        initialPermissions={accessPerms}
        onSave={saveAccess}
        saving={savingAccess}
      />
    </div>
  );
};

export default AdminEmployeesPage;
