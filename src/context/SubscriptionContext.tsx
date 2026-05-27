import { createContext, useContext, type ReactNode } from "react";
import {
  useSubscriptionStatus,
  type SubscriptionStatus,
} from "@/hooks/useSubscriptionStatus";

const SubscriptionContext = createContext<SubscriptionStatus | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const status = useSubscriptionStatus();
  return (
    <SubscriptionContext.Provider value={status}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error("useSubscription must be used within SubscriptionProvider");
  }
  return ctx;
}
