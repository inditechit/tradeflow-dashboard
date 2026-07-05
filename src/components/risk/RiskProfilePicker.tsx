import { RISK_PROFILES } from "@/constants/riskProfiles";

type RiskProfilePickerProps = {
  selectedRisk: string | null;
  onSelect: (riskId: string) => void;
  name?: string;
};

export function RiskProfilePicker({
  selectedRisk,
  onSelect,
  name = "risk-profile",
}: RiskProfilePickerProps) {
  return (
    <div className="space-y-3" role="radiogroup" aria-label="Risk profile">
      {RISK_PROFILES.map((risk) => {
        const isSelected = selectedRisk === risk.id;
        return (
          <label
            key={risk.id}
            className={`flex cursor-pointer items-start gap-4 rounded-xl border-2 p-4 transition-all ${
              isSelected
                ? "border-yellow-400 bg-yellow-50/50"
                : "border-slate-100 hover:border-slate-300"
            }`}
          >
            <div className="pt-1">
              <input
                type="radio"
                name={name}
                className="h-5 w-5 border-slate-300 text-[#FFD700] focus:ring-[#FFD700]"
                checked={isSelected}
                onChange={() => onSelect(risk.id)}
              />
            </div>
            <div className="flex-1">
              <div
                className={`mb-2 inline-block rounded border px-2 py-0.5 text-xs font-bold ${risk.color}`}
              >
                {risk.title}
              </div>
              <p className="mb-1 text-sm font-semibold text-slate-800">{risk.allocation}</p>
              <p className="text-xs text-slate-500">
                Estimated monthly risk exposure:{" "}
                <span className="font-semibold text-slate-700">{risk.exposure}</span>
              </p>
            </div>
          </label>
        );
      })}
    </div>
  );
}
