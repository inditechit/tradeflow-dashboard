import { Link } from "react-router-dom";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { CONTACT_EMAIL } from "@/constants/packages";
import { LEGAL_BRAND, LEGAL_LAST_UPDATED } from "@/constants/legal";

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

type LegalPageShellProps = {
  title: string;
  icon: LucideIcon;
  intro: React.ReactNode;
  children: React.ReactNode;
};

export function LegalPageShell({ title, icon: Icon, intro, children }: LegalPageShellProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <div className="mt-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFD700]/20 text-slate-900">
            <Icon className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
            <p className="text-xs text-slate-500">Last updated: {LEGAL_LAST_UPDATED}</p>
          </div>
        </div>

        <p className="mt-6 text-sm leading-relaxed text-slate-600">{intro}</p>

        {children}

        <LegalPageShellFooter />
      </div>
    </div>
  );
}

function LegalPageShellFooter() {
  return (
    <div className="mt-10 space-y-4 border-t border-slate-200 pt-6 text-xs text-slate-500">
      <p>
        Questions? Email{" "}
        <a className="font-medium text-slate-700 underline" href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>
        .
      </p>
      <p className="text-slate-400">
        © {new Date().getFullYear()} {LEGAL_BRAND}. Market risk applies. No guaranteed returns.
      </p>
      <nav className="flex flex-wrap gap-x-4 gap-y-1">
        <Link to="/privacy-policy" className="font-medium text-slate-600 underline hover:text-slate-900">
          Privacy Policy
        </Link>
        <Link to="/terms" className="font-medium text-slate-600 underline hover:text-slate-900">
          Terms &amp; Conditions
        </Link>
        <Link to="/refund-policy" className="font-medium text-slate-600 underline hover:text-slate-900">
          Refund Policy
        </Link>
        <Link to="/trading-loss-sop" className="font-medium text-slate-600 underline hover:text-slate-900">
          Loss responsibility (SOP)
        </Link>
      </nav>
    </div>
  );
}
