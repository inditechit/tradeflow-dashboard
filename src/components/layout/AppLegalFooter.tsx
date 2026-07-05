import { Link } from "react-router-dom";
import { LEGAL_BRAND } from "@/constants/legal";

export function AppLegalFooter() {
  return (
    <footer className="shrink-0 border-t border-slate-200 bg-slate-50 px-3 py-4 sm:px-4 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p className="text-xs text-slate-400">
          © {new Date().getFullYear()} {LEGAL_BRAND}. Market risk applies.
        </p>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-slate-500">
          <Link to="/privacy-policy" className="hover:text-slate-900">
            Privacy Policy
          </Link>
          <Link to="/terms" className="hover:text-slate-900">
            Terms &amp; Conditions
          </Link>
          <Link to="/refund-policy" className="hover:text-slate-900">
            Refund Policy
          </Link>
          <Link to="/trading-loss-sop" className="hover:text-slate-900">
            Loss responsibility (SOP)
          </Link>
        </nav>
      </div>
    </footer>
  );
}
