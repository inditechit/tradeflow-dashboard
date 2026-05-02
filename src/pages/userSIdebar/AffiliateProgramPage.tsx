import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Copy, Users, Wallet } from "lucide-react";

const API_BASE = "https://mt5api.inditechit.com/api";

const AffiliateProgramPage = () => {
  const raw = typeof window !== "undefined" ? localStorage.getItem("mt5_user") : null;
  const userData = raw ? JSON.parse(raw) : null;
  const userId = userData?.userId;

  const [summary, setSummary] = useState<{
    totalEarnedUsd: number;
    directReferrals: number;
    commissionEvents: number;
    referralLinkPath: string;
  } | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const referralUrl = useMemo(() => {
    if (!summary?.referralLinkPath || typeof window === "undefined") return "";
    return `${window.location.origin}${summary.referralLinkPath}`;
  }, [summary?.referralLinkPath]);

  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      setError("");
      try {
        const [sRes, cRes] = await Promise.all([
          axios.get(`${API_BASE}/user/affiliate/summary/${userId}`),
          axios.get(`${API_BASE}/user/affiliate/commissions/${userId}?limit=100`),
        ]);
        if (sRes.data.success) {
          setSummary({
            totalEarnedUsd: Number(sRes.data.totalEarnedUsd ?? 0),
            directReferrals: Number(sRes.data.directReferrals ?? 0),
            commissionEvents: Number(sRes.data.commissionEvents ?? 0),
            referralLinkPath: String(sRes.data.referralLinkPath ?? ""),
          });
        }
        if (cRes.data.success) setRows(cRes.data.data ?? []);
      } catch (e: unknown) {
        const msg = axios.isAxiosError(e) ? e.response?.data?.error || e.message : "Failed to load";
        setError(String(msg));
      }
    };

    load();
  }, [userId]);

  const copyLink = async () => {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy link");
    }
  };

  if (!userId) {
    return (
      <div className="w-full min-h-screen bg-white p-8 text-black">
        <p className="text-red-600">Please log in to view your affiliate program.</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-white p-8 text-black">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Affiliate Program</h1>
        <p className="text-gray-600 text-sm mt-1">
          Share your link. When your referrals recharge their wallet, you earn up to 4 levels deep — percentages are set by admin.
        </p>
      </div>

      {error ? (
        <div className="mb-4 p-4 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <div className="border rounded-xl p-5 shadow-sm flex items-start gap-3">
          <Wallet className="text-cyan-600 shrink-0 mt-1" size={22} />
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total earned</p>
            <p className="text-2xl font-bold">
              {summary ? `${summary.totalEarnedUsd.toFixed(2)} USD` : "—"}
            </p>
          </div>
        </div>
        <div className="border rounded-xl p-5 shadow-sm flex items-start gap-3">
          <Users className="text-cyan-600 shrink-0 mt-1" size={22} />
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Direct referrals</p>
            <p className="text-2xl font-bold">{summary ? summary.directReferrals : "—"}</p>
          </div>
        </div>
        <div className="border rounded-xl p-5 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Your referral link</p>
          <div className="flex flex-wrap gap-2 items-center">
            <code className="text-xs bg-gray-100 px-2 py-1 rounded break-all flex-1 min-w-[200px]">
              {referralUrl || "Loading…"}
            </code>
            <button
              type="button"
              onClick={copyLink}
              disabled={!referralUrl}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-700 disabled:opacity-50"
            >
              <Copy size={16} />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      </div>

      <div className="border rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-slate-50 border-b font-semibold">Commission history</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white border-b text-left text-gray-600">
                <th className="p-3 font-medium">Date</th>
                <th className="p-3 font-medium">Level</th>
                <th className="p-3 font-medium">From user</th>
                <th className="p-3 font-medium">Recharge</th>
                <th className="p-3 font-medium">%</th>
                <th className="p-3 font-medium">You earned</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-500">
                    No commissions yet. Share your link and wait for referrals to recharge.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100">
                    <td className="p-3 whitespace-nowrap">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                    </td>
                    <td className="p-3">{r.level}</td>
                    <td className="p-3">{r.source_telegram || `#${r.source_user_id}`}</td>
                    <td className="p-3">{Number(r.recharge_amount_usd).toFixed(2)} USD</td>
                    <td className="p-3">{Number(r.percent_applied).toFixed(2)}%</td>
                    <td className="p-3 font-medium text-emerald-700">
                      +{Number(r.commission_usd).toFixed(2)} USD
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AffiliateProgramPage;
