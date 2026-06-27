import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Plane,
  Globe,
  Video,
  Loader2,
  CheckCircle2,
  Clock,
  Plus,
  ArrowRight,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { ProfilePanel } from "@/components/profile/ProfilePanel";
import { getPackageById, packageDisplayName } from "@/constants/packages";
import { API_BASE } from "@/config/api";

type PaymentTxn = {
  id: number | string;
  package_id: string;
  package_name?: string;
  status: string;
  amount: number | string;
  payment_method?: string;
  tx_hash?: string;
};

const getPackageIcon = (name: string) => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes("india")) return <Plane size={24} />;
  if (lowerName.includes("international")) return <Globe size={24} />;
  return <Video size={24} />;
};

const My_Profile = () => {
  const { currentUser, setSelectedPackage } = useApp();
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState<PaymentTxn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!currentUser?.userId) return;

    let cancelled = false;
    const fetchTransactions = async () => {
      try {
        const response = await fetch(`${API_BASE}/user/payments/${currentUser.userId}`);
        const data = await response.json();
        if (cancelled) return;
        if (data.success) {
          setTransactions(data.data ?? []);
        } else {
          setError("Failed to load your packages.");
        }
      } catch {
        if (!cancelled) setError("Server connection error.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchTransactions();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.userId]);

  const handleContinueJourney = (txn: PaymentTxn) => {
    const pkg = getPackageById(txn.package_id);
    if (!pkg) {
      navigate("/packages");
      return;
    }
    setSelectedPackage({
      id: pkg.id,
      name: pkg.name,
      price: Number(txn.amount) || pkg.price,
      icon: pkg.icon.name,
      purchasedAt: new Date().toISOString(),
    });
    navigate("/payment", { state: { resumePayment: true } });
  };

  if (!currentUser?.userId) {
    return <Navigate to="/login" replace />;
  }

  const packages = transactions.filter((txn) => txn.package_id !== "recharge");

  return (
    <div className="mx-auto max-w-5xl px-0 py-4 sm:px-2 md:px-6 md:py-10">
      <h1 className="mb-4 text-xl font-bold text-slate-900 sm:mb-6 sm:text-2xl">My profile</h1>
      <ProfilePanel
        targetUserId={String(currentUser.userId)}
        showAdminExtras={currentUser.role === "admin"}
      />

      {/* Active packages */}
      <section className="mt-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">Your Active Packages</h2>
          <button
            onClick={() => navigate("/packages")}
            className="flex items-center gap-1 text-sm font-bold text-neutral-900 hover:text-neutral-800"
          >
            <Plus size={16} /> Add New
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white p-12 text-center shadow-sm">
            <Loader2 className="mb-4 animate-spin text-yellow-800" size={32} />
            <p className="font-medium text-slate-500">Loading your packages...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center font-medium text-red-600">
            {error}
          </div>
        ) : packages.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400">
              <Globe size={32} />
            </div>
            <h3 className="mb-2 text-lg font-bold text-slate-800">No Packages Yet</h3>
            <p className="mx-auto mb-6 max-w-sm text-slate-500">
              You haven't purchased any trading packages yet.
            </p>
            <button
              onClick={() => navigate("/packages")}
              className="rounded-xl bg-[#FFD700] px-8 py-3.5 font-bold text-black shadow-lg shadow-black/20 transition-all hover:-translate-y-0.5 hover:bg-[#E6C200]"
            >
              Browse Packages
            </button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {packages.map((txn, i) => {
              const pkgMeta = getPackageById(txn.package_id);
              const isPending = txn.status !== "success";
              const title = packageDisplayName(txn.package_id, txn.package_name);

              return (
                <div
                  key={i}
                  className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="absolute left-0 top-0 h-1 w-full bg-[#FFD700] opacity-0 transition-opacity group-hover:opacity-100" />

                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-yellow-200 bg-yellow-50 text-neutral-900">
                      {pkgMeta ? <pkgMeta.icon size={24} /> : getPackageIcon(title)}
                    </div>
                    {txn.status === "success" ? (
                      <span className="flex items-center gap-1.5 rounded-full border border-yellow-200 bg-[#FFF9E6] px-3 py-1.5 text-xs font-bold text-yellow-700">
                        <CheckCircle2 size={14} /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-600">
                        <Clock size={14} /> Pending
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="mb-1 text-lg font-bold leading-tight text-slate-800">{title}</h3>
                    <p className="mb-4 font-mono text-xs text-slate-400">
                      {isPending
                        ? "Payment not completed"
                        : `TXN: ${txn.tx_hash ? txn.tx_hash.slice(0, 10) + "..." : "—"}`}
                    </p>
                    <div className="mt-auto flex items-end justify-between">
                      <p className="text-3xl font-extrabold text-slate-900">
                        ${Number(txn.amount).toFixed(0)}
                        <span className="ml-1 text-sm font-semibold text-slate-500">USDT</span>
                      </p>
                    </div>
                    {isPending && (
                      <button
                        type="button"
                        onClick={() => handleContinueJourney(txn)}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFD700] px-4 py-2.5 text-sm font-bold text-black transition hover:bg-[#E6C200]"
                      >
                        Proceed to payment
                        <ArrowRight size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default My_Profile;
