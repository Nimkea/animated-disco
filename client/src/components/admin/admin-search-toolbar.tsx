import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface AdminSearchToolbarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  actions?: ReactNode;
  testId?: string;
}

export function AdminSearchToolbar({ value, onChange, placeholder = "Search...", actions, testId }: AdminSearchToolbarProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="pl-10"
          data-testid={testId}
        />
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
