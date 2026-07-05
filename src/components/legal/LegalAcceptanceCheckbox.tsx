import { Link } from "react-router-dom";

type LegalAcceptanceCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
};

export function LegalAcceptanceCheckbox({
  checked,
  onChange,
  id = "legal-accept",
}: LegalAcceptanceCheckboxProps) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 transition-colors hover:bg-slate-50"
    >
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-yellow-600 focus:ring-yellow-500"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm leading-relaxed text-slate-600">
        I have read and agree to the{" "}
        <Link
          to="/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-slate-900 underline hover:text-yellow-900"
        >
          Privacy Policy
        </Link>
        ,{" "}
        <Link
          to="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-slate-900 underline hover:text-yellow-900"
        >
          Terms &amp; Conditions
        </Link>
        , and{" "}
        <Link
          to="/refund-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-slate-900 underline hover:text-yellow-900"
        >
          Refund Policy
        </Link>
        . <span className="font-semibold text-slate-800">(Required)</span>
      </span>
    </label>
  );
}
