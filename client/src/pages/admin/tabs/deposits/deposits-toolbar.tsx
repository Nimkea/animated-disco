import { Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DepositsToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

export function DepositsToolbar({ searchQuery, onSearchChange }: DepositsToolbarProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by transaction hash, email, username, or deposit ID..."
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          className="pl-10"
          data-testid="input-search-deposits"
        />
      </div>
      <Button variant="outline" size="icon" data-testid="button-filter-deposits">
        <Filter className="h-4 w-4" />
      </Button>
    </div>
  );
}
