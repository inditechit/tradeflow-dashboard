import { useLocation } from "react-router-dom";
import { useSubscription } from "@/context/SubscriptionContext";
import { useProfileCompliance } from "@/context/ProfileComplianceContext";
import ComplianceOverlay from "./ComplianceOverlay";
import { isAdminImpersonating } from "@/utils/adminImpersonation";

const WITHDRAW_PATH = "/user/withdraw";
const PROFILE_PATH = "/user/profile";
const SETTINGS_PATH = "/user/settings";
const WALLET_SETUP_PATH = "/user/wallet-setup";
const REQUIRED_SETUP_PATH = "/user/required-setup";
const POST_SIGNUP_PATH = "/user/post-signup";

type Props = { children: React.ReactNode };

function complianceAllowedPath(pathname: string) {
  const paths = [
    WITHDRAW_PATH,
    PROFILE_PATH,
    SETTINGS_PATH,
    WALLET_SETUP_PATH,
    REQUIRED_SETUP_PATH,
    POST_SIGNUP_PATH,
  ];
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
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
