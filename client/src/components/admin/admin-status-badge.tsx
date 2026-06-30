import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AdminStatusBadgeProps {
  status?: string | null;
  className?: string;
}

export function AdminStatusBadge({ status, className }: AdminStatusBadgeProps) {
  const normalized = String(status || "unknown").toLowerCase();
  const variant = normalized.includes("reject") || normalized.includes("fail") || normalized.includes("error")
    ? "destructive"
    : normalized.includes("approve") || normalized.includes("success") || normalized.includes("paid") || normalized.includes("active")
      ? "default"
      : "secondary";

  const tone = normalized.includes("pending") || normalized.includes("review")
    ? "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
    : normalized.includes("force")
      ? "bg-orange-500/10 text-orange-700 hover:bg-orange-500/20 dark:text-orange-300"
      : "";

  return (
    <Badge variant={variant as any} className={cn("capitalize", tone, className)}>
      {normalized.replace(/_/g, " ")}
    </Badge>
  );
}
