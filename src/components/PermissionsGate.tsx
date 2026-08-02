import React, { useMemo } from "react";
import { Mic, MapPin, Loader2, CheckCircle2, AlertTriangle, Lock, RefreshCw } from "lucide-react";
import {
  useDevicePermissions,
  type PermissionState,
} from "@/hooks/useDevicePermissions";
import { useApp } from "@/context/AppContext";

interface Props {
  children: React.ReactNode;
}

/**
 * Permission prompts only apply after a non-admin user is logged in
 * (or session restored). Guests and admins browse without this gate.
 */
const PermissionsGate: React.FC<Props> = ({ children }) => {
  const { currentUser, authReady } = useApp();
  const isLoggedIn = Boolean(currentUser?.userId);
  const isAdmin = currentUser?.role === "admin";

  // Wait for session restore without blocking public pages.
  // Admins never need mic/location gate.
  if (!authReady || !isLoggedIn || isAdmin) {
    return <>{children}</>;
  }

  return <PermissionsGateEnforcer>{children}</PermissionsGateEnforcer>;
};

const PermissionsGateEnforcer: React.FC<Props> = ({ children }) => {
  const perms = useDevicePermissions();

  const isSecureContext = useMemo(() => {
    try {
      return window.isSecureContext || window.location.hostname === "localhost";
    } catch {
      return true;
    }
  }, []);

  if (perms.checking && perms.mic === "unknown" && perms.geo === "unknown") {
    return (
      <FullScreenWrap>
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
          <p className="text-sm font-medium">Checking permissions…</p>
        </div>
      </FullScreenWrap>
    );
  }

  if (perms.bothGranted) return <>{children}</>;

  return (
    <FullScreenWrap>
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-[#FFF9E6] p-2.5 text-neutral-900">
            <Lock size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900">
              Allow access to continue
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Microphone and location are required once. If you already allowed them, we will not ask again.
            </p>
          </div>
        </div>

        {!isSecureContext && (
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <AlertTriangle className="mb-1 inline h-4 w-4" /> The browser only
            grants microphone &amp; location on secure (HTTPS) pages. Please
            open the HTTPS version of this site.
          </div>
        )}

        <div className="mt-6 space-y-3">
          <PermissionCard
            title="Microphone"
            icon={<Mic size={20} />}
            state={perms.mic}
            onGrant={perms.requestMic}
          />
          <PermissionCard
            title="Location"
            icon={<MapPin size={20} />}
            state={perms.geo}
            onGrant={perms.requestGeo}
          />
        </div>

        {(perms.mic === "denied" || perms.geo === "denied") && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-semibold">
              You previously blocked one of these permissions.
            </p>
            <p className="mt-1">
              Your browser won't ask again until you allow it manually:
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Click the <strong>lock icon</strong> 🔒 in the address bar.</li>
              <li>Find <strong>Microphone</strong> / <strong>Location</strong> and switch it to <em>Allow</em>.</li>
              <li>Reload the page or press <strong>Check again</strong> below.</li>
            </ol>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={perms.recheck}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={14} />
            Check again
          </button>
          <p className="text-xs text-slate-500">
            You can use the dashboard once both are granted.
          </p>
        </div>
      </div>
    </FullScreenWrap>
  );
};

const PermissionCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  state: PermissionState;
  onGrant: () => Promise<PermissionState>;
}> = ({ title, icon, state, onGrant }) => {
  const grantable = state === "prompt" || state === "unknown";
  const granted = state === "granted";
  const denied = state === "denied";
  const unsupported = state === "unsupported";

  let statusChip: React.ReactNode = null;
  if (granted) {
    statusChip = (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
        <CheckCircle2 size={12} /> Granted
      </span>
    );
  } else if (denied) {
    statusChip = (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
        Blocked
      </span>
    );
  } else if (unsupported) {
    statusChip = (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600">
        Not supported
      </span>
    );
  } else {
    statusChip = (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
        Needed
      </span>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="rounded-lg bg-slate-100 p-2 text-slate-700">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {statusChip}
        </div>
      </div>
      <button
        type="button"
        disabled={!grantable}
        onClick={onGrant}
        className={
          granted
            ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
            : grantable
              ? "rounded-lg bg-[#FFD700] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#E6C200]"
              : "rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500"
        }
        title={denied ? "Re-enable from the lock icon in the address bar" : undefined}
      >
        {granted ? "Granted" : denied ? "Blocked" : unsupported ? "N/A" : "Grant"}
      </button>
    </div>
  );
};

const FullScreenWrap: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-yellow-50 via-white to-amber-50 p-4">
    {children}
  </div>
);

export default PermissionsGate;
