import * as React from "react";
import { cn } from "@/lib/utils";

export interface TiltCardProps extends React.HTMLAttributes<HTMLDivElement> {
  tiltIntensity?: number;
  glowIntensity?: number;
}

const TiltCard = React.forwardRef<HTMLDivElement, TiltCardProps>(
  ({ className, children, tiltIntensity = 10, glowIntensity = 0.5, ...props }, ref) => {
    const cardRef = React.useRef<HTMLDivElement>(null);
    const [tilt, setTilt] = React.useState({ x: 0, y: 0 });
    const [isHovering, setIsHovering] = React.useState(false);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!cardRef.current) return;

      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const tiltX = ((y - centerY) / centerY) * -tiltIntensity;
      const tiltY = ((x - centerX) / centerX) * tiltIntensity;

      setTilt({ x: tiltX, y: tiltY });
    };

    const handleMouseEnter = () => setIsHovering(true);
    
    const handleMouseLeave = () => {
      setIsHovering(false);
      setTilt({ x: 0, y: 0 });
    };

    React.useImperativeHandle(ref, () => cardRef.current!);

    return (
      <div
        ref={cardRef}
        className={cn("relative transition-all duration-200", className)}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) ${
            isHovering ? "translateZ(10px)" : ""
          }`,
          transition: "transform 0.2s ease-out",
        }}
        {...props}
      >
        {/* Glow effect on hover */}
        {isHovering && (
          <div
            className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300"
            style={{
              opacity: isHovering ? glowIntensity : 0,
              background: `radial-gradient(
                600px circle at ${tilt.y * 10 + 50}% ${tilt.x * 10 + 50}%,
                rgba(245, 158, 11, 0.15),
                transparent 40%
              )`,
            }}
          />
        )}
        
        {children}
      </div>
    );
  }
);

TiltCard.displayName = "TiltCard";

export { TiltCard };
