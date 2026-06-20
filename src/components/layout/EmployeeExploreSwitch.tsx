import { cn } from "@/lib/utils";
import { useEmployeeExploreMode } from "@/hooks/useEmployeeExploreMode";

type Props = {
  /** Which panel the user is currently viewing */
  activeVariant: "user" | "admin";
  className?: string;
};

/** Toggle between user app and employee admin panel (employees only). */
export function EmployeeExploreSwitch({ activeVariant, className }: Props) {
  const { isEmployee, mode, exploreAsUser, exploreAsEmployee } = useEmployeeExploreMode();

  if (!isEmployee) return null;

  const viewingUser = activeVariant === "user";
  const viewingEmployee = activeVariant === "admin";

  return (
    <div
      className={cn(
        "flex max-w-full rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm",
        className,
      )}
      role="group"
      aria-label="Explore as user or employee"
    >
      <button
        type="button"
        onClick={exploreAsUser}
        className={cn(
          "rounded-md px-2 py-1.5 text-[10px] font-semibold transition sm:px-3 sm:text-xs",
          viewingUser || mode === "user"
            ? "bg-[#FFD700] text-black"
            : "text-slate-600 hover:bg-slate-50",
        )}
      >
        Explore as user
      </button>
      <button
        type="button"
        onClick={exploreAsEmployee}
        className={cn(
          "rounded-md px-2 py-1.5 text-[10px] font-semibold transition sm:px-3 sm:text-xs",
          viewingEmployee || mode === "employee"
            ? "bg-emerald-600 text-white"
            : "text-slate-600 hover:bg-slate-50",
        )}
      >
        Explore as employee
      </button>
    </div>
  );
}
