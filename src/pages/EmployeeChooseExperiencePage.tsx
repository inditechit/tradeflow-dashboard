import { useEffect } from "react";
import { LayoutDashboard, UserRound } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { useEmployeeExploreMode } from "@/hooks/useEmployeeExploreMode";
import { employeeHomeForMode } from "@/utils/employeeExploreMode";

const EmployeeChooseExperiencePage = () => {
  const { currentUser } = useApp();
  const { mode, exploreAsUser, exploreAsEmployee, hasChosenMode } = useEmployeeExploreMode();
  const permissions = currentUser?.employeePermissions ?? [];

  useEffect(() => {
    document.title = "Choose experience · Copy Trade Engine";
  }, []);

  if (hasChosenMode && mode) {
    return <Navigate to={employeeHomeForMode(mode, permissions)} replace />;
  }

  const name = currentUser?.name?.trim() || currentUser?.email || "there";

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-yellow-50 via-white to-amber-50 p-6">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Employee account</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Hi {name}, how would you like to explore?</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your account can use the trading app as a user and the admin panel as an employee. Switch anytime from the header.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={exploreAsUser}
            className="group flex flex-col items-start rounded-xl border-2 border-slate-200 bg-slate-50/80 p-5 text-left transition hover:border-yellow-400 hover:bg-yellow-50/60"
          >
            <UserRound className="mb-3 h-8 w-8 text-slate-700 group-hover:text-neutral-900" />
            <span className="font-semibold text-slate-900">Explore as user</span>
            <span className="mt-1 text-xs text-slate-500">Trades, wallet, packages & your profile</span>
          </button>

          <button
            type="button"
            onClick={exploreAsEmployee}
            className="group flex flex-col items-start rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-5 text-left transition hover:border-emerald-400 hover:bg-emerald-50"
          >
            <LayoutDashboard className="mb-3 h-8 w-8 text-emerald-700" />
            <span className="font-semibold text-slate-900">Explore as employee</span>
            <span className="mt-1 text-xs text-slate-500">Admin panel sections you were granted</span>
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          You can change this later using the switch in the top bar.
        </p>
      </div>
    </div>
  );
};

export default EmployeeChooseExperiencePage;
