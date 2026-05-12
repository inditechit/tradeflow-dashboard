import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2, MapPin, RefreshCw, Search } from "lucide-react";

const API_BASE = "https://mt5api.inditechit.com/api";

type AdminUserRow = {
  id: number | string;
  name?: string | null;
  email?: string | null;
  mobile?: string | null;
  telegram?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  kyc_status?: string | null;
};

type PinUser = AdminUserRow & {
  lat: number;
  lon: number;
};

// react-leaflet does not bundle default marker images that play nice with bundlers.
// Use small inline SVG pins (no extra network calls, no broken icon URLs).
const goldPinSvg = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="34" height="48" viewBox="0 0 34 48">
  <defs>
    <filter id="s" x="-30%" y="-10%" width="160%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="1.4" flood-opacity="0.28"/>
    </filter>
  </defs>
  <path filter="url(#s)" d="M17 0C7.6 0 0 7.6 0 17c0 12 17 31 17 31s17-19 17-31C34 7.6 26.4 0 17 0z" fill="#FFD700" stroke="#1a1a1a" stroke-width="1.5"/>
  <circle cx="17" cy="17" r="6.5" fill="#1a1a1a"/>
</svg>
`);
const greyPinSvg = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="34" height="48" viewBox="0 0 34 48">
  <defs>
    <filter id="s2" x="-30%" y="-10%" width="160%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="1.4" flood-opacity="0.25"/>
    </filter>
  </defs>
  <path filter="url(#s2)" d="M17 0C7.6 0 0 7.6 0 17c0 12 17 31 17 31s17-19 17-31C34 7.6 26.4 0 17 0z" fill="#94a3b8" stroke="#0f172a" stroke-width="1.2"/>
  <circle cx="17" cy="17" r="6.5" fill="#0f172a"/>
</svg>
`);

const goldIcon = L.icon({
  iconUrl: `data:image/svg+xml;charset=UTF-8,${goldPinSvg}`,
  iconSize: [34, 48],
  iconAnchor: [17, 46],
  popupAnchor: [0, -42],
});
const pendingIcon = L.icon({
  iconUrl: `data:image/svg+xml;charset=UTF-8,${greyPinSvg}`,
  iconSize: [34, 48],
  iconAnchor: [17, 46],
  popupAnchor: [0, -42],
});

function toCoord(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function fitToPins(map: L.Map, pins: PinUser[]) {
  if (pins.length === 0) return;
  if (pins.length === 1) {
    map.setView([pins[0].lat, pins[0].lon], 8, { animate: true });
    return;
  }
  const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lon] as [number, number]));
  map.fitBounds(bounds.pad(0.15), { animate: true });
}

function MapAutoFit({ pins }: { pins: PinUser[] }) {
  const map = useMap();
  useEffect(() => {
    if (pins.length > 0) fitToPins(map, pins);
  }, [map, pins]);
  return null;
}

const AdminUserMapPage: React.FC = () => {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setErr(null);
      const res = await fetch(`${API_BASE}/admin/users`);
      const data = await res.json();
      const list: AdminUserRow[] = Array.isArray(data?.users)
        ? data.users
        : Array.isArray(data)
          ? data
          : [];
      setUsers(list);
    } catch (e) {
      setErr((e as Error).message ?? "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const allPins: PinUser[] = useMemo(() => {
    const out: PinUser[] = [];
    for (const u of users) {
      const lat = toCoord(u.latitude);
      const lon = toCoord(u.longitude);
      if (lat == null || lon == null) continue;
      if (lat === 0 && lon === 0) continue;
      out.push({ ...u, lat, lon });
    }
    return out;
  }, [users]);

  const filteredPins: PinUser[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allPins;
    return allPins.filter((p) => {
      const haystack = [
        p.name,
        p.email,
        p.mobile,
        p.telegram,
        p.city,
        p.state,
        p.country,
        p.address,
        p.kyc_status,
      ]
        .map((v) => String(v ?? "").toLowerCase())
        .join(" ");
      return haystack.includes(q);
    });
  }, [allPins, query]);

  const usersWithoutLocation = users.length - allPins.length;

  return (
    <div className="mx-auto max-w-7xl p-4">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <MapPin className="h-6 w-6 text-yellow-700" />
            User map
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {loading ? "Loading users…" : `${filteredPins.length} pinned · ${usersWithoutLocation} without coordinates`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email, city…"
              className="rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-500/30 min-w-[260px]"
            />
          </div>
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-[#FFD700] px-5 py-2 font-bold text-black transition hover:bg-[#E6C200] disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {err && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl shadow-neutral-900/8">
        <div className="h-[640px] w-full">
          {loading && allPins.length === 0 ? (
            <div className="flex h-full items-center justify-center text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-yellow-700" />
              Loading map…
            </div>
          ) : (
            <MapContainer
              center={[20.5937, 78.9629]}
              zoom={4}
              minZoom={2}
              scrollWheelZoom
              className="h-full w-full"
              worldCopyJump
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapAutoFit pins={filteredPins} />
              {filteredPins.map((p) => {
                const verified = String(p.kyc_status ?? "").toLowerCase() === "verified";
                return (
                  <Marker
                    key={String(p.id)}
                    position={[p.lat, p.lon]}
                    icon={verified ? goldIcon : pendingIcon}
                  >
                    <Popup>
                      <div className="min-w-[210px] space-y-1 text-sm">
                        <div className="font-semibold text-slate-900">
                          {p.name || p.telegram || `User #${p.id}`}
                        </div>
                        {p.email && (
                          <div className="text-slate-600 break-all">{p.email}</div>
                        )}
                        {p.mobile && (
                          <div className="text-slate-600">📞 {p.mobile}</div>
                        )}
                        {p.telegram && (
                          <div className="text-slate-600">✈ {p.telegram}</div>
                        )}
                        {(p.city || p.state || p.country) && (
                          <div className="text-slate-600">
                            {[p.city, p.state, p.country].filter(Boolean).join(", ")}
                          </div>
                        )}
                        <div className="pt-1 text-xs text-slate-400 tabular-nums">
                          {p.lat.toFixed(5)}, {p.lon.toFixed(5)}
                        </div>
                        <div className="pt-1">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              verified
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            KYC: {p.kyc_status ?? "pending"}
                          </span>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          )}
        </div>
      </div>

      {filteredPins.length === 0 && !loading && (
        <div className="mt-4 rounded-xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-500">
          No users with a location {query ? "match your search." : "yet."}
        </div>
      )}
    </div>
  );
};

export default AdminUserMapPage;
