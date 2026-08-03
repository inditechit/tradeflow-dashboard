import { Navigate } from "react-router-dom";
import { Moon, Sun, Settings2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useTheme } from "@/context/ThemeContext";
import { ProfilePanel } from "@/components/profile/ProfilePanel";
import { Button } from "@/components/ui/button";

type SettingsPageProps = {
  variant: "user" | "admin";
};

/**
 * Password + theme. Account / KYC / contact live on Profile.
 */
export default function SettingsPage({ variant }: SettingsPageProps) {
  const { currentUser } = useApp();
  const { theme, toggleTheme } = useTheme();

  if (!currentUser?.userId) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="mx-auto max-w-5xl px-0 py-4 sm:px-2 md:px-6 md:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Settings2 className="h-3.5 w-3.5" />
            {variant === "admin" ? "Admin" : "Account"}
          </div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Settings</h1>
          <p className="mt-1 text-sm text-slate-600">Password and appearance.</p>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Appearance</h2>
        <p className="mb-4 text-sm text-slate-600">Switch between light and dark dashboard theme.</p>
        <Button
          type="button"
          variant="outline"
          className="gap-2 border-slate-200"
          onClick={toggleTheme}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === "dark" ? "Use light theme" : "Use dark theme"}
        </Button>
      </div>

      <ProfilePanel
        targetUserId={String(currentUser.userId)}
        showAdminExtras={variant === "admin"}
        sections={["password"]}
      />
    </div>
  );
}
