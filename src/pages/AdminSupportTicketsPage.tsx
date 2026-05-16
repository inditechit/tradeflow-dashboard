import { useCallback, useEffect, useRef, useState } from "react";
import {
  Headphones,
  Loader2,
  RefreshCw,
  Send,
  Lock,
  Unlock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const API_BASE = "https://api.copytradeengine.org/api";

type TicketRow = {
  id: number;
  user_id: number;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
  user_name: string | null;
  user_email: string | null;
  user_telegram: string | null;
  last_message_preview: string | null;
};

type Msg = {
  id: number;
  sender_role: "user" | "admin";
  body: string;
  created_at: string;
};

function statusBadge(status: string) {
  const s = String(status).toLowerCase();
  if (s === "open") return "border-[#FFD700]/80 bg-[#FFF9E6] text-neutral-900";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

const AdminSupportTicketsPage = () => {
  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [rows, setRows] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "all">("open");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [ticketMeta, setTicketMeta] = useState<TicketRow | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = filter === "open" ? "?status=open" : "";
      const res = await fetch(`${API_BASE}/admin/support/tickets${qs}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.tickets)) {
        setRows(data.tickets);
      } else {
        setRows([]);
        if (data.error) {
          toast({ title: "Support", description: data.error, variant: "destructive" });
        }
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openTicket = async (row: TicketRow) => {
    setActiveId(row.id);
    setTicketMeta(row);
    setDialogOpen(true);
    setReply("");
    setLoadingDetail(true);
    setMessages([]);
    try {
      const res = await fetch(`${API_BASE}/admin/support/tickets/${row.id}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.messages)) {
        setMessages(data.messages);
        if (data.ticket) {
          setTicketMeta((prev) => ({
            ...(prev ?? row),
            ...data.ticket,
          }));
        }
      } else {
        toast({
          title: "Could not load ticket",
          description: data.error,
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (!dialogOpen) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, dialogOpen, loadingDetail]);

  const sendReply = async () => {
    if (activeId == null) return;
    const body = reply.trim();
    if (!body) return;
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/admin/support/tickets/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (data.success) {
        setReply("");
        const r2 = await fetch(`${API_BASE}/admin/support/tickets/${activeId}`);
        const d2 = await r2.json();
        if (d2.success && Array.isArray(d2.messages)) setMessages(d2.messages);
        await load();
      } else {
        toast({
          title: "Could not send",
          description: data.error,
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const toggleClosed = async () => {
    if (activeId == null || !ticketMeta) return;
    const next = ticketMeta.status === "open" ? "closed" : "open";
    setClosing(true);
    try {
      const res = await fetch(`${API_BASE}/admin/support/tickets/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (data.success) {
        setTicketMeta({ ...ticketMeta, status: next });
        await load();
        toast({
          title: next === "closed" ? "Ticket closed" : "Ticket reopened",
        });
      } else {
        toast({
          title: "Update failed",
          description: data.error,
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Headphones className="h-7 w-7" />
            Support tickets
          </h1>
          <p className="text-sm text-slate-600">Reply to users and close tickets when resolved.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-[#F9F9F9] p-0.5">
            <button
              type="button"
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-semibold",
                filter === "open" ? "bg-[#FFD700] text-black" : "text-slate-600",
              )}
              onClick={() => setFilter("open")}
            >
              Open
            </button>
            <button
              type="button"
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-semibold",
                filter === "all" ? "bg-[#FFD700] text-black" : "text-slate-600",
              )}
              onClick={() => setFilter("all")}
            >
              All
            </button>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => load()} disabled={loading}>
            <RefreshCw className={cn("mr-1 h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-[#F9F9F9] text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3"> </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-400" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    No tickets in this view.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">#{r.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {r.user_name || r.user_telegram || `User ${r.user_id}`}
                      </div>
                      <div className="text-xs text-slate-500">
                        {r.user_email ? `${r.user_email} · ` : ""}
                        {r.user_telegram ? `@${r.user_telegram}` : ""}
                      </div>
                    </td>
                    <td className="max-w-[240px] px-4 py-3">
                      <div className="truncate font-medium text-slate-800">{r.subject}</div>
                      {r.last_message_preview ? (
                        <div className="truncate text-xs text-slate-500">{r.last_message_preview}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-block rounded-full border px-2 py-0.5 text-xs font-semibold capitalize",
                          statusBadge(r.status),
                        )}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                      {new Date(r.updated_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-slate-200"
                        onClick={() => openTicket(r)}
                      >
                        Open chat
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex h-[min(90vh,720px)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="border-b border-slate-200 px-4 py-3 text-left">
            <DialogTitle className="pr-8 text-base leading-snug">
              #{activeId} · {ticketMeta?.subject ?? "Ticket"}
            </DialogTitle>
            {ticketMeta ? (
              <p className="text-xs text-slate-500">
                User #{ticketMeta.user_id}
                {ticketMeta.user_name ? ` · ${ticketMeta.user_name}` : ""}
                {ticketMeta.user_telegram ? ` · @${ticketMeta.user_telegram}` : ""}
              </p>
            ) : null}
          </DialogHeader>

          <ScrollArea className="h-[min(380px,calc(90vh-240px))] px-4">
            <div className="space-y-3 py-4">
              {loadingDetail ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "flex",
                      m.sender_role === "admin" ? "justify-end" : "justify-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[88%] rounded-2xl px-4 py-2.5 text-sm",
                        m.sender_role === "admin"
                          ? "rounded-br-md bg-[#FFD700] text-black"
                          : "rounded-bl-md border border-slate-200 bg-[#F9F9F9] text-slate-800",
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p
                        className={cn(
                          "mt-1 text-[10px] opacity-75",
                          m.sender_role === "admin" ? "text-black/70" : "text-slate-500",
                        )}
                      >
                        {m.sender_role === "admin" ? "You (admin)" : "User"} ·{" "}
                        {new Date(m.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <div className="border-t border-slate-200 p-3">
            <div className="mb-2 flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 border-slate-200"
                disabled={closing || !ticketMeta}
                onClick={toggleClosed}
              >
                {closing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : ticketMeta?.status === "open" ? (
                  <>
                    <Lock className="mr-2 h-4 w-4" /> Close ticket
                  </>
                ) : (
                  <>
                    <Unlock className="mr-2 h-4 w-4" /> Reopen
                  </>
                )}
              </Button>
            </div>
            {ticketMeta?.status === "open" ? (
              <div className="flex gap-2">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Reply to user…"
                  className="min-h-[80px] resize-none border-slate-200"
                />
                <Button
                  type="button"
                  className="shrink-0 self-end bg-[#FFD700] px-4 font-semibold text-black hover:bg-[#E6C200]"
                  disabled={sending || !reply.trim()}
                  onClick={sendReply}
                >
                  {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
              </div>
            ) : (
              <p className="text-center text-sm text-slate-500">Ticket is closed. Reopen to reply.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSupportTicketsPage;
