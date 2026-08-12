import { Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { StatementColumnDef } from "@/utils/adminCapitalStatementTableColumns";
import { cn } from "@/lib/utils";

type Props<T extends string> = {
  columns: StatementColumnDef<T>[];
  visibility: Record<T, boolean>;
  onChange: (next: Record<T, boolean>) => void;
  onReset: () => void;
  hint?: string;
};

export function AdminTableColumnPicker<T extends string>({
  columns,
  visibility,
  onChange,
  onReset,
  hint = "Checked columns appear in the table. Preferences are saved in this browser.",
}: Props<T>) {
  const visibleCount = columns.filter((c) => visibility[c.id]).length;

  const toggle = (id: T) => {
    const nextOn = !visibility[id];
    if (!nextOn && visibleCount <= 1) return;
    onChange({ ...visibility, [id]: nextOn });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-8 gap-1.5 rounded-lg border-slate-300 px-2.5 text-xs font-semibold text-slate-700 hover:bg-white"
        >
          <Columns3 className="h-3.5 w-3.5" />
          Columns
          <span className="tabular-nums text-slate-500">
            ({visibleCount}/{columns.length})
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Table columns
          </p>
          <button
            type="button"
            onClick={onReset}
            className="text-[11px] font-medium text-slate-500 hover:text-slate-800"
          >
            Reset defaults
          </button>
        </div>
        <p className="mb-2 text-[11px] text-slate-500">{hint}</p>
        <div className="max-h-72 space-y-0.5 overflow-y-auto">
          {columns.map((col) => {
            const checked = visibility[col.id];
            return (
              <label
                key={col.id}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50",
                  checked && "bg-emerald-50/70",
                )}
              >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  checked={checked}
                  onChange={() => toggle(col.id)}
                />
                <span className="truncate text-slate-800">{col.label}</span>
                {col.defaultVisible ? (
                  <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-slate-400">
                    default
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
