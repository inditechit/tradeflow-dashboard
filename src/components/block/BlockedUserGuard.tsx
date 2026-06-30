import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ShieldBan } from "lucide-react";
import { API_BASE } from "@/config/api";
import { useApp } from "@/context/AppContext";
import { clearAuthStorage } from "@/utils/authSession";
import { Button } from "@/components/ui/button";

type BlockAccess = {
  block_status?: string;
  package_active?: boolean;
  can_login?: boolean;
  can_purchase_package?: boolean;
  can_withdraw?: boolean;
  force_logout?: boolean;
  message?: string;
};

export default function BlockedUserGuard({ children }: { children: React.ReactNode }) {
  const { currentUser } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [access, setAccess] = useState<BlockAccess | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = currentUser?.userId;
    if (!uid || currentUser?.role === "admin" || currentUser?.role === "employee") {
      setAccess(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/user/block-access/${uid}`);
        const data = await res.json();
        if (cancelled) return;
        const a = data.access as BlockAccess | undefined;
        setAccess(a || null);
        if (a?.force_logout) {
          clearAuthStorage();
          navigate("/login", { replace: true, state: { blocked: true } });
        }
      } catch {
        if (!cancelled) setAccess(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.userId, currentUser?.role, navigate]);

  if (loading || !access || access.block_status === "none") {
    return <>{children}</>;
  }

  const onWithdrawPage = location.pathname.includes("/user/withdraw");

  if (access.block_status === "blocked") {
    return (
      <>
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Account restricted</p>
          <p className="mt-1 text-amber-800">
            {access.message ||
              "You cannot purchase new packages. Trading continues until your current package expires."}
          </p>
        </div>
        {children}
      </>
    );
  }

  if (access.block_status === "withdraw_only" && access.can_withdraw && onWithdrawPage) {
    return <>{children}</>;
  }

  if (access.block_status === "withdraw_only" && access.can_withdraw && !onWithdrawPage) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-16 text-center">
        <ShieldBan className="h-12 w-12 text-amber-600" />
        <h2 className="text-xl font-bold text-slate-900">Account restricted</h2>
        <p className="text-sm text-slate-600">{access.message}</p>
        <Button asChild>
          <Link to="/user/withdraw">Go to withdrawal</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-16 text-center">
      <ShieldBan className="h-12 w-12 text-amber-600" />
      <h2 className="text-xl font-bold text-slate-900">Account restricted</h2>
      <p className="text-sm text-slate-600">
        {access.message ||
          "Your account has been restricted. Contact support if you believe this is an error."}
      </p>
    </div>
  );
}
