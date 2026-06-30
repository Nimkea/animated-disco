import type { ComponentType, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface AdminEmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function AdminEmptyState({ icon: Icon, title, description, action }: AdminEmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        {Icon && <Icon className="h-10 w-10 text-muted-foreground" />}
        <div>
          <h3 className="font-semibold">{title}</h3>
          {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </CardContent>
    </Card>
  );
}
