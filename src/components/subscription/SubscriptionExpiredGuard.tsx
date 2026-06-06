import { useLocation } from "react-router-dom";
import { useSubscription } from "@/context/SubscriptionContext";
import PlanExpiredOverlay from "./PlanExpiredOverlay";

const WITHDRAW_PATH = "/user/withdraw";
const DASHBOARD_PATH = "/user/dashboard";
const POST_SIGNUP_PATH = "/user/post-signup";
const NOTIFICATIONS_PATH = "/user/notifications";

type Props = { children: React.ReactNode };

function pathAllowed(pathname: string) {
  const dash = pathname === DASHBOARD_PATH || pathname.startsWith(`${DASHBOARD_PATH}/`);
  const w = pathname === WITHDRAW_PATH || pathname.startsWith(`${WITHDRAW_PATH}/`);
  const onboard =
    pathname === POST_SIGNUP_PATH || pathname.startsWith(`${POST_SIGNUP_PATH}/`);
  const notifications =
    pathname === NOTIFICATIONS_PATH || pathname.startsWith(`${NOTIFICATIONS_PATH}/`);
  return dash || w || onboard || notifications;
}

/** Blocks main content with a non-skippable modal when there is no active package or plan expired. */
const SubscriptionExpiredGuard = ({ children }: Props) => {
  const { pathname } = useLocation();
  const { loading, accessRestricted } = useSubscription();

  const showOverlay = !loading && accessRestricted && !pathAllowed(pathname);

  return (
    <div className="relative min-h-[12rem]">
      {children}
      {showOverlay && <PlanExpiredOverlay />}
    </div>
  );
};

export default SubscriptionExpiredGuard;
