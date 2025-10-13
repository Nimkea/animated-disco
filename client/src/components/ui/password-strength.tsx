import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface PasswordStrengthProps {
  password: string;
  className?: string;
}

export function PasswordStrength({ password, className }: PasswordStrengthProps) {
  const strength = useMemo(() => {
    if (!password) return { score: 0, label: "", color: "" };

    let score = 0;
    
    // Length check
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    
    // Character variety
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;

    // Determine label and color
    if (score <= 2) return { score: 1, label: "Weak", color: "bg-red-500" };
    if (score <= 4) return { score: 2, label: "Fair", color: "bg-orange-500" };
    if (score <= 5) return { score: 3, label: "Good", color: "bg-yellow-500" };
    return { score: 4, label: "Strong", color: "bg-green-500" };
  }, [password]);

  if (!password) return null;

  const percentage = (strength.score / 4) * 100;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Password Strength</span>
        <span className={cn("font-medium", {
          "text-red-500": strength.score === 1,
          "text-orange-500": strength.score === 2,
          "text-yellow-500": strength.score === 3,
          "text-green-500": strength.score === 4,
        })}>
          {strength.label}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full transition-all duration-500 ease-out",
            {
              "bg-red-500": strength.score === 1,
              "bg-orange-500": strength.score === 2,
              "bg-yellow-500": strength.score === 3,
              "bg-gradient-to-r from-amber-400 to-yellow-500": strength.score === 4,
            }
          )}
          style={{
            width: `${percentage}%`
          }}
        />
      </div>
    </div>
  );
}
