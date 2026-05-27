import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useApp } from "@/context/AppContext";
import { API_BASE } from "@/config/api";
import {
  PROFILE_COMPLIANCE_REFRESH_EVENT,
} from "@/utils/profileComplianceEvents";
import {
  isProfileComplianceComplete,
  type ProfileRecord,
} from "@/utils/profileCompliance";

type ProfileComplianceContextValue = {
  loading: boolean;
  fetchOk: boolean;
  complete: boolean;
  profile: ProfileRecord | null;
  refetch: () => void;
};

const ProfileComplianceContext =
  createContext<ProfileComplianceContextValue | null>(null);

export function ProfileComplianceProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useApp();
  const [loading, setLoading] = useState(true);
  const [fetchOk, setFetchOk] = useState(false);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);

  const fetchProfile = useCallback(async () => {
    const uid = currentUser?.userId;
    if (!uid) {
      setProfile(null);
      setFetchOk(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/user/profile/${uid}`);
      const data = await res.json();
      if (!res.ok || !data?.success || !data.profile) {
        setProfile(null);
        setFetchOk(false);
        return;
      }
      const p = data.profile as ProfileRecord;
      setProfile(p);
      setFetchOk(true);
    } catch {
      setProfile(null);
      setFetchOk(false);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    const onRefresh = () => fetchProfile();
    window.addEventListener(PROFILE_COMPLIANCE_REFRESH_EVENT, onRefresh);
    return () =>
      window.removeEventListener(PROFILE_COMPLIANCE_REFRESH_EVENT, onRefresh);
  }, [fetchProfile]);

  const complete = Boolean(fetchOk && isProfileComplianceComplete(profile));

  const value: ProfileComplianceContextValue = {
    loading,
    fetchOk,
    complete,
    profile,
    refetch: fetchProfile,
  };

  return (
    <ProfileComplianceContext.Provider value={value}>
      {children}
    </ProfileComplianceContext.Provider>
  );
}

export function useProfileCompliance() {
  const ctx = useContext(ProfileComplianceContext);
  if (!ctx) {
    throw new Error(
      "useProfileCompliance must be used within ProfileComplianceProvider",
    );
  }
  return ctx;
}
