import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Loader2, Search, Send, Users, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE } from "@/config/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type AutomationRule = {
  id: number;
  rule_key: string;
  title: string;
  message: string;
  link_url: string | null;
  trigger_type: string;
  trigger_value: number;
  is_active: number;
};

type RecipientUser = {
  id: number;
  name: string;
  email: string;
  mobile?: string;
};

type TargetMode = "all" | "selected";

const TRIGGER_LABELS: Record<string, string> = {
  user_signup: "When user signs up",
  days_after_signup: "Days after signup",
  days_before_expiry: "Days before package expires",
};

const AdminNotificationsPage = () => {
  const { toast } = useToast();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [sending, setSending] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [targetMode, setTargetMode] = useState<TargetMode>("all");
  const [users, setUsers] = useState<RecipientUser[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");

  const loadRules = useCallback(async () => {
    setLoadingRules(true);
    try {
      const res = await fetch(`${API_BASE}/admin/notifications/automation-rules`);
      const data = await res.json();
      if (data.success) setRules(data.rules ?? []);
    } catch {
      toast({ title: "Failed to load automation rules", variant: "destructive" });
    } finally {
      setLoadingRules(false);
    }
  }, [toast]);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users?limit=2000`);
      const data = await res.json();
      if (!data.success) {
        toast({ title: "Failed to load users", description: data.error, variant: "destructive" });
        return;
      }
      const list = Array.isArray(data.users) ? data.users : [];
      setUsers(
        list.map((u: { id: number; name?: string; email?: string; mobile?: string }) => ({
          id: Number(u.id),
          name: String(u.name ?? ""),
          email: String(u.email ?? ""),
          mobile: u.mobile ? String(u.mobile) : undefined,
        })),
      );
    } catch {
      toast({ title: "Failed to load users", description: "Network error", variant: "destructive" });
    } finally {
      setLoadingUsers(false);
    }
  }, [toast]);

  useEffect(() => {
    loadRules();
    loadUsers();
  }, [loadRules, loadUsers]);

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

  const selectAllUsers = () => {
    setSelected(new Set(users.map((u) => u.id)));
  };

  const clearSelection = () => {
    setSelected(new Set());
  };

  const sendManual = async () => {
    if (!title.trim() || !message.trim()) {
      toast({ title: "Title and message required", variant: "destructive" });
      return;
    }
    if (targetMode === "selected" && !selected.size) {
      toast({
        title: "Select users",
        description: "Pick at least one user to send to.",
        variant: "destructive",
      });
      return;
    }
    setSending(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        message: message.trim(),
        link_url: linkUrl.trim() || null,
      };
      if (targetMode === "selected") {
        body.user_ids = [...selected];
      }
      const res = await fetch(`${API_BASE}/admin/notifications/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Send failed");
      toast({
        title: "Sent",
        description:
          targetMode === "all"
            ? `Delivered to ${data.count ?? "all"} users`
            : `Delivered to ${data.count ?? selected.size} user(s)`,
      });
      setTitle("");
      setMessage("");
      setLinkUrl("");
    } catch (e: unknown) {
      toast({
        title: "Send failed",
        description: e instanceof Error ? e.message : "Error",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const saveRule = async (rule: AutomationRule) => {
    try {
      const res = await fetch(`${API_BASE}/admin/notifications/automation-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: rule.id,
          title: rule.title,
          message: rule.message,
          link_url: rule.link_url,
          trigger_type: rule.trigger_type,
          trigger_value: rule.trigger_value,
          is_active: rule.is_active,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast({ title: "Rule saved" });
      loadRules();
    } catch (e: unknown) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Error",
        variant: "destructive",
      });
    }
  };

  const runAutomationNow = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/notifications/run-automation`, { method: "POST" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast({
        title: "Automation run complete",
        description: `Day-after: ${data.report?.days_after ?? 0}, expiry: ${data.report?.expiry ?? 0}`,
      });
    } catch (e: unknown) {
      toast({
        title: "Run failed",
        description: e instanceof Error ? e.message : "Error",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 md:p-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Bell className="h-7 w-7" />
          Notifications
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Send messages to all users or pick specific users. Add a link to redirect on click; leave
          link empty for a popup only.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
          <Send className="h-5 w-5" />
          Send notification
        </h2>
        <div className="grid gap-4">
          <div>
            <Label htmlFor="n-title">Title</Label>
            <Input id="n-title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="n-msg">Message</Label>
            <Textarea
              id="n-msg"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="n-link">Link URL (optional)</Label>
            <Input
              id="n-link"
              placeholder="/packages or https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-slate-500">
              Internal paths like /packages open in app. External https links open in new tab.
            </p>
          </div>

          <div>
            <Label className="mb-2 block">Recipients</Label>
            <div className="flex flex-wrap gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="target-mode"
                  checked={targetMode === "all"}
                  onChange={() => setTargetMode("all")}
                />
                All users
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="target-mode"
                  checked={targetMode === "selected"}
                  onChange={() => setTargetMode("selected")}
                />
                Selected users
              </label>
            </div>
          </div>

          {targetMode === "selected" ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                  <Users className="h-3.5 w-3.5" />
                  {selected.size} selected
                </span>
                <Button type="button" variant="outline" size="sm" disabled={loadingUsers} onClick={selectAllUsers}>
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!selected.size}
                  onClick={clearSelection}
                >
                  Clear
                </Button>
              </div>

              <div className="relative mb-3 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="bg-white pl-9"
                  placeholder="Search name, email, id..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              {loadingUsers ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 border-b bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="w-12 px-3 py-2">
                          <Checkbox
                            checked={
                              allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false
                            }
                            onCheckedChange={(v) => toggleAllFiltered(v === true)}
                            aria-label="Select all visible users"
                          />
                        </th>
                        <th className="px-3 py-2">User</th>
                        <th className="px-3 py-2">Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((u) => (
                        <tr key={u.id} className="border-b last:border-0 hover:bg-slate-50/80">
                          <td className="px-3 py-2">
                            <Checkbox
                              checked={selected.has(u.id)}
                              onCheckedChange={(v) => toggleOne(u.id, v === true)}
                              aria-label={`Select ${u.name}`}
                            />
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-900">
                            {u.name || "—"}
                            <span className="ml-2 text-xs text-slate-400">#{u.id}</span>
                          </td>
                          <td className="px-3 py-2 text-slate-600">{u.email || "—"}</td>
                        </tr>
                      ))}
                      {!filtered.length && (
                        <tr>
                          <td colSpan={3} className="px-3 py-6 text-center text-slate-500">
                            No users match your search.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

          <Button
            type="button"
            className="w-fit bg-[#FFD700] font-semibold text-black hover:bg-[#E6C200]"
            disabled={sending || (targetMode === "selected" && loadingUsers)}
            onClick={sendManual}
          >
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {targetMode === "selected" ? `Send to ${selected.size || 0} user(s)` : "Send to all users"}
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
            <Zap className="h-5 w-5" />
            Automatic notifications
          </h2>
          <Button type="button" variant="outline" size="sm" onClick={runAutomationNow}>
            Run automation now
          </Button>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Default rules: welcome on signup, check-in after N days, package expiry reminder. System runs
          every 6 hours automatically.
        </p>
        {loadingRules ? (
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-400" />
        ) : (
          <div className="space-y-4">
            {rules.map((rule) => (
              <div key={rule.id} className="rounded-xl border border-slate-100 p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    {rule.rule_key} · {TRIGGER_LABELS[rule.trigger_type] || rule.trigger_type}
                    {rule.trigger_value > 0 ? ` (${rule.trigger_value})` : ""}
                  </span>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={rule.is_active === 1}
                      onChange={(e) =>
                        setRules((prev) =>
                          prev.map((r) =>
                            r.id === rule.id ? { ...r, is_active: e.target.checked ? 1 : 0 } : r,
                          ),
                        )
                      }
                    />
                    Active
                  </label>
                </div>
                <Input
                  className="mb-2"
                  value={rule.title}
                  onChange={(e) =>
                    setRules((prev) =>
                      prev.map((r) => (r.id === rule.id ? { ...r, title: e.target.value } : r)),
                    )
                  }
                />
                <Textarea
                  rows={3}
                  className="mb-2"
                  value={rule.message}
                  onChange={(e) =>
                    setRules((prev) =>
                      prev.map((r) => (r.id === rule.id ? { ...r, message: e.target.value } : r)),
                    )
                  }
                />
                <Input
                  placeholder="Link URL (optional)"
                  value={rule.link_url ?? ""}
                  onChange={(e) =>
                    setRules((prev) =>
                      prev.map((r) => (r.id === rule.id ? { ...r, link_url: e.target.value } : r)),
                    )
                  }
                />
                <Button type="button" size="sm" className="mt-3" onClick={() => saveRule(rule)}>
                  Save rule
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminNotificationsPage;
