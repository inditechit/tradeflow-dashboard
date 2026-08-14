import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { maskPii, type PiiKind } from "@/utils/maskPii";

const PII_PASSWORD = "8447";
const STORAGE_KEY = "tradeflow.admin.piiRevealed";

type AdminPiiRevealContextValue = {
  revealed: boolean;
  requestUnlock: () => void;
  lock: () => void;
};

const AdminPiiRevealContext = createContext<AdminPiiRevealContextValue | null>(null);

function readRevealed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeRevealed(value: boolean) {
  try {
    if (value) window.sessionStorage.setItem(STORAGE_KEY, "1");
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function AdminPiiRevealProvider({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(readRevealed);
  const [promptOpen, setPromptOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setRevealed(readRevealed());
  }, []);

  const requestUnlock = useCallback(() => {
    if (readRevealed()) {
      setRevealed(true);
      return;
    }
    setPassword("");
    setError("");
    setPromptOpen(true);
  }, []);

  const lock = useCallback(() => {
    writeRevealed(false);
    setRevealed(false);
  }, []);

  const submit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (password.trim() === PII_PASSWORD) {
        writeRevealed(true);
        setRevealed(true);
        setPromptOpen(false);
        setPassword("");
        setError("");
        return;
      }
      setError("Incorrect password");
    },
    [password],
  );

  const value = useMemo(
    () => ({ revealed, requestUnlock, lock }),
    [revealed, requestUnlock, lock],
  );

  return (
    <AdminPiiRevealContext.Provider value={value}>
      {children}
      <Dialog open={promptOpen} onOpenChange={setPromptOpen}>
        <DialogContent className="z-[80] max-w-sm">
          <DialogHeader>
            <DialogTitle>Reveal contact details</DialogTitle>
            <DialogDescription>
              Enter the access password to show name, email, and mobile for this session.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              value={password}
              onChange={(ev) => {
                setPassword(ev.target.value);
                if (error) setError("");
              }}
              placeholder="Password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
            {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPromptOpen(false)}
                className="rounded-lg"
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-lg bg-slate-900 text-white hover:bg-slate-800">
                Unlock
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AdminPiiRevealContext.Provider>
  );
}

export function useAdminPiiReveal() {
  const ctx = useContext(AdminPiiRevealContext);
  if (!ctx) {
    return {
      revealed: true,
      requestUnlock: () => undefined,
      lock: () => undefined,
    };
  }
  return ctx;
}

type MaskedPiiProps = {
  value: unknown;
  kind: PiiKind;
  className?: string;
  empty?: string;
};

/** Masked name/email/mobile — double-click unlocks (password) or locks again. */
export function MaskedPii({ value, kind, className, empty = "—" }: MaskedPiiProps) {
  const { revealed, requestUnlock, lock } = useAdminPiiReveal();
  const raw = value == null ? "" : String(value).trim();
  if (!raw) {
    return <span className={className}>{empty}</span>;
  }
  const display = revealed ? raw : maskPii(raw, kind);

  return (
    <span
      role="button"
      tabIndex={0}
      className={cn("cursor-pointer select-none", className)}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (revealed) lock();
        else requestUnlock();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (revealed) lock();
          else requestUnlock();
        }
      }}
    >
      {display}
    </span>
  );
}

/** Non-component helper when you only need the string (e.g. titles). */
export function piiDisplay(value: unknown, kind: PiiKind, revealed: boolean): string {
  const raw = value == null ? "" : String(value).trim();
  if (!raw) return "—";
  return revealed ? raw : maskPii(raw, kind);
}
