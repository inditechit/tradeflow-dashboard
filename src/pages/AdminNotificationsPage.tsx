import React, { useCallback, useEffect, useState } from "react";
import { Bell, Loader2, Send, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE } from "@/config/api";
import { Button } from "@/components/ui/button";
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

const TRIGGER_LABELS: Record<string, string> = {
  user_signup: "When user signs up",
  days_after_signup: "Days after signup",
  days_before_expiry: "Days before package expires",
};

const AdminNotificationsPage = () => {
  const { toast } = useToast();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(true);
  const [sending, setSending] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [broadcastAll, setBroadcastAll] = useState(true);

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

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const sendManual = async () => {
    if (!title.trim() || !message.trim()) {
      toast({ title: "Title and message required", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        message: message.trim(),
        link_url: linkUrl.trim() || null,
      };
      if (!broadcastAll && targetUserId.trim()) {
        body.user_id = Number(targetUserId.trim());
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
        description: broadcastAll
          ? `Delivered to ${data.count ?? "all"} users`
          : `Sent to user #${targetUserId}`,
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
          Send messages to users. Add a link to redirect on click; leave link empty for a popup only.
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
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={broadcastAll}
                onChange={(e) => setBroadcastAll(e.target.checked)}
              />
              Send to all users
            </label>
            {!broadcastAll ? (
              <div>
                <Label htmlFor="n-uid">User ID</Label>
                <Input
                  id="n-uid"
                  type="number"
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="mt-1 w-32"
                />
              </div>
            ) : null}
          </div>
          <Button
            type="button"
            className="w-fit bg-[#FFD700] font-semibold text-black hover:bg-[#E6C200]"
            disabled={sending}
            onClick={sendManual}
          >
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send
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
