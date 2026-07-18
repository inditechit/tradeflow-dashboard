import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Loader2, ArrowRight, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";
import { API_BASE } from "@/config/api";
import { computeProfileCompletionPercent } from "@/utils/profileCompletion";

type LocState = "idle" | "requesting" | "granted" | "denied";

const PostSignupOnboardingPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const [locState, setLocState] = useState<LocState>("idle");
  const [locNote, setLocNote] = useState("");
  const [profilePct, setProfilePct] = useState<number | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    const uid = currentUser?.userId;
    if (!uid) {
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    try {
      const res = await fetch(`${API_BASE}/user/profile/${uid}`);
      const data = await res.json();
      if (data?.success && data.profile) {
        setProfilePct(computeProfileCompletionPercent(data.profile as Record<string, unknown>));
      } else {
        setProfilePct(0);
      }
    } catch {
      setProfilePct(0);
    } finally {
      setProfileLoading(false);
    }
  }, [currentUser?.userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const requestLocation = () => {
    setLocNote("");
    if (!("geolocation" in navigator)) {
      setLocState("denied");
      setLocNote("Location is not supported in this browser.");
      return;
    }
    setLocState("requesting");
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocState("granted");
        setLocNote("Location permission granted.");
      },
      (err) => {
        setLocState("denied");
        setLocNote(
          err.code === 1
            ? "Location permission is required. Enable it in browser settings and try again."
            : "Could not access location. This permission is important for the website to function.",
        );
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  };

  return (
    <div className="mx-auto max-w-lg py-6 sm:py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-yellow-50 px-3 py-1 text-xs font-semibold text-neutral-900 ring-1 ring-yellow-200">
          <UserCircle className="h-4 w-4" />
          Almost there
        </div>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">Finish setup</h1>
        <p className="mt-2 text-sm text-slate-600">
          Allow location permission to continue. It is important for the website to function.
        </p>

        <div className="mt-8 space-y-6">
          <section className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                <MapPin className="h-5 w-5 text-yellow-700" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-slate-900">Location permission</h2>
                <p className="mt-1 text-xs text-slate-600">
                  This permission is important for the website to function.
                </p>
                {locState === "idle" || locState === "denied" ? (
                  <Button
                    type="button"
                    className="mt-3 bg-[#FFD700] font-semibold text-black hover:bg-[#e6c200]"
                    onClick={requestLocation}
                    disabled={locState === "requesting"}
                  >
                    {locState === "denied" ? "Try location again" : "Share location"}
                  </Button>
                ) : locState === "requesting" ? (
                  <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Waiting for browser…
                  </div>
                ) : (
                  <p className="mt-3 text-sm font-medium text-emerald-700">
                    Location permission granted.
                  </p>
                )}
                {locNote ? <p className="mt-2 text-xs text-slate-500">{locNote}</p> : null}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-slate-900">Profile completion</h2>
            <p className="mt-1 text-xs text-slate-600">
              Complete your profile anytime under <span className="font-medium">Profile</span> after
              you buy a package.
            </p>
            <div className="mt-4">
              {profileLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading profile…
                </div>
              ) : (
                <>
                  <div className="flex items-end justify-between gap-2">
                    <span className="text-3xl font-bold tabular-nums text-slate-900">
                      {profilePct ?? 0}%
                    </span>
                    <span className="text-xs text-slate-500">complete</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#FFD700] transition-[width] duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, profilePct ?? 0))}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          </section>

          <Button
            type="button"
            className="w-full bg-neutral-900 py-6 text-base font-semibold text-white hover:bg-neutral-800"
            onClick={() => navigate("/packages")}
            disabled={locState !== "granted"}
          >
            Continue to packages
            <ArrowRight className="ml-2 inline h-5 w-5 align-middle" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PostSignupOnboardingPage;
