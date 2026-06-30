import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/config/api";
import {
  CallRingPlayer,
  getAdminCallPrefs,
  getAdminCallWatermarks,
  saveAdminCallWatermarks,
  type AdminCallAlertType,
  type AdminCallNotificationPrefs,
  type AdminCallWatermarks,
} from "@/utils/adminCallRingtones";
import type { AdminSidebarBadges } from "@/utils/adminSidebarSeen";
import { getAdminUsersSeenAt } from "@/utils/adminSidebarSeen";

export type IncomingAdminCall = {
  key: string;
  type: AdminCallAlertType;
  title: string;
  subtitle: string;
  link: string;
};

type PendingWithdrawalPeek = {
  id: number;
  user_id: number;
  amount_usd: number | string;
  user_name?: string | null;
  created_at?: string;
};

export function useAdminCallAlerts(pollMs = 12_000) {
  const [prefs, setPrefsState] = useState(getAdminCallPrefs);
  const [incoming, setIncoming] = useState<IncomingAdminCall | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const playerRef = useRef(new CallRingPlayer());
  const watermarksRef = useRef<AdminCallWatermarks>(getAdminCallWatermarks());
  const ringingRef = useRef(false);
  const initializedRef = useRef(false);

  const setPrefs = useCallback((next: AdminCallNotificationPrefs) => {
    setPrefsState(next);
  }, []);

  const stopRing = useCallback(() => {
    playerRef.current.stop();
    ringingRef.current = false;
  }, []);

  const startRing = useCallback(() => {
    if (!prefs.enabled || ringingRef.current) return;
    ringingRef.current = true;
    // Single alert ping (not a looping ringtone).
    void playerRef.current.playOnce(prefs.soundId, prefs.volume);
  }, [prefs.enabled, prefs.soundId, prefs.volume]);

  const dismissCall = useCallback(() => {
    stopRing();
    setIncoming(null);
  }, [stopRing]);

  const unlockAudio = useCallback(async () => {
    await playerRef.current.unlock();
    setAudioReady(true);
  }, []);

  const previewSound = useCallback(
    async (soundId = prefs.soundId) => {
      await playerRef.current.preview(soundId, prefs.volume);
    },
    [prefs.soundId, prefs.volume],
  );

  const triggerCall = useCallback(
    (call: IncomingAdminCall, wmPatch: Partial<AdminCallWatermarks>) => {
      if (!prefs.enabled || !prefs.types[call.type]) return;
      if (incoming?.key === call.key) return;
      watermarksRef.current = { ...watermarksRef.current, ...wmPatch };
      saveAdminCallWatermarks(watermarksRef.current);
      setIncoming(call);
      startRing();
    },
    [incoming?.key, prefs.enabled, prefs.types, startRing],
  );

  const poll = useCallback(async () => {
    if (!prefs.enabled) return;

    const wm = { ...watermarksRef.current };
    let badges: AdminSidebarBadges | null = null;

    try {
      const qs = new URLSearchParams();
      const seenAt = getAdminUsersSeenAt();
      if (seenAt) qs.set("users_since", seenAt);
      const [badgeRes, withdrawRes, alertRes] = await Promise.all([
        fetch(`${API_BASE}/admin/sidebar-badges?${qs.toString()}`),
        fetch(`${API_BASE}/admin/withdrawals?status=pending&limit=10&page=1`),
        fetch(`${API_BASE}/admin/alerts?limit=5&unread=1`),
      ]);
      const badgeJson = await badgeRes.json();
      const withdrawJson = await withdrawRes.json();
      const alertJson = await alertRes.json();

      if (badgeJson?.success && badgeJson.badges) {
        badges = badgeJson.badges as AdminSidebarBadges;
      }

      const pendingRows: PendingWithdrawalPeek[] = Array.isArray(withdrawJson?.withdrawals)
        ? withdrawJson.withdrawals
        : [];
      const maxWithdrawId = pendingRows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
      const newestWithdraw = pendingRows.sort((a, b) => Number(b.id) - Number(a.id))[0];

      const alertRows = Array.isArray(alertJson?.rows) ? alertJson.rows : [];
      const maxAlertId = alertRows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
      const newestAlert = alertRows.sort((a, b) => Number(b.id) - Number(a.id))[0];

      if (!initializedRef.current) {
        initializedRef.current = true;
        watermarksRef.current = {
          ...wm,
          lastWithdrawalId: Math.max(wm.lastWithdrawalId, maxWithdrawId),
          lastAlertId: Math.max(wm.lastAlertId, maxAlertId),
          support_needs_reply: badges?.support_needs_reply ?? wm.support_needs_reply,
          pending_recharges: badges?.pending_recharges ?? wm.pending_recharges,
          pending_withdrawals: badges?.pending_withdrawals ?? wm.pending_withdrawals,
          new_users: badges?.new_users ?? wm.new_users,
          open_support_tickets: badges?.open_support_tickets ?? wm.open_support_tickets,
          unmatched_payments: badges?.unmatched_payments ?? wm.unmatched_payments,
          unread_alerts: badges?.unread_alerts ?? wm.unread_alerts,
        };
        saveAdminCallWatermarks(watermarksRef.current);
        return;
      }

      if (
        prefs.types.withdrawal &&
        maxWithdrawId > wm.lastWithdrawalId &&
        newestWithdraw
      ) {
        const amt = Number(newestWithdraw.amount_usd ?? 0);
        triggerCall(
          {
            key: `withdrawal-${newestWithdraw.id}`,
            type: "withdrawal",
            title: "Incoming withdrawal request",
            subtitle: `${newestWithdraw.user_name ?? `User #${newestWithdraw.user_id}`} · $${amt.toFixed(2)} USDT`,
            link: "/admin/withdrawals",
          },
          { lastWithdrawalId: maxWithdrawId, pending_withdrawals: badges?.pending_withdrawals ?? wm.pending_withdrawals },
        );
        return;
      }

      if (prefs.types.alert && maxAlertId > wm.lastAlertId && newestAlert) {
        triggerCall(
          {
            key: `alert-${newestAlert.id}`,
            type: "alert",
            title: String(newestAlert.title ?? "New admin alert"),
            subtitle: String(newestAlert.message ?? "").slice(0, 120),
            link: newestAlert.link_url ? String(newestAlert.link_url) : "/admin/alerts",
          },
          { lastAlertId: maxAlertId, unread_alerts: badges?.unread_alerts ?? wm.unread_alerts },
        );
        return;
      }

      if (
        badges &&
        prefs.types.support &&
        Number(badges.support_needs_reply) > wm.support_needs_reply
      ) {
        triggerCall(
          {
            key: `support-${badges.support_needs_reply}-${Date.now()}`,
            type: "support",
            title: "Support ticket needs reply",
            subtitle: `${badges.support_needs_reply} ticket(s) waiting`,
            link: "/admin/support-tickets",
          },
          { support_needs_reply: Number(badges.support_needs_reply) },
        );
        return;
      }

      if (
        badges &&
        prefs.types.payment &&
        (Number(badges.pending_recharges) > wm.pending_recharges ||
          Number(badges.unmatched_payments) > wm.unmatched_payments)
      ) {
        triggerCall(
          {
            key: `payment-${badges.pending_recharges}-${badges.unmatched_payments}`,
            type: "payment",
            title: "Payment needs attention",
            subtitle: `${badges.pending_recharges} pending recharge(s) · ${badges.unmatched_payments} unmatched`,
            link: Number(badges.pending_recharges) > wm.pending_recharges
              ? "/admin/recharge"
              : "/admin/unmatched-payments",
          },
          {
            pending_recharges: Number(badges.pending_recharges),
            unmatched_payments: Number(badges.unmatched_payments),
          },
        );
        return;
      }

      if (badges && prefs.types.new_user && Number(badges.new_users) > wm.new_users) {
        triggerCall(
          {
            key: `new-user-${badges.new_users}`,
            type: "new_user",
            title: "New user registered",
            subtitle: `${badges.new_users} new user(s) since last visit`,
            link: "/admin/users?sort=joined_new&from=notification",
          },
          { new_users: Number(badges.new_users) },
        );
        return;
      }

      if (badges) {
        watermarksRef.current = {
          ...wm,
          support_needs_reply: Number(badges.support_needs_reply ?? wm.support_needs_reply),
          pending_recharges: Number(badges.pending_recharges ?? wm.pending_recharges),
          pending_withdrawals: Number(badges.pending_withdrawals ?? wm.pending_withdrawals),
          new_users: Number(badges.new_users ?? wm.new_users),
          open_support_tickets: Number(badges.open_support_tickets ?? wm.open_support_tickets),
          unmatched_payments: Number(badges.unmatched_payments ?? wm.unmatched_payments),
          unread_alerts: Number(badges.unread_alerts ?? wm.unread_alerts),
        };
        saveAdminCallWatermarks(watermarksRef.current);
      }
    } catch {
      /* best-effort */
    }
  }, [prefs.enabled, prefs.types, triggerCall]);

  useEffect(() => {
    const onPrefs = () => setPrefsState(getAdminCallPrefs());
    window.addEventListener("admin-call-prefs-changed", onPrefs);
    return () => window.removeEventListener("admin-call-prefs-changed", onPrefs);
  }, []);

  useEffect(() => {
    void poll();
    const id = window.setInterval(() => void poll(), pollMs);
    return () => window.clearInterval(id);
  }, [poll, pollMs]);

  useEffect(() => {
    if (!incoming) stopRing();
  }, [incoming, stopRing]);

  return {
    prefs,
    setPrefs,
    incoming,
    dismissCall,
    stopRing,
    previewSound,
    audioReady,
    unlockAudio,
    player: playerRef.current,
  };
}
