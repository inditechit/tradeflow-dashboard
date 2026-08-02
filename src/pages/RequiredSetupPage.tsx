import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  MapPin,
  Camera,
  ImageIcon,
  User,
  CheckCircle2,
  Circle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";
import { API_BASE } from "@/config/api";
import { LiveCameraCaptureDialog } from "@/components/profile/LiveCameraCaptureDialog";
import {
  notifyProfileComplianceRefresh,
  PROFILE_COMPLIANCE_REFRESH_EVENT,
} from "@/utils/profileComplianceEvents";
import { ProfilePanel } from "@/components/profile/ProfilePanel";
import { computeProfileCompletionPercent } from "@/utils/profileCompletion";
import {
  isProfileComplianceComplete,
  type ProfileRecord,
} from "@/utils/profileCompliance";
import { hasUserImageData } from "@/utils/userImageUrl";
import { isAdminImpersonating } from "@/utils/adminImpersonation";

function filled(val: unknown): boolean {
  if (val == null) return false;
  if (typeof val === "string") return val.trim().length > 0;
  return true;
}

function hasLivePhoto(profile: ProfileRecord): boolean {
  return hasUserImageData(profile.livePhotoData);
}

function hasLocation(profile: ProfileRecord): boolean {
  const lat = profile.latitude;
  const lng = profile.longitude;
  if (lat == null || lng == null) return false;
  const la = Number(lat);
  const lo = Number(lng);
  return Number.isFinite(la) && Number.isFinite(lo);
}

const RequiredSetupPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [locBusy, setLocBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const uid = currentUser?.userId;
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/user/profile/${uid}`);
      const data = await res.json();
      if (!data?.success || !data.profile) {
        setError("Could not load profile.");
        setProfile(null);
        return;
      }
      setProfile(data.profile as ProfileRecord);
    } catch {
      setError("Network error loading profile.");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onRefresh = () => load();
    window.addEventListener(PROFILE_COMPLIANCE_REFRESH_EVENT, onRefresh);
    return () =>
      window.removeEventListener(PROFILE_COMPLIANCE_REFRESH_EVENT, onRefresh);
  }, [load]);

  const saveLocation = async () => {
    const uid = currentUser?.userId;
    if (!uid) return;
    if (isAdminImpersonating()) {
      setError("Location updates are disabled while viewing as this user.");
      return;
    }
    if (!("geolocation" in navigator)) {
      setError("Location is not available in this browser.");
      return;
    }
    setLocBusy(true);
    setError("");
    try {
      const { getGeolocationIfAllowed } = await import("@/utils/devicePermissions");
      const result = await getGeolocationIfAllowed({
        allowPrompt: true,
        enableHighAccuracy: false,
        timeout: 15_000,
        maximumAge: 300_000,
      });
      if (!result.ok) {
        setError(
          result.reason === "denied"
            ? "Location permission is blocked. Enable it in browser settings and try again."
            : "Location was denied or unavailable. Enable it in browser settings and try again.",
        );
        return;
      }
      const res = await fetch(`${API_BASE}/user/profile/${uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: result.lat,
          longitude: result.lng,
          skipLocationUpdate: isAdminImpersonating(),
          impersonating: isAdminImpersonating(),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Could not save location.");
      } else {
        notifyProfileComplianceRefresh();
        await load();
      }
    } catch {
      setError("Failed to save location.");
    } finally {
      setLocBusy(false);
    }
  };

  const uploadLivePhoto = async (dataUrl: string) => {
    const uid = currentUser?.userId;
    if (!uid) return;
    setError("");
    try {
      const res = await fetch(`${API_BASE}/user/profile/${uid}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ livePhotoBase64: dataUrl }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Upload failed.");
        return;
      }
      setCameraOpen(false);
      notifyProfileComplianceRefresh();
      await load();
    } catch {
      setError("Upload failed.");
    }
  };

  if (loading && !profile) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-600">
        <Loader2 className="h-6 w-6 animate-spin" />
        Loading…
      </div>
    );
  }

  const p = profile ?? {};
  const profilePct = profile ? computeProfileCompletionPercent(profile) : 0;
  const rows = [
    {
      label: "Name, email, mobile, Telegram",
      ok:
        filled(p.name) &&
        filled(p.email) &&
        filled(p.mobile) &&
        filled(p.telegram),
      hint: "Use the profile section below or My profile in the sidebar.",
    },
    {
      label: "USDT TRC20 withdrawal address",
      ok: filled(p.trc20WithdrawAddress),
      hint: "Add your payout wallet on Profile.",
    },
    {
      label: "Location permission (saved to profile)",
      ok: hasLocation(p),
      hint: "Required for the website to function.",
    },
    {
      label: "Live photo (selfie)",
      ok: hasLivePhoto(p),
      hint: "Take a photo with the camera or choose one from your gallery.",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-6 sm:py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">Required setup</h1>
        <p className="mt-2 text-sm text-slate-600">
          With an active package, the following must be completed for compliance. This applies to
          all accounts, including Google sign-in.
        </p>

        {profile ? (
          <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
            <div className="flex items-end justify-between gap-2">
              <span className="text-sm font-medium text-slate-700">Profile completion</span>
              <span className="text-2xl font-bold tabular-nums text-slate-900">{profilePct}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-[#FFD700] transition-[width] duration-300"
                style={{ width: `${Math.min(100, Math.max(0, profilePct))}%` }}
              />
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <ul className="mt-8 space-y-4">
          {rows.map((row) => (
            <li
              key={row.label}
              className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3"
            >
              {row.ok ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
              )}
              <div>
                <p className="font-medium text-slate-900">{row.label}</p>
                <p className="text-xs text-slate-500">{row.hint}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={saveLocation}
            disabled={locBusy || hasLocation(p)}
          >
            <MapPin className="mr-2 h-4 w-4" />
            {locBusy ? "Saving…" : hasLocation(p) ? "Location saved" : "Save location"}
          </Button>
          {hasLivePhoto(p) ? (
            <Button type="button" variant="outline" className="flex-1" disabled>
              <Camera className="mr-2 h-4 w-4" />
              Live photo OK
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setCameraOpen(true)}
              >
                <Camera className="mr-2 h-4 w-4" />
                Camera
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => galleryInputRef.current?.click()}
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                Gallery
              </Button>
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file || !file.type.startsWith("image/")) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const result = reader.result;
                    if (typeof result === "string") void uploadLivePhoto(result);
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={() =>
              document.getElementById("profile-form")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
            }
          >
            <User className="mr-2 h-4 w-4" />
            Jump to profile form
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link to="/user/profile" className="inline-flex items-center justify-center gap-2">
              Open profile page
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {profile && isProfileComplianceComplete(profile) ? (
          <Button
            type="button"
            className="mt-6 w-full bg-[#FFD700] py-6 text-base font-semibold text-black hover:bg-[#e6c200]"
            onClick={() => {
              notifyProfileComplianceRefresh();
              navigate("/user/dashboard");
            }}
          >
            Continue to dashboard
            <ArrowRight className="ml-2 inline h-5 w-5" />
          </Button>
        ) : null}
      </div>

      {currentUser?.userId ? (
        <div
          id="profile-form"
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:p-8"
        >
          <h2 className="mb-2 text-xl font-bold text-slate-900">Your profile</h2>
          <p className="mb-6 text-sm text-slate-600">
            Fill in contact, address, USDT payout wallet, and any documents. Saving here updates
            your checklist above.
          </p>
          <ProfilePanel
            targetUserId={String(currentUser.userId)}
            showAdminExtras={currentUser.role === "admin"}
          />
        </div>
      ) : null}

      <LiveCameraCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        facingMode="user"
        title="Live selfie"
        description="Use your camera for a clear selfie, or pick a photo from your gallery."
        onCaptured={uploadLivePhoto}
      />
    </div>
  );
};

export default RequiredSetupPage;
