import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ArrowRightLeft, Copy, Tag, UserPlus, Users, Wallet } from "lucide-react";
import { plTextClass } from "@/utils/plColors";
import { API_BASE } from "@/config/api";

type AffiliateCoupon = {
  id: number;
  code: string;
  name: string | null;
  package_id: string;
  package_name?: string | null;
  discount_percent: number | null;
  duration_days: number | null;
  is_active: boolean;
};

type ReferralConnection = {
  id: number;
  name: string | null;
  telegram: string | null;
  joined_at: string | null;
  first_package_at: string | null;
  paid_package_count: number;
  has_purchased: boolean;
};

function referralDisplayName(r: ReferralConnection) {
  if (r.telegram?.trim()) return r.telegram.trim();
  if (r.name?.trim()) return r.name.trim();
  return `User #${r.id}`;
}

const AffiliateProgramPage = () => {
  const raw = typeof window !== "undefined" ? localStorage.getItem("mt5_user") : null;
  const userData = raw ? JSON.parse(raw) : null;
  const userId = userData?.userId;

  const [summary, setSummary] = useState<{
    totalEarnedUsd: number;
    affiliateWalletBalance: number;
    affiliateWithdrawFeeUsd: number;
    directReferrals: number;
    commissionEvents: number;
    referralLinkPath: string;
    referralKey?: string;
    coupons?: AffiliateCoupon[];
  } | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [referrals, setReferrals] = useState<ReferralConnection[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copied, setCopied] = useState(false);
  const [transferAmount, setTransferAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [busy, setBusy] = useState("");

  const referralUrl = useMemo(() => {
    if (!summary?.referralLinkPath || typeof window === "undefined") return "";
    return `${window.location.origin}${summary.referralLinkPath}`;
  }, [summary?.referralLinkPath]);

  const load = useCallback(async () => {
    if (!userId) return;
    setError("");
    try {
      const [sRes, cRes, rRes] = await Promise.all([
        axios.get(`${API_BASE}/user/affiliate/summary/${userId}`),
        axios.get(`${API_BASE}/user/affiliate/commissions/${userId}?limit=100`),
        axios.get(`${API_BASE}/user/affiliate/referrals/${userId}?limit=100`),
      ]);
      if (sRes.data.success) {
        setSummary({
          totalEarnedUsd: Number(sRes.data.totalEarnedUsd ?? 0),
          affiliateWalletBalance: Number(sRes.data.affiliateWalletBalance ?? 0),
          affiliateWithdrawFeeUsd: Number(sRes.data.affiliateWithdrawFeeUsd ?? 5),
          directReferrals: Number(sRes.data.directReferrals ?? 0),
          commissionEvents: Number(sRes.data.commissionEvents ?? 0),
          referralLinkPath: String(sRes.data.referralLinkPath ?? ""),
          referralKey: sRes.data.referralKey ? String(sRes.data.referralKey) : undefined,
          coupons: Array.isArray(sRes.data.coupons) ? sRes.data.coupons : [],
        });
      }
      if (cRes.data.success) setRows(cRes.data.data ?? []);
      if (rRes.data.success) setReferrals(rRes.data.referrals ?? []);
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.error || e.message : "Failed to load";
      setError(String(msg));
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

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

  const handleTransfer = async () => {
    const amt = Number(transferAmount);
    if (!userId || !Number.isFinite(amt) || amt <= 0) {
      setError("Enter a valid transfer amount");
      return;
    }
    setBusy("transfer");
    setError("");
    setSuccess("");
    try {
      const res = await axios.post(`${API_BASE}/user/affiliate/transfer/${userId}`, { amount: amt });
      if (res.data.success) {
        setSuccess(`Moved $${amt.toFixed(2)} to your trading wallet.`);
        setTransferAmount("");
        await load();
      } else {
        setError(res.data.error || "Transfer failed");
      }
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.error || e.message : "Transfer failed";
      setError(String(msg));
    } finally {
      setBusy("");
    }
  };

  const handleWithdraw = async () => {
    const amt = Number(withdrawAmount);
    const fee = summary?.affiliateWithdrawFeeUsd ?? 5;
    if (!userId || !Number.isFinite(amt) || amt <= 0) {
      setError("Enter a valid withdrawal amount");
      return;
    }
    setBusy("withdraw");
    setError("");
    setSuccess("");
    try {
      const res = await axios.post(`${API_BASE}/user/affiliate/withdraw/${userId}`, { amount: amt });
      if (res.data.success) {
        setSuccess(
          `Withdrawal request submitted. You receive $${amt.toFixed(2)} USDT ($${fee} processing fee).`,
        );
        setWithdrawAmount("");
        await load();
      } else {
        setError(res.data.error || "Withdrawal failed");
      }
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.error || e.message : "Withdrawal failed";
      setError(String(msg));
    } finally {
      setBusy("");
    }
  };

  if (!userId) {
    return (
      <div className="w-full min-h-screen bg-white p-8 text-black">
        <p className="text-red-600">Please log in to view your affiliate program.</p>
      </div>
    );
  }

  const fee = summary?.affiliateWithdrawFeeUsd ?? 5;
  const affBal = summary?.affiliateWalletBalance ?? 0;

  return (
    <div className="w-full min-h-screen bg-white p-8 text-black">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Refer a friend</h1>
        <p className="text-gray-600 text-sm mt-1">
          Commissions go to your <strong>affiliate wallet</strong> (separate from trading balance).
          Tier bonuses apply when your referral buys a <strong>1-month</strong> package. Higher packages
          pay <strong>10% flat</strong> to you only. After your first 4 tier referrals per cycle, all
          packages pay 10% flat.
        </p>
      </div>

      {error ? (
        <div className="mb-4 p-4 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
      ) : null}
      {success ? (
        <div className="mb-4 p-4 rounded-lg bg-green-50 text-green-800 text-sm">{success}</div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="border rounded-xl p-5 shadow-sm flex items-start gap-3">
          <Wallet className="text-neutral-900 shrink-0 mt-1" size={22} />
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Affiliate wallet</p>
            <p className="text-2xl font-bold">{summary ? `${affBal.toFixed(2)} USD` : "—"}</p>
            <p className="text-xs text-gray-500 mt-1">
              Total earned (lifetime): {summary ? `${summary.totalEarnedUsd.toFixed(2)} USD` : "—"}
            </p>
          </div>
        </div>
        <div className="border rounded-xl p-5 shadow-sm flex items-start gap-3">
          <Users className="text-neutral-900 shrink-0 mt-1" size={22} />
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Direct referrals</p>
            <p className="text-2xl font-bold">{summary ? summary.directReferrals : "—"}</p>
          </div>
        </div>
        <div className="border rounded-xl p-5 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Your referral link</p>
          <p className="text-xs text-gray-600 mb-2">
            Share this link — friends get your coupon discount automatically. No user ID in the URL.
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <code className="text-xs bg-gray-100 px-2 py-1 rounded break-all flex-1 min-w-[200px]">
              {referralUrl || "Loading…"}
            </code>
            <button
              type="button"
              onClick={copyLink}
              disabled={!referralUrl}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-[#FFD700] text-black text-sm font-medium hover:bg-[#E6C200] disabled:opacity-50"
            >
              <Copy size={16} />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      </div>

      {summary?.coupons && summary.coupons.length > 0 ? (
        <div className="border rounded-xl p-5 shadow-sm mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Tag size={18} />
            <h2 className="font-semibold">Your referral coupons</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Each coupon gives a % discount on a package. Your link applies the matching coupon; buyers can also enter the code at checkout.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-600">
                  <th className="p-2 font-medium">Code</th>
                  <th className="p-2 font-medium">Name</th>
                  <th className="p-2 font-medium">Package</th>
                  <th className="p-2 font-medium">Discount</th>
                  <th className="p-2 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {summary.coupons.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="p-2 font-mono font-semibold">{c.code}</td>
                    <td className="p-2">{c.name || "—"}</td>
                    <td className="p-2">{c.package_name || c.package_id}</td>
                    <td className="p-2">{c.discount_percent != null ? `${c.discount_percent}%` : "—"}</td>
                    <td className="p-2">{c.duration_days != null ? `${c.duration_days} days` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="border rounded-xl overflow-hidden shadow-sm mb-10">
        <div className="px-4 py-3 bg-slate-50 border-b font-semibold flex items-center gap-2">
          <UserPlus size={18} />
          People who joined with your link
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white border-b text-left text-gray-600">
                <th className="p-3 font-medium">User</th>
                <th className="p-3 font-medium">Joined</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">First package</th>
              </tr>
            </thead>
            <tbody>
              {referrals.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-gray-500">
                    No one has signed up with your link yet. Share your referral link above.
                  </td>
                </tr>
              ) : (
                referrals.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100">
                    <td className="p-3 font-medium text-slate-900">{referralDisplayName(r)}</td>
                    <td className="p-3 whitespace-nowrap text-gray-600">
                      {r.joined_at ? new Date(r.joined_at).toLocaleString() : "—"}
                    </td>
                    <td className="p-3">
                      {r.has_purchased ? (
                        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                          Purchased package
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                          Joined
                        </span>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap text-gray-600">
                      {r.first_package_at ? new Date(r.first_package_at).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <div className="border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <ArrowRightLeft size={18} />
            <h2 className="font-semibold">Move to trading wallet</h2>
          </div>
          <p className="text-sm text-gray-600 mb-3">No fee. Funds join your normal wallet for copy trading.</p>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              placeholder="Amount USD"
              className="border rounded-lg px-3 py-2 text-sm flex-1"
            />
            <button
              type="button"
              onClick={handleTransfer}
              disabled={busy === "transfer"}
              className="px-4 py-2 rounded-lg bg-neutral-900 text-white text-sm font-medium disabled:opacity-50"
            >
              {busy === "transfer" ? "…" : "Transfer"}
            </button>
          </div>
        </div>

        <div className="border rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold mb-1">Withdraw affiliate balance</h2>
          <p className="text-sm text-gray-600 mb-3">
            USDT TRC20 to your profile address. <strong>${fee} processing fee</strong> per withdrawal
            (deducted from affiliate wallet in addition to payout).
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="You receive (USD)"
              className="border rounded-lg px-3 py-2 text-sm flex-1"
            />
            <button
              type="button"
              onClick={handleWithdraw}
              disabled={busy === "withdraw"}
              className="px-4 py-2 rounded-lg bg-[#FFD700] text-black text-sm font-medium disabled:opacity-50"
            >
              {busy === "withdraw" ? "…" : "Request"}
            </button>
          </div>
          {withdrawAmount && Number(withdrawAmount) > 0 ? (
            <p className="text-xs text-gray-500 mt-2">
              Total from affiliate wallet: ${(Number(withdrawAmount) + fee).toFixed(2)} (${Number(withdrawAmount).toFixed(2)} + ${fee} fee)
            </p>
          ) : null}
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
                <th className="p-3 font-medium">Package</th>
                <th className="p-3 font-medium">%</th>
                <th className="p-3 font-medium">You earned</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-500">
                    No commissions yet. Share your link — earnings start when a referral buys their first package.
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
                    <td className="p-3">
                      {Number(r.purchase_amount_usd ?? r.recharge_amount_usd ?? 0).toFixed(2)} USD
                      {r.package_id ? (
                        <span className="block text-xs text-gray-500">{r.package_id}</span>
                      ) : null}
                    </td>
                    <td className="p-3">{Number(r.percent_applied).toFixed(2)}%</td>
                    <td className={`p-3 font-medium ${plTextClass(Number(r.commission_usd))}`}>
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
