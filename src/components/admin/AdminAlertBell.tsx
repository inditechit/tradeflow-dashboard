import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { API_BASE } from "@/config/api";

type AdminAlert = {
  id: number;
  alert_type: string;
  user_id: number | null;
  title: string;
  message: string;
  link_url: string | null;
  read_at: string | null;
  created_at: string;
  user_name?: string | null;
};

export function AdminAlertBell() {
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<AdminAlert[]>([]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/alerts?limit=12`);
      const data = await res.json();
      if (data.success) {
        setItems(data.rows ?? []);
        setUnread(Number(data.unread ?? 0));
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 25_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const markRead = async (alertId: number) => {
    try {
      await fetch(`${API_BASE}/admin/alerts/${alertId}/read`, { method: "PATCH" });
      setUnread((c) => Math.max(0, c - 1));
      setItems((prev) =>
        prev.map((x) => (x.id === alertId ? { ...x, read_at: new Date().toISOString() } : x)),
      );
    } catch {
      /* ignore */
    }
  };

  const onItemClick = async (a: AdminAlert) => {
    if (!a.read_at) await markRead(a.id);
    if (a.link_url?.includes("/admin/alerts")) {
      navigate(a.link_url);
    } else if (a.user_id && (a.alert_type === "user_stop_trading" || a.alert_type === "user_restart_trading")) {
      navigate(`/admin/alerts?alert=${a.id}`);
    } else if (a.link_url) {
      navigate(a.link_url);
    } else if (a.user_id) {
      navigate(`/admin/alerts?alert=${a.id}`);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="relative shrink-0" aria-label="Admin alerts">
          <Bell className="h-5 w-5 text-slate-700" />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 border-slate-200 bg-white p-1 shadow-lg">
        <DropdownMenuLabel className="text-slate-700">Admin alerts</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-200" />
        {items.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-slate-500">No alerts yet</p>
        ) : (
          items.map((a) => (
            <DropdownMenuItem
              key={a.id}
              className="cursor-pointer flex-col items-start gap-0.5 py-2 focus:bg-slate-100"
              onClick={() => void onItemClick(a)}
            >
              <span className={`text-sm font-medium ${a.read_at ? "text-slate-600" : "text-slate-900"}`}>
                {a.title}
              </span>
              <span className="line-clamp-2 text-xs text-slate-500">{a.message}</span>
              <span className="text-[10px] text-slate-400">
                {a.created_at ? new Date(a.created_at).toLocaleString() : ""}
              </span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator className="bg-slate-200" />
        <DropdownMenuItem
          className="cursor-pointer justify-center text-xs font-semibold text-[#B8860B]"
          onClick={() => navigate("/admin/alerts")}
        >
          View all alerts
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
