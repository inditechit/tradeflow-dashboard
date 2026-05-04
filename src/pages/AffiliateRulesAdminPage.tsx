import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_BASE = "https://mt5api.inditechit.com/api";

type Rule = {
  id: number;
  level: number;
  min_recharge_usd: string | number;
  max_recharge_usd: string | number | null;
  commission_percent: string | number;
  is_active: number;
  updated_at?: string;
};

const AffiliateRulesAdminPage = () => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/affiliate/rules`);
      const data = await res.json();
      if (data.success) setRules(data.rules ?? []);
      else toast({ title: "Error", description: data.error || "Failed to load rules", variant: "destructive" });
    } catch {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveRule = async (r: Rule, patch: Partial<Rule>) => {
    setSavingId(r.id);
    try {
      const res = await fetch(`${API_BASE}/admin/affiliate/rules/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Saved", description: "Rule updated." });
        await load();
      } else {
        toast({ title: "Save failed", description: data.error || "Unknown error", variant: "destructive" });
      }
    } catch {
      toast({ title: "Save failed", description: "Network error", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="animate-spin text-cyan-600" size={32} />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Affiliate commission rules</h1>
      <p className="text-sm text-slate-500 mb-4">
        Set percentage <strong>per level</strong> (1 = direct upline … 4).{" "}
        <strong>Min / Max USD</strong> are optional brackets: they match the <em>gross</em> recharge amount (e.g. only pay these % if recharge is between min and max).
      </p>
      <div className="mb-6 rounded-xl border border-cyan-200 bg-cyan-50/80 px-4 py-3 text-sm text-slate-800">
        <p className="font-semibold text-cyan-900 mb-1">How payouts are calculated</p>
        <ul className="list-disc list-inside space-y-1 text-slate-700">
          <li>
            A flat <strong>10% platform fee</strong> is taken from each recharge first (configurable on server:{" "}
            <code className="text-xs bg-white px-1 rounded">AFFILIATE_PLATFORM_FEE_PERCENT</code>).
          </li>
          <li>
            Commissions use the <strong>remaining 90%</strong> as the base. Level 1 pays{" "}
            <strong>(commission % ÷ 100) × that base</strong>, using the % you set below for levels 1–4 (e.g. 10%, 13.33%, 23.33%, 53.33%).
          </li>
        </ul>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left">
              <th className="p-3 font-semibold text-slate-700">Level</th>
              <th className="p-3 font-semibold text-slate-700">Min USD</th>
              <th className="p-3 font-semibold text-slate-700">Max USD</th>
              <th className="p-3 font-semibold text-slate-700">Commission %</th>
              <th className="p-3 font-semibold text-slate-700">Active</th>
              <th className="p-3 font-semibold text-slate-700"></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <RuleRow
                key={`${r.id}-${r.updated_at ?? ""}`}
                rule={r}
                saving={savingId === r.id}
                onSave={saveRule}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

function RuleRow({
  rule,
  saving,
  onSave,
}: {
  rule: Rule;
  saving: boolean;
  onSave: (r: Rule, patch: Partial<Rule>) => void;
}) {
  const [pct, setPct] = useState(String(rule.commission_percent));
  const [minV, setMinV] = useState(String(rule.min_recharge_usd));
  const [maxV, setMaxV] = useState(rule.max_recharge_usd == null ? "" : String(rule.max_recharge_usd));
  const [active, setActive] = useState(rule.is_active === 1);

  return (
    <tr className="border-b border-slate-100">
      <td className="p-3 font-medium">{rule.level}</td>
      <td className="p-3">
        <input
          className="w-24 border rounded px-2 py-1 text-black"
          value={minV}
          onChange={(e) => setMinV(e.target.value)}
        />
      </td>
      <td className="p-3">
        <input
          className="w-28 border rounded px-2 py-1 text-black"
          placeholder="∞ empty"
          value={maxV}
          onChange={(e) => setMaxV(e.target.value)}
        />
      </td>
      <td className="p-3">
        <input
          className="w-24 border rounded px-2 py-1 text-black"
          value={pct}
          onChange={(e) => setPct(e.target.value)}
        />
      </td>
      <td className="p-3">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
      </td>
      <td className="p-3">
        <button
          type="button"
          disabled={saving}
          onClick={() =>
            onSave(rule, {
              commission_percent: Number(pct),
              min_recharge_usd: Number(minV),
              max_recharge_usd: maxV.trim() === "" ? null : Number(maxV),
              is_active: active,
            })
          }
          className="px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-semibold hover:bg-cyan-700 disabled:opacity-50"
        >
          {saving ? "…" : "Save"}
        </button>
      </td>
    </tr>
  );
}

export default AffiliateRulesAdminPage;
