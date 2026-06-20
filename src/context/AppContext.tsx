import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import {
  loadStoredUser,
  persistUser,
  clearAuthStorage,
  verifySession,
} from "@/utils/authSession";

export interface UserData {
  name?: string;
  mobile?: string;
  telegram?: string;
  username?: string;
  password?: string;
  email?: string;
  emailVerified?: boolean;
  country?: string;
  state?: string;
  city?: string;
  pincode?: string;
  photoCaptured?: boolean;
  experienceYears?: string;
  userId?: string;
  createdAt?: string;
  depositMethod?: string;
  role?: "admin" | "user" | "employee";
  employeePermissions?: string[];
  kycStatus?: string;
}

export interface PurchasedPackage {
  id: string;
  name: string;
  price: number;
  icon: string;
  purchasedAt: string;
  transactionId?: string;
  originalPrice?: number;
  listPrice?: number;
  referralPrice?: number;
  couponCode?: string;
  hasReferralDiscount?: boolean;
  isTrial?: boolean;
}

export interface MockLocation {
  username: string;
  latitude: string;
  longitude: string;
  lastUpdate: string;
}

interface AppContextType {
  currentUser: UserData | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<UserData | null>>;
  updateUser: (partial: Partial<UserData>) => void;
  purchasedPackages: PurchasedPackage[];
  addPackage: (pkg: PurchasedPackage) => void;
  selectedPackage: PurchasedPackage | null;
  setSelectedPackage: (pkg: PurchasedPackage | null) => void;
  mockLocations: MockLocation[];
  /** False until stored session is loaded / verified on app start. */
  authReady: boolean;
  logout: () => void;
}

const defaultLocations: MockLocation[] = [
  { username: "trader_alex", latitude: "28.6139", longitude: "77.2090", lastUpdate: "2026-02-28 14:32:10" },
  { username: "fx_maria", latitude: "19.0760", longitude: "72.8777", lastUpdate: "2026-02-28 14:31:45" },
  { username: "crypto_raj", latitude: "25.2048", longitude: "55.2708", lastUpdate: "2026-02-28 14:30:22" },
  { username: "gold_nina", latitude: "1.3521", longitude: "103.8198", lastUpdate: "2026-02-28 14:29:58" },
];

const AppContext = createContext<AppContextType | undefined>(undefined);

function loadPackagesFromStorage(): PurchasedPackage[] {
  try {
    const stored = localStorage.getItem("mt5_packages");
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<UserData | null>(() => loadStoredUser());
  const [authReady, setAuthReady] = useState(false);
  const [purchasedPackages, setPurchasedPackages] = useState<PurchasedPackage[]>(
    () => loadPackagesFromStorage()
  );
  const [selectedPackage, setSelectedPackage] = useState<PurchasedPackage | null>(null);
  const [mockLocations] = useState<MockLocation[]>(defaultLocations);

  const logout = useCallback(() => {
    setCurrentUser(null);
    clearAuthStorage();
    setPurchasedPackages([]);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = loadStoredUser();
      if (!stored?.userId) {
        if (!cancelled) {
          setCurrentUser(null);
          setAuthReady(true);
        }
        return;
      }

      const result = await verifySession(stored.userId, stored);
      if (cancelled) return;

      if (result.status === "invalid") {
        setCurrentUser(null);
        persistUser(null);
      } else {
        setCurrentUser(result.user);
        persistUser(result.user);
      }
      setAuthReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    persistUser(currentUser);
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem("mt5_packages", JSON.stringify(purchasedPackages));
  }, [purchasedPackages]);

  const updateUser = (partial: Partial<UserData>) => {
    setCurrentUser((prev) => (prev ? { ...prev, ...partial } : null));
  };

  const addPackage = (pkg: PurchasedPackage) => {
    setPurchasedPackages((prev) => [...prev, pkg]);
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        updateUser,
        purchasedPackages,
        addPackage,
        selectedPackage,
        setSelectedPackage,
        mockLocations,
        authReady,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};
