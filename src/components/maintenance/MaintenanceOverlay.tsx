import { Construction, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";

type Props = {
  message: string;
};

const MaintenanceOverlay = ({ message }: Props) => {
  const { logout } = useApp();

  const displayMessage =
    message.trim() ||
    "The platform is under maintenance. Please check back soon. We apologise for the inconvenience.";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="maintenance-title"
      aria-describedby="maintenance-desc"
      onKeyDown={(e) => {
        if (e.key === "Escape") e.preventDefault();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <Construction className="h-7 w-7 text-amber-700" aria-hidden />
        </div>

        <h2 id="maintenance-title" className="text-xl font-bold text-slate-900 sm:text-2xl">
          Platform under maintenance
        </h2>

        <p id="maintenance-desc" className="mt-3 text-sm leading-relaxed text-slate-600">
          {displayMessage}
        </p>

        <p className="mt-4 text-xs text-slate-400">
          Your account is temporarily restricted while we update the system. Please try again later.
        </p>

        <Button
          type="button"
          variant="outline"
          className="mt-6 w-full gap-2"
          onClick={() => logout()}
        >
          <LogOut className="h-4 w-4" />
          Log out
        </Button>
      </div>
    </div>
  );
};

export default MaintenanceOverlay;
