import { Loader2 } from "lucide-react";

const AuthGateLoading = () => (
  <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-slate-500">
    <Loader2 className="h-8 w-8 animate-spin text-yellow-800" />
    <p className="text-sm font-medium">Verifying access…</p>
  </div>
);

export default AuthGateLoading;
