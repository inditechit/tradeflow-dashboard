import { Navigate, useLocation } from "react-router-dom";
import { useProfileCompliance } from "@/context/ProfileComplianceContext";
import { userNeedsRiskReselection } from "@/utils/userRiskProfile";

const CHOOSE_RISK_PATH = "/user/choose-risk";

type Props = { children: React.ReactNode };

/** Redirect legacy multi-risk users to pick a single profile on login. */
export default function RiskProfileRequiredGuard({ children }: Props) {
  const { pathname } = useLocation();
  const { loading, fetchOk, profile } = useProfileCompliance();

  if (loading || !fetchOk) {
    return <>{children}</>;
  }

  const needsReselection = userNeedsRiskReselection(profile?.risk);
  const onChoosePage =
    pathname === CHOOSE_RISK_PATH || pathname.startsWith(`${CHOOSE_RISK_PATH}/`);

  if (needsReselection && !onChoosePage) {
    return <Navigate to={CHOOSE_RISK_PATH} replace />;
  }

  return <>{children}</>;
}
