import React from "react";

type Props = {
  /** Extra classes to control position/opacity if needed */
  className?: string;
  /** Spin speed in seconds (default 60) */
  speed?: number;
};

export function RotatingGlass({ className = "", speed = 60 }: Props) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute -inset-[45%] -z-10 opacity-70 ${className}`}
    >
      {/* Uses Tailwind's built-in keyframes 'spin'; arbitrary animation value sets duration */}
      <div
        className={`h-full w-full rounded-[inherit] will-change-transform animate-[spin_${speed}s_linear_infinite] motion-reduce:animate-none`}
        style={{
          // soft light blob + subtle gold sweep, like your HTML ::before
          background:
            "radial-gradient(40% 40% at 50% 50%, rgba(255,255,255,0.08), transparent 60%), conic-gradient(from 0deg, rgba(245,158,11,0.10), transparent 30%, transparent 70%, rgba(245,158,11,0.10))",
        }}
      />
    </div>
  );
}
