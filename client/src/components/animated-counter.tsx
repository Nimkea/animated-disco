import { useEffect, useRef } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

interface AnimatedCounterProps {
  value: number;
  decimals?: number;
  className?: string;
}

export function AnimatedCounter({ value, decimals = 0, className = "" }: AnimatedCounterProps) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => 
    decimals > 0 ? latest.toFixed(decimals) : Math.round(latest).toString()
  );
  const prevValue = useRef(0);

  useEffect(() => {
    const controls = animate(prevValue.current, value, {
      duration: 1,
      ease: "easeOut",
      onUpdate: (latest) => count.set(latest)
    });
    
    prevValue.current = value;
    
    return () => controls.stop();
  }, [value, count]);

  return <motion.span className={className}>{rounded}</motion.span>;
}
