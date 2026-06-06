import React, { useCallback, useEffect, useState } from "react";
import { Bell, Loader2, CheckCheck } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { API_BASE } from "@/config/api";
import { Button } from "@/components/ui/button";
import {
  handleNotificationClick,
  NotificationDetailDialog,
  type NotificationItem,
} from "@/components/notifications/NotificationDetailDialog";
import { useNavigate } from "react-router-dom";

const UserNotificationsPage = () => {
  const { currentUser } = useApp();
  const navigate = useNavigate();
  const userId = currentUser?.userId;
  const [rows, setRows] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState<NotificationItem | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/user/notifications/${userId}?limit=100`);
      const data = await res.json();
      if (data.success) setRows(data.rows ?? []);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id: number) => {
    if (!userId) return;
    await fetch(`${API_BASE}/user/notifications/${userId}/${id}/read`, { method: "PATCH" });
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, read_at: new Date().toISOString() } : r)),
    );
  };

  const markAllRead = async () => {
    if (!userId) return;
    await fetch(`${API_BASE}/user/notifications/${userId}/read-all`, { method: "POST" });
    setRows((prev) => prev.map((r) => ({ ...r, read_at: r.read_at || new Date().toISOString() })));
  };

  const onClickRow = async (n: NotificationItem) => {
    if (!n.read_at) await markRead(n.id);
    handleNotificationClick(n, navigate, setPopup);
  };

  if (!userId) {
    return <p className="p-8 text-red-600">Please log in.</p>;
  }

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bell className="h-7 w-7 text-slate-800" />
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={markAllRead}>
          <CheckCheck className="mr-1 h-4 w-4" />
          Mark all read
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center text-slate-500 shadow-sm">
          No notifications yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => onClickRow(n)}
                className={`w-full rounded-xl border px-4 py-4 text-left shadow-sm transition hover:shadow-md ${
                  n.read_at
                    ? "border-slate-100 bg-white"
                    : "border-sky-200 bg-sky-50/60"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-900">{n.title}</p>
                  {!n.read_at ? (
                    <span className="shrink-0 rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                      New
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{n.message}</p>
                <p className="mt-2 text-xs text-slate-400">
                  {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                  {n.link_url ? " · Has link" : ""}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

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
    </div>
  );
};

export default UserNotificationsPage;
