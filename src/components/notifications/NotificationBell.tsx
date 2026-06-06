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
import {
  handleNotificationClick,
  NotificationDetailDialog,
  type NotificationItem,
} from "@/components/notifications/NotificationDetailDialog";

type Props = {
  userId: string | number | undefined;
  listPath?: string;
};

export function NotificationBell({ userId, listPath = "/user/notifications" }: Props) {
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [popup, setPopup] = useState<NotificationItem | null>(null);

  const uid = userId != null ? String(userId) : "";

  const refresh = useCallback(async () => {
    if (!uid) return;
    try {
      const [countRes, listRes] = await Promise.all([
        fetch(`${API_BASE}/user/notifications/${uid}/unread-count`),
        fetch(`${API_BASE}/user/notifications/${uid}?limit=8`),
      ]);
      const countData = await countRes.json();
      const listData = await listRes.json();
      if (countData.success) setUnread(Number(countData.unread ?? 0));
      if (listData.success) setItems(listData.rows ?? []);
    } catch {
      /* ignore */
    }
  }, [uid]);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const markRead = async (notificationId: number) => {
    if (!uid) return;
    try {
      await fetch(`${API_BASE}/user/notifications/${uid}/${notificationId}/read`, {
        method: "PATCH",
      });
      setUnread((c) => Math.max(0, c - 1));
      setItems((prev) =>
        prev.map((x) => (x.id === notificationId ? { ...x, read_at: new Date().toISOString() } : x)),
      );
    } catch {
      /* ignore */
    }
  };

  const onItemClick = async (n: NotificationItem) => {
    if (!n.read_at) await markRead(n.id);
    handleNotificationClick(n, navigate, setPopup);
  };

  if (!uid) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative h-10 w-10 shrink-0 touch-manipulation"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5 text-slate-700" />
            {unread > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 border-slate-200 bg-white p-0 shadow-lg">
          <DropdownMenuLabel className="px-3 py-2 text-sm font-semibold text-slate-800">
            Notifications
            {unread > 0 ? (
              <span className="ml-2 text-xs font-normal text-slate-500">{unread} unread</span>
            ) : null}
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-slate-200" />
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">No notifications yet</p>
          ) : (
            items.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className={`cursor-pointer flex-col items-start gap-0.5 px-3 py-2.5 ${
                  !n.read_at ? "bg-sky-50/80" : ""
                }`}
                onClick={() => onItemClick(n)}
              >
                <span className="text-sm font-semibold text-slate-900">{n.title}</span>
                <span className="line-clamp-2 text-xs text-slate-600">{n.message}</span>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator className="bg-slate-200" />
          <DropdownMenuItem
            className="cursor-pointer justify-center py-2.5 text-sm font-semibold text-neutral-900"
            onClick={() => navigate(listPath)}
          >
            View all
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NotificationDetailDialog
        open={Boolean(popup)}
        notification={popup}
        onClose={() => setPopup(null)}
        onOpenLink={(url) => {
          if (/^https?:\/\//i.test(url)) window.open(url, "_blank", "noopener,noreferrer");
          else navigate(url.startsWith("/") ? url : `/${url}`);
          setPopup(null);
        }}
      />
    </>
  );
}
