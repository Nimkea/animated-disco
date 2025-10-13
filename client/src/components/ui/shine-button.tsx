import * as React from "react";
import { cn } from "@/lib/utils";

export interface ShineButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "lg";
}

const ShineButton = React.forwardRef<HTMLButtonElement, ShineButtonProps>(
  ({ className, children, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "group relative inline-flex items-center justify-center overflow-hidden rounded-lg font-medium transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-lg hover:shadow-amber-500/40": variant === "default",
            "border border-amber-500/25 bg-transparent text-white hover:bg-amber-500/10": variant === "outline",
            "bg-transparent text-white hover:bg-white/10": variant === "ghost",
          },
          {
            "h-9 px-4 text-sm": size === "sm",
            "h-10 px-6": size === "default",
            "h-12 px-8 text-lg": size === "lg",
          },
          className
        )}
        ref={ref}
        {...props}
      >
        {/* Shine effect */}
        <div
          className={cn(
            "absolute inset-0 -translate-x-full transition-transform duration-1000 group-hover:translate-x-full",
            "bg-gradient-to-r from-transparent via-white/20 to-transparent",
            variant === "default" && "via-white/30"
          )}
          style={{
            transform: "skewX(-20deg)",
          }}
        />
        
        {/* Content */}
        <span className="relative z-10 flex items-center gap-2">
          {children}
        </span>
      </button>
    );
  }
);

ShineButton.displayName = "ShineButton";

export { ShineButton };
