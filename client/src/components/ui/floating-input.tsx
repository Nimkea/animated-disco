import * as React from "react";
import { cn } from "@/lib/utils";

export interface FloatingInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const FloatingInput = React.forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ className, label, error, type = "text", ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const [hasValue, setHasValue] = React.useState(false);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      props.onFocus?.(e);
    };
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      setHasValue(!!e.target.value);
      props.onBlur?.(e);
    };

    React.useEffect(() => {
      setHasValue(!!props.value || !!props.defaultValue);
    }, [props.value, props.defaultValue]);

    const isActive = isFocused || hasValue;

    return (
      <div className="relative">
        <input
          type={type}
          className={cn(
            "peer w-full rounded-lg border bg-background px-4 pb-2 pt-6 text-base transition-all duration-200",
            "placeholder-transparent",
            "focus:outline-none focus:ring-2",
            isFocused
              ? "border-amber-500 ring-amber-500/20"
              : error
              ? "border-red-500 ring-red-500/20"
              : "border-input hover:border-amber-500/50",
            error && "focus:border-red-500 focus:ring-red-500/20",
            className
          )}
          ref={ref}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={label}
          {...props}
        />
        <label
          className={cn(
            "pointer-events-none absolute left-4 transition-all duration-200",
            isActive
              ? "top-1.5 text-xs text-amber-500"
              : "top-1/2 -translate-y-1/2 text-base text-muted-foreground",
            error && isActive && "text-red-500"
          )}
        >
          {label}
        </label>
        {error && (
          <p className="mt-1.5 text-xs text-red-500 animate-in fade-in slide-in-from-top-1 duration-200">
            {error}
          </p>
        )}
      </div>
    );
  }
);

FloatingInput.displayName = "FloatingInput";

export { FloatingInput };
