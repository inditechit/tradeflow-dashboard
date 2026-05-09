import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
  /** ISO timestamp — set at signup for client-side join date; server may also send on login. */
  createdAt?: string;
  depositMethod?: string;
  role?: "admin" | "user";
  /** KYC / proofs — hydrated when loading profile */
  kycStatus?: string;
}

export interface PurchasedPackage {
  id: string;
  name: string;
  price: number;
  icon: string;
  purchasedAt: string;
  transactionId?: string;
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
}

const defaultLocations: MockLocation[] = [
  { username: 'trader_alex', latitude: '28.6139', longitude: '77.2090', lastUpdate: '2026-02-28 14:32:10' },
  { username: 'fx_maria', latitude: '19.0760', longitude: '72.8777', lastUpdate: '2026-02-28 14:31:45' },
  { username: 'crypto_raj', latitude: '25.2048', longitude: '55.2708', lastUpdate: '2026-02-28 14:30:22' },
  { username: 'gold_nina', latitude: '1.3521', longitude: '103.8198', lastUpdate: '2026-02-28 14:29:58' },
];

const AppContext = createContext<AppContextType | undefined>(undefined);

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<UserData | null>(() => loadFromStorage('mt5_user', null));
  const [purchasedPackages, setPurchasedPackages] = useState<PurchasedPackage[]>(() => loadFromStorage('mt5_packages', []));
  const [selectedPackage, setSelectedPackage] = useState<PurchasedPackage | null>(null);
  const [mockLocations] = useState<MockLocation[]>(defaultLocations);

  useEffect(() => {
    if (currentUser) localStorage.setItem('mt5_user', JSON.stringify(currentUser));
    else localStorage.removeItem('mt5_user');
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('mt5_packages', JSON.stringify(purchasedPackages));
  }, [purchasedPackages]);

  const updateUser = (partial: Partial<UserData>) => {
    setCurrentUser(prev => prev ? { ...prev, ...partial } : null);
  };

  const addPackage = (pkg: PurchasedPackage) => {
    setPurchasedPackages(prev => [...prev, pkg]);
  };

  return (
    <AppContext.Provider value={{
      currentUser, setCurrentUser, updateUser,
      purchasedPackages, addPackage,
      selectedPackage, setSelectedPackage,
      mockLocations,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
