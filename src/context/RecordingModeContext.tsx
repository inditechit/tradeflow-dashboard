import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "tradeflow.admin.recordingMode";

type RecordingModeContextValue = {
  recordingMode: boolean;
  setRecordingMode: (on: boolean) => void;
  toggleRecordingMode: () => void;
};

const RecordingModeContext = createContext<RecordingModeContextValue>({
  recordingMode: false,
  setRecordingMode: () => undefined,
  toggleRecordingMode: () => undefined,
});

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeStored(on: boolean) {
  try {
    if (on) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Admin recording / demo mode: view-only panel.
 * Persists in localStorage and blocks mutating fetch methods while on.
 */
export function RecordingModeProvider({ children }: { children: ReactNode }) {
  const [recordingMode, setRecordingModeState] = useState<boolean>(() =>
    typeof window !== "undefined" ? readStored() : false,
  );

  const setRecordingMode = useCallback((on: boolean) => {
    setRecordingModeState(on);
    writeStored(on);
  }, []);

  const toggleRecordingMode = useCallback(() => {
    setRecordingModeState((prev) => {
      const next = !prev;
      writeStored(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!recordingMode) return;

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = String(init?.method || "GET").toUpperCase();
      if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
        const err = new Error(
          "Recording mode is on — edits are disabled. Turn it off in Settings to make changes.",
        );
        (err as Error & { code?: string }).code = "RECORDING_MODE";
        throw err;
      }
      return originalFetch(input, init);
    };

    const onClickCapture = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      if (el.closest("[data-recording-safe]")) return;
      if (el.closest("a[href]")) return;
      if (el.closest("nav")) return;
      const btn = el.closest("button, [role='button'], input[type='submit']");
      if (!btn) return;
      const inPanel = btn.closest(
        ".admin-main-panel, [role='dialog'], [data-radix-portal]",
      );
      if (!inPanel) return;
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener("click", onClickCapture, true);

    return () => {
      window.fetch = originalFetch;
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [recordingMode]);

  useEffect(() => {
    const root = document.documentElement;
    if (recordingMode) root.setAttribute("data-recording-mode", "true");
    else root.removeAttribute("data-recording-mode");
    return () => root.removeAttribute("data-recording-mode");
  }, [recordingMode]);

  const value = useMemo(
    () => ({ recordingMode, setRecordingMode, toggleRecordingMode }),
    [recordingMode, setRecordingMode, toggleRecordingMode],
  );

  return (
    <RecordingModeContext.Provider value={value}>{children}</RecordingModeContext.Provider>
  );
}

export function useRecordingMode() {
  return useContext(RecordingModeContext);
}

/** Hide children while recording mode is on (mutate actions). */
export function HideWhenRecording({
  children,
  allowInRecording = false,
}: {
  children: ReactNode;
  allowInRecording?: boolean;
}) {
  const { recordingMode } = useRecordingMode();
  if (recordingMode && !allowInRecording) return null;
  return <>{children}</>;
}
