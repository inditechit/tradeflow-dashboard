import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownToLine,
  Check,
  Loader2,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const API_BASE = "https://api.copytradeengine.org/api";

type WithdrawalRow = {
  id: number;
  user_id: number;
  amount_usd: string | number;
  trc20_address: string;
  status: string;
  rejection_reason: string | null;
  outbound_tx_hash: string | null;
  created_at: string;
  completed_at: string | null;
  user_name: string | null;
  user_email: string | null;
  user_telegram: string | null;
};

function statusClass(s: string) {
  const x = String(s).toLowerCase();
  if (x === "completed") return "border-yellow-200 bg-[#FFF9E6] text-neutral-900";
  if (x === "pending") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-red-200 bg-red-50 text-red-900";
}

const AdminWithdrawalsPage = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const [approveOpen, setApproveOpen] = useState(false);
  const [approveId, setApproveId] = useState<number | null>(null);
  const [approveBusy, setApproveBusy] = useState(false);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectBusy, setRejectBusy] = useState(false);

  const [txFixOpen, setTxFixOpen] = useState(false);
  const [txFixId, setTxFixId] = useState<number | null>(null);
  const [txFixHash, setTxFixHash] = useState("");
  const [txFixBusy, setTxFixBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 100;

  const load = useCallback(async (pageNum = 1) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filter === "pending") qs.set("status", "pending");
      qs.set("page", String(pageNum));
      qs.set("limit", String(pageSize));
      const res = await fetch(`${API_BASE}/admin/withdrawals?${qs.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.withdrawals)) {
        setRows(data.withdrawals);
        setTotal(Number(data.total ?? data.withdrawals.length));
        setPage(Number(data.page ?? pageNum));
      } else {
        setRows([]);
        if (data.error) {
          toast({ title: "Error", description: data.error, variant: "destructive" });
        }
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => {
    load();
  }, [load]);


const openApprove = (id: number) => {
  setApproveId(id);
  setApproveOpen(true);
};


const confirmApprove = async () => {
  if (approveId == null) return;
  setApproveBusy(true);

  try {
    // 1. Notice the body is now empty {} 
    // The backend will generate the tx hash itself
    const res = await fetch(`${API_BASE}/admin/withdrawals/${approveId}/approve`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}), 
    });

    const data = await res.json();

    if (data.success) {
     toast({
  title: "Withdrawal Completed",
  description: `USDT sent successfully. TX: ${data.txHash.slice(0, 12)}...`,
});
      setApproveOpen(false);
      load(); // Refresh the table
    } else {
      // If the Admin wallet is out of Energy or USDT, it shows the error here
      toast({ 
        title: "Payout Failed", 
        description: data.error ?? "Blockchain error", 
        variant: "destructive" 
      });
    }
  } catch (err) {
    toast({ title: "Network error", variant: "destructive" });
  } finally {
    setApproveBusy(false);
  }
};

  const openReject = (id: number) => {
    setRejectId(id);
    setRejectReason("");
    setRejectOpen(true);
  };

  const confirmReject = async () => {
    if (rejectId == null) return;
    const reason = rejectReason.trim();
    if (!reason) {
      toast({ title: "Enter a reason", variant: "destructive" });
      return;
    }
    setRejectBusy(true);
    try {
      const res = await fetch(`${API_BASE}/admin/withdrawals/${rejectId}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Request rejected" });
        setRejectOpen(false);
        load();
      } else {
        toast({ title: "Failed", description: data.error ?? "", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setRejectBusy(false);
    }
  };

  const openTxFix = (id: number) => {
    setTxFixId(id);
    setTxFixHash("");
    setTxFixOpen(true);
  };

  const confirmTxFix = async () => {
    if (txFixId == null) return;
    const h = txFixHash.trim();
    if (!h) {
      toast({ title: "Enter transaction id", variant: "destructive" });
      return;
    }
    setTxFixBusy(true);
    try {
      const res = await fetch(`${API_BASE}/admin/withdrawals/${txFixId}/tx`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outbound_tx_hash: h.slice(0, 128) }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Tx saved" });
        setTxFixOpen(false);
        load();
      } else {
        toast({ title: "Failed", description: data.error ?? "", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setTxFixBusy(false);
    }
  };

  return (
    <div className="w-full min-w-0 font-sans">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <ArrowDownToLine className="h-8 w-8 shrink-0 text-neutral-900" aria-hidden />
            Withdrawal requests
          </h1>
         <p className="mt-1 text-sm text-slate-600">
  Approve to automatically send USDT (TRC20) to the user's wallet and deduct their in-app balance after successful blockchain verification.
</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={load}
          disabled={loading}
          className="gap-2 shrink-0 rounded-xl bg-[#FFD700] text-black hover:bg-[#E6C200] disabled:opacity-70"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Button
          type="button"
          variant={filter === "pending" ? "default" : "outline"}
          className={filter === "pending" ? "bg-slate-800 text-white" : ""}
          onClick={() => setFilter("pending")}
        >
          Pending
        </Button>
        <Button
          type="button"
          variant={filter === "all" ? "default" : "outline"}
          className={filter === "all" ? "bg-slate-800 text-white" : ""}
          onClick={() => setFilter("all")}
        >
          All
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/95">
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6">ID</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6">User</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6">Amount</th>
                <th className="px-4 py-3 text-xs font-bold tracking-wide text-slate-600 sm:px-6">trc20 address</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6">Status</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6">Created</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {!loading &&
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-yellow-50/40">
                    <td className="px-4 py-3 font-mono text-sm text-slate-700 sm:px-6">{r.id}</td>
                    <td className="px-4 py-3 sm:px-6">
                      <div className="font-semibold text-slate-900">{r.user_name ?? "—"}</div>
                      <div className="text-xs text-slate-500">#{r.user_id}</div>
                      <div className="break-all text-xs text-slate-600">{r.user_email}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-neutral-800 sm:px-6">
                      ${Number(r.amount_usd).toFixed(2)}
                    </td>
                    <td className="max-w-[220px] px-4 py-3 sm:px-6">
                      <span className="break-all font-mono text-xs text-slate-800">{r.trc20_address}</span>
                    </td>
                    <td className="px-4 py-3 sm:px-6">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${statusClass(r.status)}`}
                      >
                        {r.status}
                      </span>
                      {r.outbound_tx_hash && (
                        <a
                          href={`https://tronscan.org/#/transaction/${encodeURIComponent(r.outbound_tx_hash)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 block break-all font-mono text-[11px] text-neutral-800 underline"
                        >
                          Tx
                        </a>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 sm:px-6">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right sm:px-6">
                      <div className="flex flex-col items-end gap-1 sm:flex-row sm:justify-end">
                        {r.status === "pending" && (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              className="gap-1 bg-[#FFD700] text-black hover:bg-[#E6C200]"
                              onClick={() => openApprove(r.id)}
                            >
                              <Check className="h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="gap-1 border-red-200 text-red-800 hover:bg-red-50"
                              onClick={() => openReject(r.id)}
                            >
                              <XCircle className="h-4 w-4" />
                              Reject
                            </Button>
                          </>
                        )}
                        {/* {r.status === "completed" && !r.outbound_tx_hash && (
                          <Button type="button" size="sm" variant="secondary" onClick={() => openTxFix(r.id)}>
                            <Search className="mr-1 h-4 w-4" />
                            Add tx
                          </Button>
                        )} */}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-9 w-9 animate-spin text-neutral-900" />
          </div>
        )}
        {!loading && rows.length === 0 && (
          <p className="py-12 text-center text-sm text-slate-500">No rows.</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-600">
        <span>
          Page {page} · {rows.length} rows · {total} total
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || page <= 1}
          onClick={() => load(page - 1)}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || page * pageSize >= total}
          onClick={() => load(page + 1)}
        >
          Next
        </Button>
      </div>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="border-slate-200 bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-black">Approve withdrawal</DialogTitle>
          <DialogDescription className="text-slate-600">
  This will automatically send USDT from the admin wallet to the user's TRC20 address. The request will only be completed after the blockchain transaction is verified.
</DialogDescription>
          </DialogHeader>
          {/* <div className="space-y-2 py-2">
            <Label htmlFor="ap-tx" className="text-slate-800">
              Outbound tx hash (optional)
            </Label>
            <Input
              id="ap-tx"
              value={approveTx}
              onChange={(e) => setApproveTx(e.target.value)}
              placeholder="Paste after sending on-chain"
              className="border-slate-200 bg-white font-mono text-sm text-slate-900"
            />
          </div> */}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setApproveOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#FFD700] text-black hover:bg-[#E6C200]"
              disabled={approveBusy}
              onClick={confirmApprove}
            >
              {approveBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirm approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="border-slate-200 bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-black">Reject withdrawal</DialogTitle>
            <DialogDescription>The user will see this reason. Their balance is not changed.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason"
            className="min-h-[100px]"
          />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={rejectBusy}
              onClick={confirmReject}
            >
              {rejectBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Reject request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={txFixOpen} onOpenChange={setTxFixOpen}>
        <DialogContent className="border-slate-200 bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-black">Add transaction id</DialogTitle>
            <DialogDescription>For a completed payout, record the Tron transaction hash.</DialogDescription>
          </DialogHeader>
          <Input
            value={txFixHash}
            onChange={(e) => setTxFixHash(e.target.value)}
            className="font-mono text-sm"
            placeholder="Tx hash"
          />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setTxFixOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={txFixBusy} onClick={confirmTxFix}>
              {txFixBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminWithdrawalsPage;
