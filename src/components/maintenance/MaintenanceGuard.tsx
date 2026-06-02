import { useApp } from "@/context/AppContext";
import { useMaintenanceStatus } from "@/hooks/useMaintenanceStatus";
import MaintenanceOverlay from "./MaintenanceOverlay";

type Props = { children: React.ReactNode };

/** Blocks the user app when admin has enabled maintenance for this account. */
const MaintenanceGuard = ({ children }: Props) => {
  const { currentUser } = useApp();
  const { loading, underMaintenance, message } = useMaintenanceStatus(currentUser?.userId);

  if (loading) {
    return <>{children}</>;
  }

  if (underMaintenance) {
    return (
      <>
        <div className="pointer-events-none select-none opacity-30 blur-[1px]" aria-hidden>
          {children}
        </div>
        <MaintenanceOverlay message={message} />
      </>
    );
  }

  return <>{children}</>;
};

export default MaintenanceGuard;
