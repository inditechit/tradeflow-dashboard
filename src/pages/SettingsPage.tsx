import { Navigate } from "react-router-dom";
import { Moon, Sun, Settings2, Video } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useTheme } from "@/context/ThemeContext";
import { useRecordingMode } from "@/context/RecordingModeContext";
import { ProfilePanel } from "@/components/profile/ProfilePanel";
import { Button } from "@/components/ui/button";

type SettingsPageProps = {
  variant: "user" | "admin";
};

/**
 * Password + theme. Account / KYC / contact live on Profile.
 * Admin: recording (view-only) mode for demos / screen share.
 */
export default function SettingsPage({ variant }: SettingsPageProps) {
  const { currentUser } = useApp();
  const { theme, toggleTheme } = useTheme();
  const recording = useRecordingMode();

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
          <p className="mt-1 text-sm text-slate-600">
            {variant === "admin"
              ? "Password, appearance, and recording mode."
              : "Password and appearance."}
          </p>
        </div>
      </div>

      {variant === "admin" && (
        <div className="mb-6 rounded-2xl border border-violet-200 bg-violet-50/60 p-6 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <Video className="h-5 w-5 text-violet-700" />
            <h2 className="text-lg font-semibold text-slate-900">Recording mode</h2>
          </div>
          <p className="mb-4 text-sm text-slate-600">
            Turn this on before screen recordings or demos. The whole admin panel becomes view-only:
            add / update / approve actions are hidden, and mutating API calls are blocked. Preference
            is saved in this browser (localStorage).
          </p>
          <Button
            type="button"
            variant={recording.recordingMode ? "destructive" : "default"}
            allowInRecording
            className="gap-2"
            onClick={() => recording.toggleRecordingMode()}
          >
            <Video className="h-4 w-4" />
            {recording.recordingMode ? "Turn recording mode off" : "Turn recording mode on"}
          </Button>
          {recording.recordingMode && (
            <p className="mt-3 text-xs font-medium text-violet-800">
              Recording mode is on — panel is view-only until you turn it off.
            </p>
          )}
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Appearance</h2>
        <p className="mb-4 text-sm text-slate-600">Switch between light and dark dashboard theme.</p>
        <Button
          type="button"
          variant="outline"
          allowInRecording
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
