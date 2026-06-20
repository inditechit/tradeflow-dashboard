import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Shield } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { API_BASE } from "@/config/api";
import type { PermissionTab } from "@/config/employeePermissionCatalog";
import { useApp } from "@/context/AppContext";

type Props = {
  open: boolean;
  onClose: () => void;
  employeeName: string;
  initialPermissions: string[];
  onSave: (permissions: string[]) => Promise<void>;
  saving?: boolean;
};

function sectionKeys(tab: PermissionTab, section: "filters" | "columns" | "actions") {
  return tab[section].map((x) => x.key);
}

export function EmployeeAccessModal({
  open,
  onClose,
  employeeName,
  initialPermissions,
  onSave,
  saving = false,
}: Props) {
  const { currentUser } = useApp();
  const adminId = Number(currentUser?.userId);
  const [catalog, setCatalog] = useState<PermissionTab[]>([]);
  const [selectedTabId, setSelectedTabId] = useState("");
  const [perms, setPerms] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !adminId) return;
    setPerms([...initialPermissions]);
    setSelectedTabId("");
    fetch(`${API_BASE}/admin/employees/catalog?adminUserId=${adminId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.catalog)) {
          const tabs = d.catalog.filter((t: PermissionTab) => t.tabId !== "employees");
          setCatalog(tabs);
          if (tabs.length) setSelectedTabId(tabs[0].tabId);
        }
      })
      .catch(() => {});
  }, [open, initialPermissions, adminId]);

  useEffect(() => {
    if (catalog.length && !selectedTabId) setSelectedTabId(catalog[0].tabId);
  }, [catalog, selectedTabId]);

  const activeTab = useMemo(
    () => catalog.find((t) => t.tabId === selectedTabId) ?? null,
    [catalog, selectedTabId],
  );

  const toggle = (key: string, on: boolean) => {
    setPerms((prev) => {
      const set = new Set(prev);
      if (on) set.add(key);
      else set.delete(key);
      return [...set];
    });
  };

  const toggleSection = (tab: PermissionTab, section: "filters" | "columns" | "actions", on: boolean) => {
    const keys = sectionKeys(tab, section);
    setPerms((prev) => {
      const set = new Set(prev);
      for (const k of keys) {
        if (on) set.add(k);
        else set.delete(k);
      }
      return [...set];
    });
  };

  const setTabEnabled = (tab: PermissionTab, on: boolean) => {
    setPerms((prev) => {
      const set = new Set(prev);
      if (on) {
        set.add(tab.tabKey);
      } else {
        set.delete(tab.tabKey);
        for (const f of tab.filters) set.delete(f.key);
        for (const c of tab.columns) set.delete(c.key);
        for (const a of tab.actions) set.delete(a.key);
      }
      return [...set];
    });
  };

  const renderSection = (
    title: string,
    tab: PermissionTab,
    section: "filters" | "columns" | "actions",
  ) => {
    const items = tab[section];
    if (!items.length) return null;
    const keys = sectionKeys(tab, section);
    const allOn = keys.every((k) => perms.includes(k));
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</p>
          <button
            type="button"
            className="text-[11px] font-medium text-emerald-700 hover:underline"
            onClick={() => toggleSection(tab, section, !allOn)}
          >
            {allOn ? "Clear all" : "Select all"}
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <label key={item.key} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <Checkbox
                checked={perms.includes(item.key)}
                onCheckedChange={(v) => toggle(item.key, v === true)}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-600" />
            Access for {employeeName}
          </DialogTitle>
          <DialogDescription>
            Pick a tab, enable it, then choose which filters, columns, and actions this employee can use.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Panel tab</label>
            <div className="relative">
              <select
                value={selectedTabId}
                onChange={(e) => setSelectedTabId(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-10 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {catalog.map((t) => (
                  <option key={t.tabId} value={t.tabId}>
                    {t.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {activeTab && (
            <div className="space-y-3 rounded-xl border border-slate-200 p-4">
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-3">
                <Checkbox
                  checked={perms.includes(activeTab.tabKey)}
                  onCheckedChange={(v) => setTabEnabled(activeTab, v === true)}
                />
                <div>
                  <p className="font-semibold text-slate-900">Allow &quot;{activeTab.label}&quot; tab</p>
                  <p className="text-xs text-slate-500">Employee can open this section in the sidebar</p>
                </div>
              </label>

              {perms.includes(activeTab.tabKey) ? (
                <div className="space-y-3 pt-1">
                  {renderSection("Filters", activeTab, "filters")}
                  {renderSection("Table columns", activeTab, "columns")}
                  {renderSection("Actions", activeTab, "actions")}
                  {!activeTab.filters.length && !activeTab.columns.length && !activeTab.actions.length && (
                    <p className="text-sm text-slate-500">Tab access only — no extra options for this section.</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Enable the tab to configure filters, columns, and actions.</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-[#FFD700] text-black hover:bg-[#E6C200]"
            disabled={saving}
            onClick={() => void onSave(perms)}
          >
            {saving ? "Saving…" : "Save access"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
