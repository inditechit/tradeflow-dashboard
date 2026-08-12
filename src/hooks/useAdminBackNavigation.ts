import { useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ADMIN_RETURN_PARAM,
  resolveAdminBackTarget,
} from "@/utils/adminNavigation";

export function useAdminBackNavigation(fallback = "/admin/users") {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnParam = searchParams.get(ADMIN_RETURN_PARAM);
  const backTarget = resolveAdminBackTarget(returnParam, fallback);

  const goBack = useCallback(() => {
    if (returnParam) {
      navigate(backTarget);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(fallback);
  }, [backTarget, fallback, navigate, returnParam]);

  return { goBack, backTarget, hasReturnTarget: Boolean(returnParam) };
}
