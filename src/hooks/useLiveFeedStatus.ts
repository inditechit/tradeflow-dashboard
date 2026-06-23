import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "@/config/api";

export type LiveFeedStatus = {
  hubConnected: boolean;
  hubClients: number;
  hubRelaying: boolean;
  mt5BridgeConnected: boolean;
  mt5FeedLive: boolean;
  secondsSinceTick: number | null;
  tickCount: number;
  mt5BridgeUrl: string | null;
  hasMt5Metrics: boolean;
  bridgeError: string | null;
};

const defaultStatus: LiveFeedStatus = {
  hubConnected: false,
  hubClients: 0,
  hubRelaying: false,
  mt5BridgeConnected: false,
  mt5FeedLive: false,
  secondsSinceTick: null,
  tickCount: 0,
  mt5BridgeUrl: null,
  hasMt5Metrics: false,
  bridgeError: null,
};

export function useLiveFeedStatus(pollMs = 8000) {
  const [status, setStatus] = useState<LiveFeedStatus>(defaultStatus);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/live-socket/status`);
      const data = await res.json();
      if (!data?.success) return;
      const hub = data.hub ?? {};
      const bridge = data.mt5_bridge ?? {};
      setStatus({
        hubConnected: Boolean(hub.ready),
        hubClients: Number(hub.clients ?? 0),
        hubRelaying: Boolean(hub.relaying),
        mt5BridgeConnected: Boolean(bridge.connected),
        mt5FeedLive: Boolean(bridge.feed_live),
        secondsSinceTick:
          bridge.seconds_since_last_tick != null
            ? Number(bridge.seconds_since_last_tick)
            : hub.seconds_since_last_tick != null
              ? Number(hub.seconds_since_last_tick)
              : null,
        tickCount: Number(bridge.tick_count ?? hub.tick_count ?? 0),
        mt5BridgeUrl: data.mt5_bridge_url ?? bridge.url ?? null,
        hasMt5Metrics: Boolean(data.has_mt5_metrics),
        bridgeError: bridge.last_error ?? null,
      });
    } catch {
      /* keep last */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), pollMs);
    return () => window.clearInterval(id);
  }, [refresh, pollMs]);

  return { status, refresh };
}
