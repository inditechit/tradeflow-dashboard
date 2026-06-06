import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, X } from "lucide-react";
import { API_BASE } from "@/config/api";
import {
  handleNotificationClick,
  NotificationDetailDialog,
  type NotificationItem,
} from "@/components/notifications/NotificationDetailDialog";

type Props = {
  userId: string | undefined;
};

export function DashboardNotificationsBanner({ userId }: Props) {
  const navigate = useNavigate();
  const [latest, setLatest] = useState<NotificationItem | null>(null);
  const [dismissedId, setDismissedId] = useState<number | null>(null);
  const [popup, setPopup] = useState<NotificationItem | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE}/user/notifications/${userId}?limit=5`);
      const data = await res.json();
      if (!data.success) return;
      const unread = (data.rows as NotificationItem[] | undefined)?.find((r) => !r.read_at);
      setLatest(unread ?? null);
    } catch {
      /* ignore */
    }
  }, [userId]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  if (!latest || latest.id === dismissedId) return null;

  const onOpen = async () => {
    await fetch(`${API_BASE}/user/notifications/${userId}/${latest.id}/read`, {
      method: "PATCH",
    });
    handleNotificationClick(latest, navigate, setPopup);
    setLatest(null);
  };

  return (
    <>
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-slate-800 shadow-sm">
        <Bell className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" />
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
          <p className="font-semibold text-slate-900">{latest.title}</p>
          <p className="mt-0.5 line-clamp-2 text-slate-600">{latest.message}</p>
          <span className="mt-1 inline-block text-xs font-medium text-sky-800">Tap to open</span>
        </button>
        <button
          type="button"
          aria-label="Dismiss"
          className="shrink-0 rounded p-1 text-slate-400 hover:bg-sky-100 hover:text-slate-600"
          onClick={() => setDismissedId(latest.id)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

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
