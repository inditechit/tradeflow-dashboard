import { useCallback, useEffect, useRef, useState } from "react";
import { LifeBuoy, Loader2, MailOpen, MessageCirclePlus, Send } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { API_BASE } from "@/config/api";
import { ListPaginationBar } from "@/components/trades/TradesPaginationBar";

const TICKET_PAGE_SIZE = 50;

type TicketListItem = {
  id: number;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
  first_message_preview: string | null;
  message_count: number | string;
  has_unread?: boolean | number | string;
};

type Msg = {
  id: number;
  sender_role: "user" | "admin";
  body: string;
  created_at: string;
};

function preview(s: string | null, max = 80) {
  if (!s) return "";
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

const SupportTicketsPage = () => {
  const { currentUser } = useApp();
  const { toast } = useToast();
  const userId = currentUser?.userId;
  const bottomRef = useRef<HTMLDivElement>(null);

  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [ticketTotal, setTicketTotal] = useState(0);
  const [ticketPage, setTicketPage] = useState(1);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [threadStatus, setThreadStatus] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [markingUnread, setMarkingUnread] = useState(false);

  const ticketHasUnread = (t: TicketListItem) =>
    t.has_unread === true || t.has_unread === 1 || t.has_unread === "1";

  const loadList = useCallback(async (pageNum = 1) => {
    if (!userId) return;
    setLoadingList(true);
    try {
      const offset = (pageNum - 1) * TICKET_PAGE_SIZE;
      const res = await fetch(
        `${API_BASE}/user/support/${userId}/tickets?limit=${TICKET_PAGE_SIZE}&offset=${offset}&page=${pageNum}`,
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.tickets)) {
        setTickets(data.tickets);
        setTicketTotal(Number(data.total ?? data.tickets.length));
        setTicketPage(pageNum);
      } else {
        setTickets([]);
        setTicketTotal(0);
        if (data.error) {
          toast({ title: "Support", description: data.error, variant: "destructive" });
        }
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setLoadingList(false);
    }
  }, [userId, toast]);

  const markTicketRead = useCallback(
    async (ticketId: number) => {
      if (!userId) return;
      try {
        await fetch(`${API_BASE}/user/support/${userId}/tickets/${ticketId}/read`, {
          method: "PATCH",
        });
        setTickets((prev) =>
          prev.map((t) => (t.id === ticketId ? { ...t, has_unread: false } : t)),
        );
      } catch {
        // best-effort
      }
    },
    [userId],
  );

  const loadThread = useCallback(
    async (ticketId: number) => {
      if (!userId) return;
      setLoadingThread(true);
      try {
        const res = await fetch(`${API_BASE}/user/support/${userId}/tickets/${ticketId}`);
        const data = await res.json();
        if (data.success && data.ticket && Array.isArray(data.messages)) {
          setThreadStatus(String(data.ticket.status));
          setMessages(data.messages);
          await markTicketRead(ticketId);
        } else {
          setMessages([]);
          setThreadStatus(null);
          if (data.error) {
            toast({ title: "Error", description: data.error, variant: "destructive" });
          }
        }
      } catch {
        toast({ title: "Could not load ticket", variant: "destructive" });
      } finally {
        setLoadingThread(false);
      }
    },
    [userId, toast, markTicketRead],
  );

  const handleMarkUnread = async () => {
    if (!userId || selectedId == null) return;
    setMarkingUnread(true);
    try {
      const res = await fetch(
        `${API_BASE}/user/support/${userId}/tickets/${selectedId}/unread`,
        { method: "PATCH" },
      );
      const data = await res.json();
      if (data.success) {
        setTickets((prev) =>
          prev.map((t) => (t.id === selectedId ? { ...t, has_unread: true } : t)),
        );
        toast({ title: "Marked as unread" });
      } else {
        toast({
          title: "Could not mark unread",
          description: data.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setMarkingUnread(false);
    }
  };

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId && !showNew) {
      loadThread(selectedId);
    }
  }, [selectedId, showNew, loadThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loadingThread]);

  const openNew = () => {
    setShowNew(true);
    setSelectedId(null);
    setMessages([]);
    setThreadStatus(null);
  };

  const selectTicket = (id: number) => {
    setShowNew(false);
    setSelectedId(id);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    const sub = newSubject.trim();
    const msg = newMessage.trim();
    if (!sub || !msg) {
      toast({ title: "Fill subject and message", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/user/support/${userId}/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: sub, message: msg }),
      });
      const data = await res.json();
      if (data.success && data.ticketId) {
        toast({ title: "Ticket created" });
        setNewSubject("");
        setNewMessage("");
        setShowNew(false);
        await loadList();
        setSelectedId(Number(data.ticketId));
      } else {
        toast({
          title: "Could not create ticket",
          description: data.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleSendReply = async () => {
    if (!userId || selectedId == null) return;
    const body = reply.trim();
    if (!body) return;
    setSending(true);
    try {
      const res = await fetch(
        `${API_BASE}/user/support/${userId}/tickets/${selectedId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        },
      );
      const data = await res.json();
      if (data.success) {
        setReply("");
        await loadThread(selectedId);
        await loadList();
      } else {
        toast({
          title: "Could not send",
          description: data.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (!userId) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6 text-slate-500">
        Sign in to use support.
      </div>
    );
  }

  const selectedTicket = tickets.find((x) => x.id === selectedId);
  const selectedTicketUnread = selectedTicket ? ticketHasUnread(selectedTicket) : false;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-col gap-1 border-b border-slate-200 pb-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <LifeBuoy className="h-7 w-7 text-neutral-800" />
          Support
        </h1>
      </div>

      <div className="grid min-h-[520px] gap-4 md:grid-cols-[minmax(0,280px)_1fr] md:gap-6">
        {/* Ticket list */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-3">
            <Button
              type="button"
              className="w-full bg-[#FFD700] font-semibold text-black hover:bg-[#E6C200]"
              onClick={openNew}
            >
              <MessageCirclePlus className="mr-2 h-4 w-4" />
              New ticket
            </Button>
          </div>
          <ScrollArea className="h-[420px] md:h-[560px]">
            <div className="p-2">
              {loadingList ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
              ) : tickets.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-slate-500">No tickets yet.</p>
              ) : (
                <ul className="space-y-1">
                  {tickets.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => selectTicket(t.id)}
                        className={cn(
                          "w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                          selectedId === t.id && !showNew
                            ? "border-[#FFD700] bg-[#FFF9E6]"
                            : "border-transparent bg-[#F9F9F9] hover:bg-slate-100",
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <div className="font-semibold text-slate-900 line-clamp-2 flex-1">
                            {t.subject}
                          </div>
                          {ticketHasUnread(t) && (
                            <span
                              className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-500"
                              title="Unread reply"
                            />
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          <span
                            className={cn(
                              "mr-2 inline-block rounded px-1.5 py-0.5 font-medium",
                              String(t.status) === "open"
                                ? "border border-[#FFD700]/60 bg-[#FFF9E6] text-neutral-900"
                                : "bg-slate-100 text-slate-600",
                            )}
                          >
                            {t.status}
                          </span>
                          {preview(t.first_message_preview, 60)}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </ScrollArea>
          <ListPaginationBar
            page={ticketPage}
            totalPages={Math.max(1, Math.ceil(ticketTotal / TICKET_PAGE_SIZE))}
            total={ticketTotal}
            pageSize={TICKET_PAGE_SIZE}
            onPageChange={(p) => void loadList(p)}
            itemLabel="tickets"
          />
        </div>

        {/* Thread / new form */}
        <div className="flex min-h-[420px] flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
          {showNew ? (
            <form onSubmit={handleCreate} className="flex flex-1 flex-col gap-4 p-4 md:p-6">
              <h2 className="text-lg font-bold text-slate-900">New support ticket</h2>
              <div className="space-y-2">
                <Label htmlFor="subj">Subject</Label>
                <Input
                  id="subj"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="Brief summary"
                  maxLength={255}
                  className="border-slate-200"
                />
              </div>
              <div className="flex min-h-0 flex-1 flex-col space-y-2">
                <Label htmlFor="msg">Message</Label>
                <Textarea
                  id="msg"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Describe your issue…"
                  className="min-h-[200px] flex-1 resize-none border-slate-200"
                />
              </div>
              <Button
                type="submit"
                disabled={creating}
                className="bg-[#FFD700] font-semibold text-black hover:bg-[#E6C200]"
              >
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Submit ticket"
                )}
              </Button>
            </form>
          ) : selectedId == null ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-slate-500">
              <MessageCirclePlus className="h-12 w-12 opacity-40" />
              <p>Select a ticket from the list or create a new one.</p>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 md:px-6">
                <div>
                  <h2 className="font-semibold text-slate-900">
                    {selectedTicket?.subject ?? "Ticket"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Status:{" "}
                    <span className="font-medium text-slate-700">{threadStatus ?? "…"}</span>
                  </p>
                </div>
                {messages.some((m) => m.sender_role === "admin") && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={markingUnread || selectedTicketUnread}
                    onClick={handleMarkUnread}
                    className="shrink-0 border-slate-200 text-slate-700"
                  >
                    {markingUnread ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <MailOpen className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Mark unread
                  </Button>
                )}
              </div>
              <ScrollArea className="min-h-0 flex-1 px-4 md:px-6">
                <div className="space-y-3 py-4">
                  {loadingThread ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                    </div>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m.id}
                        className={cn(
                          "flex",
                          m.sender_role === "user" ? "justify-end" : "justify-start",
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                            m.sender_role === "user"
                              ? "rounded-br-md bg-[#FFD700] text-black"
                              : "rounded-bl-md border border-slate-200 bg-[#F9F9F9] text-slate-800",
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                          <p
                            className={cn(
                              "mt-1 text-[10px] opacity-70",
                              m.sender_role === "user" ? "text-black/70" : "text-slate-500",
                            )}
                          >
                            {m.sender_role === "admin" ? "Support (UK)" : "You"} ·{" "}
                            {new Date(m.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={bottomRef} />
                </div>
              </ScrollArea>
              {threadStatus === "open" ? (
                <div className="border-t border-slate-200 p-3 md:p-4">
                  <div className="flex gap-2">
                    <Textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Type a reply…"
                      className="min-h-[72px] resize-none border-slate-200"
                    />
                    <Button
                      type="button"
                      className="shrink-0 self-end bg-[#FFD700] px-4 font-semibold text-black hover:bg-[#E6C200]"
                      disabled={sending || !reply.trim()}
                      onClick={handleSendReply}
                    >
                      {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="border-t border-slate-100 px-4 py-3 text-center text-sm text-slate-500">
                  This ticket is closed. Open a new ticket if you need more help.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupportTicketsPage;
