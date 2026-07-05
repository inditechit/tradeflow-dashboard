import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";
import { API_BASE } from "@/config/api";
import { RiskProfilePicker } from "@/components/risk/RiskProfilePicker";
import { useProfileCompliance } from "@/context/ProfileComplianceContext";
import { parseUserRiskIds, userNeedsRiskReselection } from "@/utils/userRiskProfile";
import { PROFILE_COMPLIANCE_REFRESH_EVENT } from "@/utils/profileComplianceEvents";

export default function ChooseRiskProfilePage() {
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const { profile, loading, fetchOk } = useProfileCompliance();
  const existing = parseUserRiskIds(profile?.risk);
  const [selectedRisk, setSelectedRisk] = useState<string | null>(
    existing.length === 1 ? existing[0] : null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!loading && fetchOk && !userNeedsRiskReselection(profile?.risk)) {
    return <Navigate to="/user/dashboard" replace />;
  }

  const saveRisk = async () => {
    const uid = currentUser?.userId;
    if (!uid) return;
    if (!selectedRisk) {
      setError("Please select one risk profile.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/user/${uid}/save-risk-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ risks: [selectedRisk] }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setError(data?.error || "Could not save risk profile.");
        return;
      }
      window.dispatchEvent(new Event(PROFILE_COMPLIANCE_REFRESH_EVENT));
      navigate("/user/dashboard", { replace: true });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg py-8 sm:py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
          <AlertTriangle className="h-6 w-6 shrink-0 text-amber-500" />
          Choose one risk profile
        </div>
        <p className="mb-6 text-sm leading-relaxed text-slate-600">
          Each account can use <strong>only one</strong> risk level. You previously had multiple
          profiles selected — please pick the single level you want to keep going forward.
        </p>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <RiskProfilePicker selectedRisk={selectedRisk} onSelect={setSelectedRisk} name="login-risk" />

        <Button
          type="button"
          className="mt-8 w-full bg-[#FFD700] py-6 text-base font-semibold text-black hover:bg-[#e6c200]"
          disabled={!selectedRisk || saving}
          onClick={() => void saveRisk()}
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Saving…
            </>
          ) : (
            "Save and continue"
          )}
        </Button>
      </div>
    </div>
  );
}
