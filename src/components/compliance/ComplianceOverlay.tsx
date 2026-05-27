import { useNavigate } from "react-router-dom";
import { ShieldAlert, UserCircle, ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/button";

const ComplianceOverlay = () => {
  const navigate = useNavigate();

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="compliance-title"
      aria-describedby="compliance-desc"
      onKeyDown={(e) => {
        if (e.key === "Escape") e.preventDefault();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-sky-200/80 bg-white p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sky-100">
          <ShieldAlert className="h-6 w-6 text-sky-800" aria-hidden />
        </div>

        <h2
          id="compliance-title"
          className="text-xl font-bold text-slate-900 sm:text-2xl"
        >
          Finish profile & permissions
        </h2>

        <p id="compliance-desc" className="mt-3 text-sm leading-relaxed text-slate-600">
          Your package is active, but we still need your{" "}
          <span className="font-semibold">full profile</span>,{" "}
          <span className="font-semibold">location</span>, and a{" "}
          <span className="font-semibold">live camera photo</span> on file (same as standard
          signup). Use the guided setup, or open Profile to edit details. Withdraw stays available.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            className="w-full bg-[#FFD700] font-semibold text-black hover:bg-[#e6c200] sm:flex-1"
            onClick={() => navigate("/user/required-setup")}
          >
            <UserCircle className="mr-2 h-4 w-4" />
            Required setup
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:flex-1"
            onClick={() => navigate("/user/profile")}
          >
            Open profile
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:flex-1"
            onClick={() => navigate("/user/withdraw")}
          >
            <ArrowDownToLine className="mr-2 h-4 w-4" />
            Withdraw
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ComplianceOverlay;
