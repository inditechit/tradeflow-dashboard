import { useLocation } from "react-router-dom";
import { useSubscription } from "@/context/SubscriptionContext";
import { useProfileCompliance } from "@/context/ProfileComplianceContext";
import ComplianceOverlay from "./ComplianceOverlay";
import { isAdminImpersonating } from "@/utils/adminImpersonation";

const WITHDRAW_PATH = "/user/withdraw";
const PROFILE_PATH = "/user/profile";
const REQUIRED_SETUP_PATH = "/user/required-setup";
const POST_SIGNUP_PATH = "/user/post-signup";

type Props = { children: React.ReactNode };

function complianceAllowedPath(pathname: string) {
  const w = pathname === WITHDRAW_PATH || pathname.startsWith(`${WITHDRAW_PATH}/`);
  const p = pathname === PROFILE_PATH || pathname.startsWith(`${PROFILE_PATH}/`);
  const r =
    pathname === REQUIRED_SETUP_PATH ||
    pathname.startsWith(`${REQUIRED_SETUP_PATH}/`);
  const o =
    pathname === POST_SIGNUP_PATH || pathname.startsWith(`${POST_SIGNUP_PATH}/`);
  return w || p || r || o;
}

/** After an active package: block app until profile + location + live photo are complete. */
const ComplianceRequiredGuard = ({ children }: Props) => {
  const { pathname } = useLocation();
  const { loading: subLoading, fetchOk: subOk, isActive, accessRestricted } =
    useSubscription();
  const { loading: compLoading, fetchOk: compOk, complete } = useProfileCompliance();

  const needsCompliance =
    !isAdminImpersonating() &&
    !subLoading &&
    subOk &&
    isActive &&
    !accessRestricted &&
    !compLoading &&
    compOk &&
    !complete;

  const showOverlay = needsCompliance && !complianceAllowedPath(pathname);

  return (
    <div className="relative min-h-[12rem]">
      {children}
      {showOverlay && <ComplianceOverlay />}
    </div>
  );
};

export default ComplianceRequiredGuard;
