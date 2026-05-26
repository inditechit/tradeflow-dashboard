import { useApp } from "@/context/AppContext";

export type AppRole = "admin" | "user";

/** Session is restored in AppProvider; routes read the verified user from context. */
export function useVerifiedSession() {
  const { currentUser, authReady } = useApp();
  const userId = currentUser?.userId;
  const role: AppRole | null =
    currentUser?.role === "admin"
      ? "admin"
      : currentUser?.role === "user"
        ? "user"
        : userId
          ? "user"
          : null;

  const isLoading = !authReady;
  const isReady = authReady && Boolean(userId) && Boolean(role);
  const isInvalid = authReady && !userId;

  return {
    userId,
    role,
    state: isLoading ? "loading" : isReady ? "ready" : "idle",
    isLoading,
    isReady,
    isInvalid,
  };
}
