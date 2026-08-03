import { useLocation } from "react-router-dom";
import { useSubscription } from "@/context/SubscriptionContext";
import PlanExpiredOverlay from "./PlanExpiredOverlay";

const WITHDRAW_PATH = "/user/withdraw";
const DASHBOARD_PATH = "/user/dashboard";
const POST_SIGNUP_PATH = "/user/post-signup";
const NOTIFICATIONS_PATH = "/user/notifications";
const INVOICES_PATH = "/user/invoices";
const SUPPORT_PATH = "/user/support";
const PROFILE_PATH = "/user/profile";
const SETTINGS_PATH = "/user/settings";
const AFFILIATE_PATH = "/user/affiliate";

type Props = { children: React.ReactNode };

function pathMatches(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`);
}

function pathAllowed(pathname: string) {
  return (
    pathMatches(pathname, DASHBOARD_PATH) ||
    pathMatches(pathname, WITHDRAW_PATH) ||
    pathMatches(pathname, POST_SIGNUP_PATH) ||
    pathMatches(pathname, NOTIFICATIONS_PATH) ||
    pathMatches(pathname, INVOICES_PATH) ||
    pathMatches(pathname, SUPPORT_PATH) ||
    pathMatches(pathname, PROFILE_PATH) ||
    pathMatches(pathname, SETTINGS_PATH) ||
    pathMatches(pathname, AFFILIATE_PATH)
  );
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
