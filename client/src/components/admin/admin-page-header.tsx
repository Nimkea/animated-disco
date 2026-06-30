import type { ReactNode } from "react";

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
}

export function AdminPageHeader({ title, description, eyebrow, actions }: AdminPageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card/70 p-5 shadow-sm md:flex-row md:items-center md:justify-between">
      <div className="space-y-1">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            {eyebrow}
          </p>
        )}
        <h2 className="text-2xl font-bold tracking-tight" data-testid="admin-page-title">
          {title}
        </h2>
        {description && (
          <p className="max-w-3xl text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
