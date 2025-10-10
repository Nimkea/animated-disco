import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  TrendingUp, 
  DollarSign, 
  Clock, 
  AlertCircle,
  ArrowRight,
  RefreshCcw
} from "lucide-react";
import { useLocation } from "wouter";

interface AdminStats {
  totalUsers: number;
  totalDeposits: string;
  totalWithdrawals: string;
  pendingDepositsCount: number;
  pendingWithdrawalsCount: number;
  activeStakesCount: number;
  todayDeposits: string;
  todayWithdrawals: string;
  todayNewUsers: number;
}

export default function OverviewTab() {
  const [, setLocation] = useLocation();
  
  const { data: stats, isLoading, refetch } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  const pendingTotal = (stats?.pendingDepositsCount || 0) + (stats?.pendingWithdrawalsCount || 0);
  const hasAlerts = pendingTotal > 0;

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-users">
              {isLoading ? "..." : (stats?.totalUsers || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              +{stats?.todayNewUsers || 0} today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deposits</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-deposits">
              {isLoading ? "..." : parseFloat(stats?.totalDeposits || "0").toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              XNRT • +{parseFloat(stats?.todayDeposits || "0").toLocaleString()} today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Withdrawals</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-withdrawals">
              {isLoading ? "..." : parseFloat(stats?.totalWithdrawals || "0").toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              XNRT • +{parseFloat(stats?.todayWithdrawals || "0").toLocaleString()} today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Actions</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-pending-actions">
              {isLoading ? "..." : pendingTotal}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.pendingDepositsCount || 0} deposits, {stats?.pendingWithdrawalsCount || 0} withdrawals
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Section */}
      {hasAlerts && (
        <Card className="border-orange-500/50 bg-orange-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
              <AlertCircle className="h-5 w-5" />
              Pending Actions Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats && stats.pendingDepositsCount > 0 && (
              <div className="flex items-center justify-between p-3 bg-background rounded-md border border-border">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    {stats.pendingDepositsCount}
                  </Badge>
                  <span className="font-medium">Pending Deposits</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setLocation("/admin?tab=deposits")}
                  data-testid="button-view-deposits"
                >
                  Review <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
            {stats && stats.pendingWithdrawalsCount > 0 && (
              <div className="flex items-center justify-between p-3 bg-background rounded-md border border-border">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    {stats.pendingWithdrawalsCount}
                  </Badge>
                  <span className="font-medium">Pending Withdrawals</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setLocation("/admin?tab=withdrawals")}
                  data-testid="button-view-withdrawals"
                >
                  Review <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Quick Actions</CardTitle>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => refetch()}
              data-testid="button-refresh-stats"
            >
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button 
              variant="outline" 
              className="justify-start gap-2"
              onClick={() => setLocation("/admin?tab=deposits")}
              data-testid="button-manage-deposits"
            >
              <TrendingUp className="h-4 w-4" />
              Manage Deposits
            </Button>
            <Button 
              variant="outline" 
              className="justify-start gap-2"
              onClick={() => setLocation("/admin?tab=withdrawals")}
              data-testid="button-manage-withdrawals"
            >
              <DollarSign className="h-4 w-4" />
              Manage Withdrawals
            </Button>
            <Button 
              variant="outline" 
              className="justify-start gap-2"
              onClick={() => setLocation("/admin?tab=users")}
              data-testid="button-manage-users"
            >
              <Users className="h-4 w-4" />
              Manage Users
            </Button>
            <Button 
              variant="outline" 
              className="justify-start gap-2"
              onClick={() => setLocation("/admin?tab=analytics")}
              data-testid="button-view-analytics"
            >
              <TrendingUp className="h-4 w-4" />
              View Analytics
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active Stakes Info */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
              <span className="text-sm font-medium">Active Stakes</span>
              <Badge variant="secondary" data-testid="badge-active-stakes">
                {stats?.activeStakesCount || 0}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
              <span className="text-sm font-medium">Net Flow (Today)</span>
              <Badge 
                variant={
                  parseFloat(stats?.todayDeposits || "0") > parseFloat(stats?.todayWithdrawals || "0") 
                    ? "default" 
                    : "outline"
                }
                data-testid="badge-net-flow"
              >
                {(parseFloat(stats?.todayDeposits || "0") - parseFloat(stats?.todayWithdrawals || "0")).toLocaleString()} XNRT
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
