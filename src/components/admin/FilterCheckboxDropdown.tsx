import { useMemo, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type FilterCheckboxOption = {
  value: string;
  label: string;
};

type FilterCheckboxDropdownProps = {
  label: string;
  options: FilterCheckboxOption[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear?: () => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyLabel?: string;
  className?: string;
  contentClassName?: string;
};

export function FilterCheckboxDropdown({
  label,
  options,
  selected,
  onToggle,
  onClear,
  searchable = false,
  searchPlaceholder = "Search…",
  emptyLabel = "All",
  className,
  contentClassName,
}: FilterCheckboxDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  const triggerText =
    selected.length === 0
      ? emptyLabel
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? `${selected.length} selected`
        : `${selected.length} selected`;

  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label}
        {selected.length > 0 ? (
          <span className="ml-1 font-normal normal-case text-slate-500">
            ({selected.length})
          </span>
        ) : null}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-[38px] w-full justify-between rounded-lg border-slate-300 bg-white px-3 text-sm font-normal text-slate-800 hover:bg-slate-50"
          >
            <span className="truncate text-left">{triggerText}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className={cn("w-[var(--radix-popover-trigger-width)] min-w-[220px] p-2", contentClassName)}
        >
          {searchable ? (
            <div className="mb-2 flex items-center gap-1">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-emerald-500"
              />
              {selected.length > 0 && onClear ? (
                <button
                  type="button"
                  onClick={onClear}
                  className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
                  title="Clear selection"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="max-h-56 space-y-0.5 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-slate-500">No matches</p>
            ) : (
              filteredOptions.map((opt) => {
                const checked = selectedSet.has(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onToggle(opt.value)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50",
                      checked && "bg-emerald-50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border",
                        checked
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-slate-300 bg-white",
                      )}
                    >
                      {checked ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
                    </span>
                    <span className="truncate text-slate-800">{opt.label}</span>
                  </button>
                );
              })
            )}
          </div>
          {!searchable && selected.length > 0 && onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="mt-2 w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
            >
              Clear selection
            </button>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}
