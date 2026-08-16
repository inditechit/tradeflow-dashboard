import * as React from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<React.ComponentProps<"input">, "type"> & {
  wrapperClassName?: string;
  showLockIcon?: boolean;
};

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, wrapperClassName, showLockIcon, disabled, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);

    return (
      <div className={cn("relative w-full", wrapperClassName)}>
        {showLockIcon ? (
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
        ) : null}
        <input
          type={visible ? "text" : "password"}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            showLockIcon && "pl-10",
            className,
          )}
          ref={ref}
          disabled={disabled}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          disabled={disabled}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition-colors hover:text-slate-600 disabled:pointer-events-none disabled:opacity-50"
          aria-label={visible ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

type AuthPasswordFieldProps = {
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  autoComplete?: string;
  autoFocus?: boolean;
  disabled?: boolean;
};

/** Login / signup styled password field with lock icon and show-hide toggle. */
function AuthPasswordField({
  placeholder,
  value,
  onChange,
  onKeyDown,
  autoComplete = "current-password",
  autoFocus,
  disabled,
}: AuthPasswordFieldProps) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="group relative w-full">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 transition-colors group-focus-within:text-yellow-800">
        <Lock size={18} />
      </div>

      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        disabled={disabled}
        className="h-11 w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-11 text-sm text-slate-800 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-neutral-900 focus:ring-1 focus:ring-yellow-500 disabled:cursor-not-allowed disabled:opacity-50"
      />

      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        disabled={disabled}
        className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 transition-colors hover:text-slate-600 disabled:pointer-events-none disabled:opacity-50"
        aria-label={visible ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export { PasswordInput, AuthPasswordField };
