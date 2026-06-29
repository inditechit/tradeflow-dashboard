import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { API_BASE } from "@/config/api";
import { cn } from "@/lib/utils";

type Mt5TradeOption = {
  ticket: string | number;
  symbol?: string;
  status?: string;
  volume?: number | string;
  profit?: number;
  open_time?: string | null;
  close_time?: string | null;
};

type AdminUserOption = {
  id: number;
  name: string;
  wallet_balance?: number;
};

type AssignmentStatus = {
  ticket: string;
  symbol?: string;
  status?: string;
  master_closed?: boolean;
  assignments?: Array<{ user_id: number; name?: string; settled?: boolean }>;
};

export type AdminManualTicketAssignDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select ticket when opened from a trade row */
  initialTicket?: string | null;
  trades: Mt5TradeOption[];
  onAssigned?: () => void;
};

export function AdminManualTicketAssignDialog({
  open,
  onOpenChange,
  initialTicket,
  trades,
  onAssigned,
}: AdminManualTicketAssignDialogProps) {
  const { toast } = useToast();
  const [ticketQ, setTicketQ] = useState("");
  const [selectedTicket, setSelectedTicket] = useState("");
  const [userQ, setUserQ] = useState("");
  const [users, setUsers] = useState<AdminUserOption[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [status, setStatus] = useState<AssignmentStatus | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = String(initialTicket ?? "").trim();
    setSelectedTicket(t);
    setTicketQ(t);
    setSelectedUserIds([]);
    setUserQ("");
  }, [open, initialTicket]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      setLoadingUsers(true);
      try {
        const res = await fetch(`${API_BASE}/admin/users?finance=1`);
        const data = await res.json();
        if (!cancelled && data.success && Array.isArray(data.users)) {
          setUsers(
            data.users.map((u: Record<string, unknown>) => ({
              id: Number(u.id),
              name: String(u.name ?? `User #${u.id}`),
              wallet_balance: Number(u.wallet_balance ?? 0),
            })),
          );
        }
      } catch {
        if (!cancelled) setUsers([]);
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const loadStatus = useCallback(async (ticket: string) => {
    const t = ticket.trim();
    if (!t) {
      setStatus(null);
      return;
    }
    setLoadingStatus(true);
    try {
      const res = await fetch(`${API_BASE}/admin/v2/tickets/${encodeURIComponent(t)}/assignment-status`);
      const data = await res.json();
      if (data.success) setStatus(data as AssignmentStatus);
      else setStatus(null);
    } catch {
      setStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !selectedTicket) {
      setStatus(null);
      return;
    }
    void loadStatus(selectedTicket);
  }, [open, selectedTicket, loadStatus]);

  const tradeOptions = useMemo(() => {
    const q = ticketQ.trim().toLowerCase();
    const list = trades.map((t) => ({
      ticket: String(t.ticket ?? ""),
      symbol: String(t.symbol ?? ""),
      status: String(t.status ?? ""),
      volume: Number(t.volume ?? 0),
      profit: Number(t.profit ?? 0),
      open_time: t.open_time,
      close_time: t.close_time,
    }));
    if (!q) return list.slice(0, 80);
    return list
      .filter(
        (t) =>
          t.ticket.includes(q) ||
          t.symbol.toLowerCase().includes(q) ||
          t.status.toLowerCase().includes(q),
      )
      .slice(0, 80);
  }, [trades, ticketQ]);

  const assignedIds = useMemo(
    () => new Set((status?.assignments ?? []).map((a) => Number(a.user_id))),
    [status],
  );

  const filteredUsers = useMemo(() => {
    const q = userQ.trim().toLowerCase();
    return users
      .filter((u) => {
        if (assignedIds.has(u.id)) return false;
        if (!q) return true;
        return u.name.toLowerCase().includes(q) || String(u.id).includes(q);
      })
      .slice(0, 60);
  }, [users, userQ, assignedIds]);

  const toggleUser = (id: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleAssign = async () => {
    const ticket = selectedTicket.trim();
    if (!ticket || selectedUserIds.length === 0) {
      toast({
        title: "Select trade and user(s)",
        description: "Pick a master ticket and at least one user.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/v2/assign-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket, userIds: selectedUserIds }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Assign failed");
      toast({
        title: "Assignment complete",
        description: String(data.message || `Ticket ${ticket} updated.`),
      });
      setSelectedUserIds([]);
      await loadStatus(ticket);
      onAssigned?.();
    } catch (err) {
      toast({
        title: "Assignment failed",
        description: err instanceof Error ? err.message : "Could not assign",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-yellow-800" />
            Manual trade assignment
          </DialogTitle>
          <DialogDescription>
            Assign any master trade (open or closed) to a user. Share = user wallet ÷ total
            platform wallet. Closed trades settle immediately at master P/L × pool %.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
              1. Select master trade
            </label>
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={ticketQ}
                onChange={(e) => setTicketQ(e.target.value)}
                placeholder="Search ticket, symbol, status…"
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-100"
              />
            </div>
            <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-100">
              {tradeOptions.length === 0 ? (
                <p className="p-4 text-center text-sm text-slate-500">No trades match</p>
              ) : (
                tradeOptions.map((t) => {
                  const active = selectedTicket === t.ticket;
                  return (
                    <button
                      key={t.ticket}
                      type="button"
                      onClick={() => {
                        setSelectedTicket(t.ticket);
                        setTicketQ(t.ticket);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 border-b border-slate-50 px-3 py-2 text-left text-sm last:border-0 hover:bg-yellow-50/60",
                        active && "bg-yellow-50",
                      )}
                    >
                      <span>
                        <span className="font-semibold text-slate-900">#{t.ticket}</span>
                        <span className="ml-2 text-slate-600">{t.symbol}</span>
                        <span className="ml-2 text-xs text-slate-400">{t.status}</span>
                      </span>
                      <span className="text-xs tabular-nums text-slate-500">
                        vol {t.volume.toFixed(2)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            {selectedTicket && (
              <p className="mt-2 text-xs text-slate-500">
                Selected: <span className="font-mono font-semibold text-slate-800">#{selectedTicket}</span>
                {loadingStatus ? " · loading…" : status ? ` · ${status.symbol ?? ""} · ${status.status ?? ""}` : ""}
              </p>
            )}
          </div>

          {status && (status.assignments?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
              Already assigned:{" "}
              {status.assignments!.map((a) => `${a.name ?? `#${a.user_id}`}`).join(", ")}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
              2. Select user(s) to assign
            </label>
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={userQ}
                onChange={(e) => setUserQ(e.target.value)}
                placeholder="Search name or user id…"
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-100"
              />
            </div>
            {loadingUsers ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading users…
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-100">
                {filteredUsers.length === 0 ? (
                  <p className="p-4 text-center text-sm text-slate-500">
                    No unassigned users match
                  </p>
                ) : (
                  filteredUsers.map((u) => {
                    const checked = selectedUserIds.includes(u.id);
                    return (
                      <label
                        key={u.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 border-b border-slate-50 px-3 py-2.5 last:border-0 hover:bg-slate-50",
                          checked && "bg-sky-50/80",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleUser(u.id)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-slate-900">{u.name}</div>
                          <div className="text-xs text-slate-500">
                            #{u.id} · wallet USD {(u.wallet_balance ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={submitting || !selectedTicket || selectedUserIds.length === 0}
              className="gap-2 bg-yellow-900 text-white hover:bg-yellow-800"
              onClick={() => void handleAssign()}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Assign {selectedUserIds.length > 0 ? `(${selectedUserIds.length})` : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
