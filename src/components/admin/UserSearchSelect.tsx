import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { API_BASE } from "@/config/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type AdminUserOption = {
  id: number;
  name: string;
  email: string;
};

type UserSearchSelectProps = {
  value: number | null;
  onChange: (userId: number | null, user?: AdminUserOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Pre-loaded label when editing an existing row */
  selectedLabel?: string | null;
};

export function UserSearchSelect({
  value,
  onChange,
  placeholder = "Search user by name, email, or ID…",
  disabled,
  selectedLabel,
}: UserSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<AdminUserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadUsers = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users?limit=2000`);
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        setUsers(
          data.users.map((u: { id: number; name?: string; email?: string }) => ({
            id: Number(u.id),
            name: String(u.name || "").trim(),
            email: String(u.email || "").trim(),
          })),
        );
      }
      setLoaded(true);
    } catch {
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [loaded]);

  useEffect(() => {
    if (open) void loadUsers();
  }, [open, loadUsers]);

  const selected = useMemo(
    () => (value != null ? users.find((u) => u.id === value) ?? null : null),
    [users, value],
  );

  const display =
    selected != null
      ? `${selected.name || "User"} · #${selected.id}${selected.email ? ` · ${selected.email}` : ""}`
      : value != null && selectedLabel
        ? selectedLabel
        : value != null
          ? `User #${value}`
          : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="mt-1 h-10 w-full justify-between font-normal"
        >
          <span className="truncate text-left text-sm">{display}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search name, email, or ID…" />
          <CommandList>
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : (
              <>
                <CommandEmpty>No user found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="none clear unassigned"
                    onSelect={() => {
                      onChange(null, null);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value == null ? "opacity-100" : "opacity-0")} />
                    No owner (global coupon)
                  </CommandItem>
                  {users.map((user) => {
                    const searchValue = `${user.id} ${user.name} ${user.email}`;
                    return (
                      <CommandItem
                        key={user.id}
                        value={searchValue}
                        onSelect={() => {
                          onChange(user.id, user);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === user.id ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span className="truncate">
                          {user.name || "—"}
                          <span className="ml-1 text-slate-500">#{user.id}</span>
                          {user.email ? (
                            <span className="ml-1 text-slate-400">· {user.email}</span>
                          ) : null}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
