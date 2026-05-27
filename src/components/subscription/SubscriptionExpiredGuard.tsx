import { useLocation } from "react-router-dom";
import { useSubscription } from "@/context/SubscriptionContext";
import PlanExpiredOverlay from "./PlanExpiredOverlay";

const WITHDRAW_PATH = "/user/withdraw";

type Props = { children: React.ReactNode };

/** Blocks main content with a non-skippable modal when the stacked plan has expired. */
const SubscriptionExpiredGuard = ({ children }: Props) => {
  const { pathname } = useLocation();
  const { loading, isExpired } = useSubscription();

  const onWithdrawPage = pathname === WITHDRAW_PATH || pathname.startsWith(`${WITHDRAW_PATH}/`);
  const showOverlay = !loading && isExpired && !onWithdrawPage;

  return (
    <div className="relative min-h-[12rem]">
      {children}
      {showOverlay && <PlanExpiredOverlay />}
    </div>
  );
};

export default SubscriptionExpiredGuard;
